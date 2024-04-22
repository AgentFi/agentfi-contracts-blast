/* global describe it before ethers */

import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, Contract, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect } = chai;

import {
  ConcentratedLiquidityModuleC,
  INonfungiblePositionManager,
} from "../typechain-types";

import { deployContract } from "../scripts/utils/deployContract";
import {
  priceInverseToTick,
  sqrtPriceX96ToPriceInverse,
  tickToPrice,
} from "../scripts/utils/concetratedLiquidityPools";

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
/* prettier-ignore */ const POOL_ADDRESS                  = "0xf00da13d2960cf113edcef6e3f30d92e52906537";

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

    expect(
      await Promise.all([
        provider.getBalance(user),
        USDB.balanceOf(user),
        WETH.balanceOf(user),
      ]),
    ).to.deep.equal([
      BN.from("60864638839453191713"),
      BN.from("413026157656739951683272"),
      BN.from("0"),
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
    const { signer, USDB, module } = fixture;

    await signer
      .sendTransaction({
        to: module.address,
        value: (await signer.getBalance()).sub(ethers.utils.parseEther("10")),
      })
      .then((x) => x.wait());

    await USDB.transfer(module.address, (await USDB.balanceOf(user)).div(2));

    await module.moduleC_depositBalance(-82920, -76020).then((tx) => tx.wait());

    return fixture;
  }

  it("Verify initial pool state", async () => {
    const { pool } = await loadFixture(fixtureDeployed);

    const [sqrtPriceX96, tick] = await pool.slot0();
    const price = sqrtPriceX96ToPriceInverse(BigInt(sqrtPriceX96.toString()));

    expect(sqrtPriceX96).to.equal(BN.from("1392486909633467119786647344"));
    expect(tick).to.equal(BN.from("-80829"));

    expect(1 / tickToPrice(tick)).to.equal(3237.303088069362);
    expect(price).to.equal(3236.9999999999995);
  });

  it("View functions", async function () {
    const { module } = await loadFixture(fixtureDeployed);
    expect(await module.token0()).to.equal(USDB_ADDRESS);
    expect(await module.token1()).to.equal(WETH_ADDRESS);
    expect(await module.thrusterManager()).to.equal(THRUSTER_ADDRESS);
  });

  describe("Deposit flow", () => {
    it("Can reject deposit when position exists", async function () {
      const { module, USDB, WETH, signer } =
        await loadFixture(fixtureDeposited);
      // Wrap existing ETH to WETH, leaving some gas
      await signer
        .sendTransaction({
          to: WETH_ADDRESS,
          value: (await signer.getBalance()).sub(
            ethers.utils.parseEther("0.1"),
          ),
        })
        .then((x) => x.wait());
      // Transfer all assets to tba
      await USDB.transfer(module.address, USDB.balanceOf(user));
      await WETH.transfer(module.address, WETH.balanceOf(user));

      expect(await module.tokenId()).to.deep.equal(BN.from("54353"));
      // Trigger the deposit
      await expect(
        module.moduleC_depositBalance(
          priceInverseToTick(4000),
          priceInverseToTick(2000),
        ),
      ).to.be.revertedWith("Cannot deposit with existing position");
    });

    it("Can deposit with WETH", async function () {
      const { module, signer, USDB, WETH, PositionManager } =
        await loadFixture(fixtureDeployed);
      // Wrap existing ETH to WETH, leaving some gas
      await signer
        .sendTransaction({
          to: WETH_ADDRESS,
          value: (await signer.getBalance()).sub(
            ethers.utils.parseEther("0.1"),
          ),
        })
        .then((x) => x.wait());

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
        .moduleC_depositBalance(
          priceInverseToTick(4000),
          priceInverseToTick(2000),
        )
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

    it("Can deposit with ETH", async function () {
      const { module, signer, USDB, WETH, PositionManager } =
        await loadFixture(fixtureDeployed);
      expect(
        await Promise.all([
          provider.getBalance(module.address),
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("0"), BN.from("0")]);

      await signer
        .sendTransaction({
          to: module.address,
          value: (await signer.getBalance()).sub(
            ethers.utils.parseEther("0.1"),
          ),
        })
        .then((x) => x.wait());

      await USDB.transfer(module.address, USDB.balanceOf(user));

      await module
        .moduleC_depositBalance(-120000, 120000)
        .then((tx) => tx.wait());

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
        tickLower: -120000,
        tickUpper: 120000,
        liquidity: BN.from("4025171919278639863411"),
        feeGrowthInside0LastX128: BN.from("0"),
        feeGrowthInside1LastX128: BN.from("0"),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });
      // Only leftover on one side
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("184016408846929722448459"), BN.from("0")]);
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
      ).to.deep.equal([BN.from("11"), BN.from("21231891579154171837")]);

      await module.moduleC_withdrawBalance().then((tx) => tx.wait());

      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([
        BN.from("206513078828369975841635"),
        BN.from("50864638839453191712"),
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
      ).to.deep.equal([BN.from("11"), BN.from("21231891579154171837")]);

      await module.moduleC_withdrawBalanceTo(user).then((tx) => tx.wait());

      expect(
        await Promise.all([USDB.balanceOf(user), WETH.balanceOf(user)]),
      ).to.deep.equal([
        BN.from("413026157656739951683271"),
        BN.from("50864638839453191712"),
      ]);
    });
  });

  describe("Rebalance tests", () => {
    it("Can rebalance", async () => {
      const { module, USDB, WETH, PositionManager } =
        await loadFixture(fixtureDeposited);
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("11"), BN.from("21231891579154171837")]);

      expect(await module.tokenId()).to.deep.equal(BN.from("54353"));

      await module.moduleC_rebalance(-82020, -79620).then((tx) => tx.wait());

      const tokenId = await module.tokenId();
      expect(tokenId).to.deep.equal(BN.from("54354"));

      expect(
        convertToStruct(await PositionManager.positions(tokenId)),
      ).to.deep.equal({
        nonce: BN.from("0"),
        operator: "0x0000000000000000000000000000000000000000",
        token0: "0x4300000000000000000000000000000000000003",
        token1: "0x4300000000000000000000000000000000000004",
        fee: 3000,
        tickLower: -82020,
        tickUpper: -79620,
        liquidity: BN.from("55789561140592772627816"),
        feeGrowthInside0LastX128: BN.from(
          "164500795801821406778118883407508699361",
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
      ).to.deep.equal([BN.from("2"), BN.from("439329881056695054")]);
    });
  });
});
