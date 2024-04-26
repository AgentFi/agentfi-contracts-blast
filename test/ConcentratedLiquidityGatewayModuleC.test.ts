/* global describe it before ethers */

import hre from "hardhat";
import {
  loadFixture,
  setBalance,
} from "@nomicfoundation/hardhat-network-helpers";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN } from "ethers";
import chai from "chai";
const { expect } = chai;

import { fixtureSetup } from "./ConcentratedLiquidityModuleC.test";

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

/* prettier-ignore */ const USDB_ADDRESS                  = "0x4300000000000000000000000000000000000003";
/* prettier-ignore */ const WETH_ADDRESS                  = "0x4300000000000000000000000000000000000004";
/* prettier-ignore */ const THRUSTER_ADDRESS              = "0x434575EaEa081b735C985FA9bf63CD7b87e227F9";
/* prettier-ignore */ const ROUTER_ADDRESS                = "0x337827814155ECBf24D20231fCA4444F530C0555";

const user = "0x3E0770C75c0D5aFb1CfA3506d4b0CaB11770a27a";
describe("ConcentratedLiquidityGatewayModuleC", function () {
  async function fixtureDeployed() {
    const fixture = await fixtureSetup("ConcentratedLiquidityGatewayModuleC");

    const { USDB, WETH } = fixture;

    // Set ETH balance for consistency. Number set to not break previous tests
    await setBalance(user, BN.from("60864638839453191713"));

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

    return fixture;
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

    await module
      .moduleC_mintBalance({
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

  async function fixtureWithFees() {
    const fixture = await loadFixture(fixtureDeposited);

    const whale = "0xE7cbfb8c70d423202033aD4C51CE94ce9E21CfA2";
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [whale],
    });

    const signer = await provider.getSigner(whale);
    const router = await ethers.getContractAt(
      "ISwapRouter",
      ROUTER_ADDRESS,
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

  describe("Deposit flow", () => {
    it("Can deposit with ETH", async function () {
      const { module, signer, USDB, WETH, PositionManager } =
        await loadFixture(fixtureDeployed);

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
        .moduleC_mintBalance({
          manager: THRUSTER_ADDRESS,
          tickLower: -120000,
          tickUpper: 120000,
          fee: 3000,
          token0: USDB_ADDRESS,
          token1: WETH_ADDRESS,
        })
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

  describe("Partial Deposit flow", () => {
    it("Rejects partial deposit when no position exists", async () => {
      const { module, USDB, signer } = await loadFixture(fixtureDeployed);

      // Sent remaining ETH, leaving some gas
      await signer
        .sendTransaction({
          to: module.address,
          value: (await signer.getBalance()).sub(
            ethers.utils.parseEther("0.1"),
          ),
        })
        .then((x) => x.wait());
      await USDB.transfer(module.address, USDB.balanceOf(user));

      await expect(
        module.moduleC_increaseLiquidityWithBalance(),
      ).to.be.revertedWith("No existing position to view");
    });

    it("Can do partial deposit", async () => {
      const { module, USDB, WETH, signer, PositionManager } =
        await loadFixture(fixtureDeposited);
      // Send remaining ETH, leaving some gas
      await signer
        .sendTransaction({
          to: module.address,
          value: (await signer.getBalance()).sub(
            ethers.utils.parseEther("0.1"),
          ),
        })
        .then((x) => x.wait());
      await USDB.transfer(module.address, USDB.balanceOf(user));

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
        .moduleC_increaseLiquidityWithBalance()
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

      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("10"), BN.from("1498283203757878153")]);
    });
  });

  describe("Collect test suite", () => {
    it("Can collect unclaimed tokens to user", async () => {
      const { module, USDB, signer } = await loadFixture(fixtureWithFees);

      const usdb = await USDB.balanceOf(user);
      const eth = await signer.getBalance();

      // need to generate some fees
      await module.moduleC_collectTo(user);

      // Expect balances to have increased
      expect((await USDB.balanceOf(user)).sub(usdb)).to.equal(
        BN.from("64580542070095326831"),
      );

      expect((await signer.getBalance()).sub(eth)).to.equal(
        BN.from("21250989393221687528"),
      );
    });
  });
  describe("Withdrawal tests", () => {
    it("Can withdrawal to user", async () => {
      const { module, USDB, WETH, signer } =
        await loadFixture(fixtureDeposited);
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("11"), BN.from("21231891579154171837")]);

      await module.moduleC_withdrawBalanceTo(user).then((tx) => tx.wait());

      expect(
        await Promise.all([
          signer.getBalance(),
          USDB.balanceOf(user),
          WETH.balanceOf(user),
        ]),
      ).to.deep.equal([
        BN.from("60863382671317597763"),
        BN.from("413026157656739951683271"),
        BN.from("0"),
      ]);
    });
  });

  describe("Partial Withdrawal test suite", () => {
    it("Can handle partial withdrawal", async () => {
      const { module, USDB, WETH, signer } =
        await loadFixture(fixtureDeposited);

      expect(await USDB.balanceOf(user)).to.equal(
        BN.from("206513078828369975841636"),
      );
      expect(await WETH.balanceOf(user)).to.equal(BN.from("0"));

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
      expect(await signer.getBalance()).to.equal(
        BN.from("46047030489170168281"),
      );
      expect(await USDB.balanceOf(user)).to.equal(
        BN.from("309769618242554963762453"),
      );
      expect(await WETH.balanceOf(user)).to.equal(BN.from("0"));
    });
  });
});
