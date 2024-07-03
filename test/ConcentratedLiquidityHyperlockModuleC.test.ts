/* global describe it before ethers */

import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN } from "ethers";
import chai from "chai";
const { expect } = chai;

import { price1ToTick } from "../scripts/utils/v3";
import { fixtureSetup } from "./ConcentratedLiquidityModuleC.test";
import { almostEqual, convertToStruct } from "../scripts/utils/test";

/* prettier-ignore */ const HYPERLOCK_STAKING_ADDRESS     = "0xc28EffdfEF75448243c1d9bA972b97e32dF60d06";
/* prettier-ignore */ const POOL_ADDRESS                  = "0xf00DA13d2960Cf113edCef6e3f30D92E52906537";
/* prettier-ignore */ const POSITION_MANAGER_ADDRESS      = "0x434575EaEa081b735C985FA9bf63CD7b87e227F9";
/* prettier-ignore */ const SWAP_ROUTER_ADDRESS           = "0x337827814155ECBf24D20231fCA4444F530C0555";
/* prettier-ignore */ const USDB_ADDRESS                  = "0x4300000000000000000000000000000000000003";
/* prettier-ignore */ const WETH_ADDRESS                  = "0x4300000000000000000000000000000000000004";

/* prettier-ignore */ const USER_ADDRESS                  = "0x3E0770C75c0D5aFb1CfA3506d4b0CaB11770a27a";

describe("ConcentratedLiquidityHyperlockModuleC", function () {
  const sqrtPriceX96 = BN.from("1392486909633467119786647344");

  async function fixtureDeployed() {
    const fixture = await fixtureSetup("ConcentratedLiquidityHyperlockModuleC");
    // Wrap existing ETH to WETH, leaving some gas
    await fixture.signer
      .sendTransaction({
        to: WETH_ADDRESS,
        value: "60764638839453191713",
      })
      .then((x) => x.wait());

    const hyperlock = await ethers.getContractAt(
      "IERC721PointsDeposits",
      HYPERLOCK_STAKING_ADDRESS,
    );

    return {
      ...fixture,
      hyperlock,
    };
  }

  async function fixtureDeposited() {
    const fixture = await loadFixture(fixtureDeployed);
    const { USDB, module, WETH } = fixture;

    await USDB.transfer(
      module.address,
      (await USDB.balanceOf(USER_ADDRESS)).div(2),
    );
    await WETH.transfer(
      module.address,
      (await WETH.balanceOf(USER_ADDRESS)).sub(ethers.utils.parseEther("10")),
    );

    await module
      .moduleC_mintWithBalance({
        manager: POSITION_MANAGER_ADDRESS,
        pool: POOL_ADDRESS,
        slippageLiquidity: 1_000_000,
        sqrtPriceX96,
        tickLower: -82920,
        tickUpper: -76020,
      })
      .then((tx) => tx.wait());

    return fixture;
  }

  async function fixtureWithFees() {
    const fixture = await loadFixture(fixtureDeposited);

    const whale = "0xE7cbfb8c70d423202033aD4C51CE94ce9E21CfA2";
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [whale],
    });

    const signer = await provider.getSigner(whale);
    const router = await ethers.getContractAt(
      "contracts/interfaces/external/Thruster/ISwapRouter.sol:ISwapRouter",
      SWAP_ROUTER_ADDRESS,
      signer,
    );

    const USDB = await ethers.getContractAt("MockERC20", USDB_ADDRESS, signer);
    const WETH = await ethers.getContractAt("MockERC20", WETH_ADDRESS, signer);

    await USDB.approve(router.address, ethers.constants.MaxUint256);
    await WETH.approve(router.address, ethers.constants.MaxUint256);

    // Swap back and forth to generate fees on both sides
    await router.exactInputSingle({
      amountIn: await USDB.balanceOf(whale),
      amountOutMinimum: 0,
      deadline: (await provider.getBlock("latest")).timestamp + 1000,
      fee: 3000,
      recipient: whale,
      sqrtPriceLimitX96: 0,
      tokenIn: USDB_ADDRESS,
      tokenOut: WETH_ADDRESS,
    });

    await router.exactInputSingle({
      amountIn: await WETH.balanceOf(whale),
      amountOutMinimum: 0,
      deadline: (await provider.getBlock("latest")).timestamp + 1000,
      fee: 3000,
      recipient: whale,
      sqrtPriceLimitX96: 0,
      tokenIn: WETH_ADDRESS,
      tokenOut: USDB_ADDRESS,
    });

    return fixture;
  }

  it("View initial state", async function () {
    const { module } = await loadFixture(fixtureDeployed);
    expect(await module.hyperlockStaking()).to.equal(HYPERLOCK_STAKING_ADDRESS);
    expect(await module.manager()).to.equal(POSITION_MANAGER_ADDRESS);
  });

  describe("Deposit flow", () => {
    it("Can reject invalid pool manager", async () => {
      const { module } = await loadFixture(fixtureDeployed);

      await expect(
        module.moduleC_mintWithBalance({
          manager: "0xB218e4f7cF0533d4696fDfC419A0023D33345F28", // Uniswap v3 Blast
          pool: POOL_ADDRESS,
          tickLower: -80880,
          tickUpper: -81480,
          slippageLiquidity: 1_000_000,
          sqrtPriceX96,
        }),
      ).to.be.revertedWithCustomError(module, "InvalidManagerParam");
    });

    it("Can deposit with WETH and refund", async function () {
      const { module, USDB, WETH, hyperlock, signer } =
        await loadFixture(fixtureDeployed);

      const eth = await signer.getBalance();
      // Transfer all assets to tba
      await USDB.transfer(module.address, USDB.balanceOf(USER_ADDRESS));
      await WETH.transfer(module.address, WETH.balanceOf(USER_ADDRESS));

      // Trigger the deposit
      await module
        .moduleC_mintWithBalanceAndRefundTo({
          receiver: USER_ADDRESS,
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          slippageLiquidity: 1_00_000,
          sqrtPriceX96,
          tickLower: price1ToTick(4000),
          tickUpper: price1ToTick(2000),
        })
        .then((tx) => tx.wait());

      const tokenId = await module.tokenId();

      // Position to be staked
      expect(await hyperlock.nfps(module.address, tokenId)).to.equal(true);

      // Position to be minted
      expect(convertToStruct(await module.position())).to.deep.equal({
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

      // All funds sent back to user
      almostEqual(USDB.balanceOf(module.address), BN.from("0"));
      almostEqual(WETH.balanceOf(module.address), BN.from("0"));

      almostEqual(USDB.balanceOf(USER_ADDRESS), BN.from("10"));
      almostEqual(WETH.balanceOf(USER_ADDRESS), BN.from("0"));
      almostEqual(signer.getBalance(), BN.from("1596208653441996856"));
    });
  });

  describe("Partial Deposit flow", () => {
    it("Can do partial deposit and refund", async () => {
      const { module, USDB, WETH, signer } =
        await loadFixture(fixtureDeposited);

      await WETH.transfer(module.address, WETH.balanceOf(USER_ADDRESS));
      await USDB.transfer(module.address, USDB.balanceOf(USER_ADDRESS));

      // Position to be minted
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
        feeGrowthInside1LastX128: BN.from(
          "63771321919466126002465612072408134",
        ),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      await module
        .moduleC_increaseLiquidityWithBalanceAndRefundTo(
          USER_ADDRESS,
          sqrtPriceX96,
          0,
        )
        .then((tx) => tx.wait());

      // Position to be minted
      expect(convertToStruct(await module.position())).to.deep.equal({
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

      almostEqual(USDB.balanceOf(module.address), BN.from("0"));
      almostEqual(WETH.balanceOf(module.address), BN.from("0"));

      almostEqual(USDB.balanceOf(USER_ADDRESS), BN.from("10"));
      almostEqual(WETH.balanceOf(USER_ADDRESS), BN.from("0"));
      almostEqual(signer.getBalance(), BN.from("1595691681404988370"));
    });
  });

  describe("Withdrawal tests", () => {
    it("Can withdrawal to user", async () => {
      const { module, USDB, WETH, PositionManager, signer } =
        await loadFixture(fixtureDeposited);

      almostEqual(await USDB.balanceOf(module.address), BN.from("11"));
      almostEqual(
        await WETH.balanceOf(module.address),
        BN.from("21131891579154171837"),
      );
      almostEqual(await signer.getBalance(), BN.from("97099855589811073"));

      await module
        .moduleC_fullWithdrawTo(USER_ADDRESS, sqrtPriceX96, 1_000)
        .then((tx) => tx.wait());

      almostEqual(
        USDB.balanceOf(USER_ADDRESS),
        BN.from("413026157656739951683271"),
      );
      almostEqual(
        WETH.balanceOf(USER_ADDRESS),
        BN.from("10000000000000000000"),
      );
      almostEqual(signer.getBalance(), BN.from("50861229114998159745"));

      // Expect position to be burnt
      const tokenId = await module.tokenId();
      expect(await module.tokenId()).to.equal(BN.from("0"));
      await expect(PositionManager.positions(tokenId)).to.be.revertedWith(
        "Invalid token ID",
      );
    });
  });

  describe("Collect test suite", () => {
    it("Can handle no position on collect", async () => {
      const { module } = await loadFixture(fixtureDeployed);

      await expect(
        module.moduleC_collect({
          amount0Max: BN.from("340282366920938463463374607431768211455"),
          amount1Max: BN.from("340282366920938463463374607431768211455"),
        }),
      ).to.be.revertedWithCustomError(module, "NoPositionFound");
    });

    it("Can collect unclaimed tokens to user", async () => {
      const { module, USDB, signer } = await loadFixture(fixtureWithFees);

      const usdb = await USDB.balanceOf(USER_ADDRESS);
      const eth = await signer.getBalance();

      // need to generate some fees
      await module.moduleC_collectTo(USER_ADDRESS);

      // Expect balances to have increased
      expect((await USDB.balanceOf(USER_ADDRESS)).sub(usdb)).to.equal(
        "64580542070095326831",
      );

      almostEqual(
        (await signer.getBalance()).sub(eth),
        BN.from("21150987685223178321"),
      );
    });
  });

  describe("Partial Withdrawal test suite", () => {
    it("Can handle no position on decrease", async () => {
      const { module } = await loadFixture(fixtureDeployed);

      await expect(
        module.moduleC_decreaseLiquidity({
          liquidity: BN.from("16983715425639545311351").div(2),
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await provider.getBlock("latest")).timestamp + 1000,
        }),
      ).to.be.revertedWithCustomError(module, "NoPositionFound");
    });

    it("Can handle no position on collect", async () => {
      const { module } = await loadFixture(fixtureDeployed);

      await expect(module.moduleC_burn()).to.be.revertedWithCustomError(
        module,
        "NoPositionFound",
      );
    });

    it("Can calculate decrease liquidity correctly", async () => {
      const { module, PositionManager } = await loadFixture(fixtureDeposited);

      const result = await module.callStatic.moduleC_decreaseLiquidity({
        liquidity: BN.from("16983715425639545311351").div(2),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await provider.getBlock("latest")).timestamp + 1000,
      });

      expect(result).to.deep.equal([
        BN.from("103256539414184987920806"),
        BN.from("14816373630149509937"),
      ]);

      const tokenId = module.tokenId();
      expect(result).to.deep.equal(
        await PositionManager.connect(
          "0x0000000000000000000000000000000000000000",
        ).callStatic.decreaseLiquidity({
          tokenId,
          liquidity: BN.from("16983715425639545311351").div(2),
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await provider.getBlock("latest")).timestamp + 1000,
        }),
      );
    });

    it("Can handle partial withdrawal", async () => {
      const { module, USDB, WETH, signer } =
        await loadFixture(fixtureDeposited);

      almostEqual(
        USDB.balanceOf(USER_ADDRESS),
        BN.from("206513078828369975841636"),
      );
      almostEqual(
        WETH.balanceOf(USER_ADDRESS),
        BN.from("10000000000000000000"),
      );
      almostEqual(await signer.getBalance(), BN.from("97099855589811073"));

      expect(convertToStruct(await module.position()).liquidity).to.deep.equal(
        BN.from("16983715425639545311351"),
      );
      await module.moduleC_partialWithdrawTo(
        USER_ADDRESS,
        BN.from("16983715425639545311351").div(2),
        sqrtPriceX96,
        0,
      );
      // Expect user balance to have increased, and liquidity decreased
      almostEqual(
        convertToStruct(await module.position()).liquidity,
        BN.from("8491857712819772655676"),
      );
      almostEqual(
        USDB.balanceOf(USER_ADDRESS),
        BN.from("309769618242554963762453"),
      );
      almostEqual(
        WETH.balanceOf(USER_ADDRESS),
        BN.from("10000000000000000000"),
      );
      almostEqual(signer.getBalance(), BN.from("36044963652858168591"));
    });
  });

  describe("Rebalance tests", () => {
    it("Can rebalance equal", async () => {
      const { module, USDB, WETH, pool } = await loadFixture(fixtureDeposited);
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("11"), BN.from("21131891579154171837")]);

      expect(await module.tokenId()).to.deep.equal(BN.from("54353"));

      let tx = await module.moduleC_rebalance({
        fee: 3000,
        router: SWAP_ROUTER_ADDRESS,
        slippageSwap: 10000,
        slippageLiquidity: 10_000, // 1%
        tickLower: -82020,
        tickUpper: -79620,
        sqrtPriceX96,
      })
      await expect(tx)
        .to.emit(pool, "Swap")
        .withArgs(
          SWAP_ROUTER_ADDRESS,
          module.address,
          BN.from("19902778130550452706038"),
          BN.from("-6128416111010888352"),
          BN.from("1392218601020053651155219570"),
          BN.from("1809644280222846793499326"),
          -80833,
        );

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
