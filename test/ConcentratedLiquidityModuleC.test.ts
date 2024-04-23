/* global describe it before ethers */

import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, Contract, Signer } from "ethers";
import chai from "chai";
const { expect } = chai;

import { ConcentratedLiquidityModuleC } from "../typechain-types";

import { deployContract } from "../scripts/utils/deployContract";
import {
  price1ToTick,
  sqrtPriceX96ToPrice1,
  tickToPrice0,
} from "../scripts/utils/v3";

// Ether.js returns some funky stuff for structs (merges an object and array). Convert to an array
function convertToStruct(res: any) {
  return Object.keys(res)
    .filter((x) => Number.isNaN(parseInt(x)))
    .reduce(
      (acc, k) => {
        acc[k] = res[k];
        return acc;
      },
      {} as Record<string, any>,
    );
}

// TODO: remove ignore before merging and not autoformating
/* prettier-ignore */ const BLAST_ADDRESS                 = "0x4300000000000000000000000000000000000002";
/* prettier-ignore */ const BLAST_POINTS_ADDRESS          = "0x2fc95838c71e76ec69ff817983BFf17c710F34E0";
/* prettier-ignore */ const BLAST_POINTS_OPERATOR_ADDRESS = "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";
/* prettier-ignore */ const GAS_COLLECTOR_ADDRESS         = "0xf237c20584DaCA970498917470864f4d027de4ca"; // v1.0.0
/* prettier-ignore */ const USDB_ADDRESS                  = "0x4300000000000000000000000000000000000003";
/* prettier-ignore */ const WETH_ADDRESS                  = "0x4300000000000000000000000000000000000004";
/* prettier-ignore */ const THRUSTER_ADDRESS              = "0x434575EaEa081b735C985FA9bf63CD7b87e227F9";
/* prettier-ignore */ const POOL_ADDRESS                  = "0xf00DA13d2960Cf113edCef6e3f30D92E52906537";
/* prettier-ignore */ const ROUTER_ADDRESS                = "0x337827814155ECBf24D20231fCA4444F530C0555";

const user = "0x3E0770C75c0D5aFb1CfA3506d4b0CaB11770a27a";
describe("ConcentratedLiquidityModuleC", function () {
  async function fixtureDeployed() {
    const [deployer] = await ethers.getSigners();
    const blockNumber = 2178591;
    // Run tests against forked network
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.BLAST_URL,
            blockNumber,
          },
        },
      ],
    });

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [user],
    });

    const signer = await provider.getSigner(user);

    // Get ecosystem contracts
    const USDB = await ethers.getContractAt("MockERC20", USDB_ADDRESS, signer);
    const WETH = await ethers.getContractAt("MockERC20", WETH_ADDRESS, signer);
    const pool = new ethers.Contract(
      POOL_ADDRESS,
      new ethers.utils.Interface([
        "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
      ]),
      deployer,
    );

    const PositionManager = await ethers.getContractAt(
      "INonfungiblePositionManager",
      THRUSTER_ADDRESS,
      signer,
    );

    const module = (await deployContract(
      deployer,
      "ConcentratedLiquidityModuleC",
      [
        BLAST_ADDRESS,
        GAS_COLLECTOR_ADDRESS,
        BLAST_POINTS_ADDRESS,
        BLAST_POINTS_OPERATOR_ADDRESS,
      ],
    )) as ConcentratedLiquidityModuleC;

    // Wrap existing ETH to WETH, leaving some gas
    await signer
      .sendTransaction({
        to: WETH_ADDRESS,
        value: (await signer.getBalance()).sub(ethers.utils.parseEther("0.1")),
      })
      .then((x) => x.wait());
    expect(
      await Promise.all([
        provider.getBalance(user),
        USDB.balanceOf(user),
        WETH.balanceOf(user),
      ]),
    ).to.deep.equal([
      BN.from("99909183979657216"),
      BN.from("413026157656739951683272"),
      BN.from("60764638839453191713"),
    ]);

    return {
      PositionManager,
      USDB,
      WETH,
      module,
      pool,
      signer,
    };
  }

  async function fixtureDeposited() {
    const fixture = await loadFixture(fixtureDeployed);
    const { signer, USDB, module, WETH } = fixture;

    await USDB.transfer(module.address, (await USDB.balanceOf(user)).div(2));
    await WETH.transfer(
      module.address,
      (await WETH.balanceOf(user)).sub(ethers.utils.parseEther("10")),
    );

    await module
      .moduleC_depositBalance({
        manager: THRUSTER_ADDRESS,
        tickLower: -82920,
        tickUpper: -76020,
        fee: 3000,
        token0: USDB_ADDRESS,
        token1: WETH_ADDRESS,
      })
      .then((tx) => tx.wait());

    return fixture;
  }

  it("Verify initial pool state", async () => {
    const { pool } = await loadFixture(fixtureDeployed);

    const [sqrtPriceX96, tick] = await pool.slot0();
    const price = sqrtPriceX96ToPrice1(BigInt(sqrtPriceX96.toString()));

    expect(sqrtPriceX96).to.equal(BN.from("1392486909633467119786647344"));
    expect(tick).to.equal(BN.from("-80829"));

    expect(1 / tickToPrice0(tick)).to.equal(3237.303088069362);
    expect(price).to.equal(3236.9999999999995);
  });

  it("View initial state", async function () {
    const { module } = await loadFixture(fixtureDeployed);
    expect(await module.token0()).to.equal(
      "0x0000000000000000000000000000000000000000",
    );
    expect(await module.token1()).to.equal(
      "0x0000000000000000000000000000000000000000",
    );
    expect(await module.thrusterManager()).to.equal(
      "0x0000000000000000000000000000000000000000",
    );

    await expect(module.position()).to.be.revertedWith(
      "No existing position to view",
    );
  });

  it("Can view existing position ", async function () {
    const { module, pool } = await loadFixture(fixtureDeposited);

    expect(await module.token0()).to.equal(USDB_ADDRESS);
    expect(await module.token1()).to.equal(WETH_ADDRESS);
    expect(await module.thrusterManager()).to.equal(THRUSTER_ADDRESS);
    expect(await module.tokenId()).to.deep.equal(BN.from("54353"));

    expect(convertToStruct(await module.position())).to.deep.equal({
      nonce: BN.from("0"),
      operator: "0x0000000000000000000000000000000000000000",
      token0: "0x4300000000000000000000000000000000000003",
      token1: "0x4300000000000000000000000000000000000004",
      fee: 3000,
      tickLower: -82920,
      tickUpper: -76020,
      liquidity: BN.from("16983715425639545311351"),
      feeGrowthInside0LastX128: BN.from(
        "223062771100361370800904183975351004548",
      ),
      feeGrowthInside1LastX128: BN.from("63771321919466126002465612072408134"),
      tokensOwed0: BN.from("0"),
      tokensOwed1: BN.from("0"),
    });

    const [, tick] = await pool.slot0();
    expect(tick).to.equal(BN.from("-80829"));

    expect(await module.pool()).to.equal(POOL_ADDRESS);
  });

  describe("Deposit flow", () => {
    it("Can reject invalid tick range", async () => {
      const { module } = await loadFixture(fixtureDeployed);

      await expect(
        module.moduleC_depositBalance({
          manager: THRUSTER_ADDRESS,
          tickLower: -80880,
          tickUpper: -81480,
          fee: 3000,
          token0: USDB_ADDRESS,
          token1: WETH_ADDRESS,
        }),
      ).to.be.revertedWith("Invalid tick range");
    });

    it("Can reject deposit when position exists", async function () {
      const { module, USDB, WETH, signer } =
        await loadFixture(fixtureDeposited);
      // Transfer all assets to tba
      await USDB.transfer(module.address, USDB.balanceOf(user));
      await WETH.transfer(module.address, WETH.balanceOf(user));

      expect(await module.tokenId()).to.deep.equal(BN.from("54353"));
      // Trigger the deposit
      await expect(
        module.moduleC_depositBalance({
          manager: THRUSTER_ADDRESS,
          tickLower: price1ToTick(4000),
          tickUpper: price1ToTick(2000),
          fee: 3000,
          token0: USDB_ADDRESS,
          token1: WETH_ADDRESS,
        }),
      ).to.be.revertedWith("Cannot deposit with existing position");
    });

    it("Can deposit with WETH", async function () {
      const { module, USDB, WETH, PositionManager } =
        await loadFixture(fixtureDeployed);
      // Expect no assets in tba
      expect(
        await Promise.all([
          provider.getBalance(module.address),
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("0"), BN.from("0")]);

      // Transfer all assets to tba
      await USDB.transfer(module.address, USDB.balanceOf(user));
      await WETH.transfer(module.address, WETH.balanceOf(user));

      // Trigger the deposit
      await module
        .moduleC_depositBalance({
          manager: THRUSTER_ADDRESS,
          tickLower: price1ToTick(4000),
          tickUpper: price1ToTick(2000),
          fee: 3000,
          token0: USDB_ADDRESS,
          token1: WETH_ADDRESS,
        })
        .then((tx) => tx.wait());

      // Expect all Assets to be transferred to tba
      expect(
        await Promise.all([USDB.balanceOf(user), WETH.balanceOf(user)]),
      ).to.deep.equal([BN.from("0"), BN.from("0")]);

      const tokenId = await module.tokenId();

      // Position to be minted
      expect(
        convertToStruct(await PositionManager.positions(tokenId)),
      ).to.deep.equal({
        nonce: BN.from("0"),
        operator: "0x0000000000000000000000000000000000000000",
        token0: "0x4300000000000000000000000000000000000003",
        token1: "0x4300000000000000000000000000000000000004",
        fee: 3000,
        tickLower: -82920,
        tickUpper: -76020,
        liquidity: BN.from("33967430851279090622703"),
        feeGrowthInside0LastX128: BN.from(
          "223062771100361370800904183975351004548",
        ),
        feeGrowthInside1LastX128: BN.from(
          "63771321919466126002465612072408134",
        ),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });
      // Only leftover on one side
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("10"), BN.from("1499144318855151962")]);
    });
  });

  describe("Partial Deposit flow", () => {
    it("Rejects partial deposit when no position exists", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureDeployed);

      await USDB.transfer(module.address, USDB.balanceOf(user));
      await WETH.transfer(module.address, WETH.balanceOf(user));

      await expect(module.moduleC_increaseLiquidity()).to.be.revertedWith(
        "No existing position to increase",
      );
    });

    it("Can do partial deposit", async () => {
      const { module, USDB, WETH, PositionManager } =
        await loadFixture(fixtureDeposited);

      await USDB.transfer(module.address, USDB.balanceOf(user));
      await WETH.transfer(module.address, WETH.balanceOf(user));

      const tokenId = await module.tokenId();

      // Position to be minted
      expect(
        convertToStruct(await PositionManager.positions(tokenId)),
      ).to.deep.equal({
        nonce: BN.from("0"),
        operator: "0x0000000000000000000000000000000000000000",
        token0: "0x4300000000000000000000000000000000000003",
        token1: "0x4300000000000000000000000000000000000004",
        fee: 3000,
        tickLower: -82920,
        tickUpper: -76020,
        liquidity: BN.from("16983715425639545311351"),
        feeGrowthInside0LastX128: BN.from(
          "223062771100361370800904183975351004548",
        ),
        feeGrowthInside1LastX128: BN.from(
          "63771321919466126002465612072408134",
        ),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      await module.moduleC_increaseLiquidity().then((tx) => tx.wait());

      // Position to be minted
      expect(
        convertToStruct(await PositionManager.positions(tokenId)),
      ).to.deep.equal({
        nonce: BN.from("0"),
        operator: "0x0000000000000000000000000000000000000000",
        token0: "0x4300000000000000000000000000000000000003",
        token1: "0x4300000000000000000000000000000000000004",
        fee: 3000,
        tickLower: -82920,
        tickUpper: -76020,
        liquidity: BN.from("33967430851279090622703"),
        feeGrowthInside0LastX128: BN.from(
          "223062771100361370800904183975351004548",
        ),
        feeGrowthInside1LastX128: BN.from(
          "63771321919466126002465612072408134",
        ),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("10"), BN.from("1499144318855151961")]);
    });
  });

  describe("Withdrawal tests", () => {
    it("Can withdrawal to tba", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureDeposited);
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("11"), BN.from("21131891579154171837")]);

      await module.moduleC_withdrawBalance().then((tx) => tx.wait());

      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([
        BN.from("206513078828369975841635"),
        BN.from("50764638839453191712"),
      ]);
      // TODO:- Check if position is burned
    });

    it("Can withdrawal to user", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureDeposited);
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("11"), BN.from("21131891579154171837")]);

      await module.moduleC_withdrawBalanceTo(user).then((tx) => tx.wait());

      expect(
        await Promise.all([USDB.balanceOf(user), WETH.balanceOf(user)]),
      ).to.deep.equal([
        BN.from("413026157656739951683271"),
        BN.from("60764638839453191712"),
      ]);
    });
  });

  describe("Partial Withdrawal test suite", () => {
    it("Can handle partial withdrawal", async () => {
      const { module, USDB, WETH, PositionManager } =
        await loadFixture(fixtureDeposited);

      expect(await USDB.balanceOf(user)).to.equal(
        BN.from("206513078828369975841636"),
      );
      expect(await WETH.balanceOf(user)).to.equal(
        BN.from("10000000000000000000"),
      );

      expect(convertToStruct(await module.position()).liquidity).to.deep.equal(
        BN.from("16983715425639545311351"),
      );
      await module.moduleC_decreaseLiquidityTo(
        BN.from("16983715425639545311351").div(2),
        user,
      );
      // Expect user balance to have increased, and liquidity decreased
      expect(convertToStruct(await module.position()).liquidity).to.deep.equal(
        BN.from("8491857712819772655676"),
      );
      expect(await USDB.balanceOf(user)).to.equal(
        BN.from("309769618242554963762453"),
      );
      expect(await WETH.balanceOf(user)).to.equal(
        BN.from("45948265209303681774"),
      );
    });
  });

  describe("Rebalance tests", () => {
    it("Can reject invalid tick range", async () => {
      const { module } = await loadFixture(fixtureDeposited);

      await expect(
        module.moduleC_rebalance({
          fee: 3000,
          router: ROUTER_ADDRESS,
          slippage: 10000,
          tickLower: -80880,
          tickUpper: -81480,
        }),
      ).to.be.revertedWith("Invalid tick range");
    });

    it("Can handle slippage rejection", async () => {
      const { module } = await loadFixture(fixtureDeposited);

      await expect(
        module.moduleC_rebalance({
          fee: 3000,
          router: ROUTER_ADDRESS,
          slippage: 1000, // 0.1%
          tickLower: -82020,
          tickUpper: -79620,
        }),
      ).to.be.revertedWith("Too little received");
    });

    it("Can rebalance with range below spot", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureDeposited);

      await module
        .moduleC_rebalance({
          fee: 3000,
          router: ROUTER_ADDRESS,
          slippage: 10000,
          tickLower: -81480,
          tickUpper: -80880,
        })
        .then((tx) => tx.wait());

      expect(convertToStruct(await module.position())).to.deep.equal({
        nonce: BN.from("0"),
        operator: "0x0000000000000000000000000000000000000000",
        token0: "0x4300000000000000000000000000000000000003",
        token1: "0x4300000000000000000000000000000000000004",
        fee: 3000,
        tickLower: -81480,
        tickUpper: -80880,
        liquidity: BN.from("220501559037418155599415"),
        feeGrowthInside0LastX128: BN.from(
          "42513878182514160766987893019469054669",
        ),
        feeGrowthInside1LastX128: BN.from(
          "13023098774273606467765194624496836",
        ),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      // Only leftover on one side
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("0")]);
    });
    it("Can rebalance with range above spot", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureDeposited);

      await module
        .moduleC_rebalance({
          fee: 3000,
          router: ROUTER_ADDRESS,
          slippage: 10000,
          tickLower: -80760,
          tickUpper: -80160,
        })
        .then((tx) => tx.wait());

      expect(convertToStruct(await module.position())).to.deep.equal({
        nonce: BN.from("0"),
        operator: "0x0000000000000000000000000000000000000000",
        token0: "0x4300000000000000000000000000000000000003",
        token1: "0x4300000000000000000000000000000000000004",
        fee: 3000,
        tickLower: -80760,
        tickUpper: -80160,
        liquidity: BN.from("220861659615030936879201"),
        feeGrowthInside0LastX128: BN.from(
          "15587114568347021521255615515708401802",
        ),
        feeGrowthInside1LastX128: BN.from("5123521478022653752891070772181702"),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      // Only leftover on one side
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("0")]);
    });

    it("Can rebalance equal", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureDeposited);
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("11"), BN.from("21131891579154171837")]);

      expect(await module.tokenId()).to.deep.equal(BN.from("54353"));

      await module
        .moduleC_rebalance({
          fee: 3000,
          router: ROUTER_ADDRESS,
          slippage: 10000,
          tickLower: -82020,
          tickUpper: -79620,
        })
        .then((tx) => tx.wait());

      expect(convertToStruct(await module.position())).to.deep.equal({
        nonce: BN.from("0"),
        operator: "0x0000000000000000000000000000000000000000",
        token0: "0x4300000000000000000000000000000000000003",
        token1: "0x4300000000000000000000000000000000000004",
        fee: 3000,
        tickLower: -82020,
        tickUpper: -79620,
        liquidity: BN.from("55739009505790607644248"),
        feeGrowthInside0LastX128: BN.from(
          "164500857552271469339101134859378297624",
        ),
        feeGrowthInside1LastX128: BN.from(
          "47566901442692672301425492992783708",
        ),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      // Only leftover on one side
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("442634440538521250")]);
    });
  });
});
