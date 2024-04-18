/* global describe it before ethers */

import hre from "hardhat";
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

describe("ConcentratedLiquidityModuleC", function () {
  let deployer: SignerWithAddress;
  let snapshot: BN;
  let signer: Signer;

  let USDB: Contract;
  let WETH: Contract;
  let module: ConcentratedLiquidityModuleC;
  let PositionManager: INonfungiblePositionManager;

  const user = "0x3E0770C75c0D5aFb1CfA3506d4b0CaB11770a27a";
  before(async function () {
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

    signer = await provider.getSigner(user);

    // Get ecosystem contracts
    USDB = await ethers.getContractAt("MockERC20", USDB_ADDRESS, signer);
    WETH = await ethers.getContractAt("MockERC20", WETH_ADDRESS, signer);
    PositionManager = await ethers.getContractAt(
      "INonfungiblePositionManager",
      THRUSTER_ADDRESS,
      signer,
    );

    module = (await deployContract(deployer, "ConcentratedLiquidityModuleC", [
      BLAST_ADDRESS,
      GAS_COLLECTOR_ADDRESS,
      BLAST_POINTS_ADDRESS,
      BLAST_POINTS_OPERATOR_ADDRESS,
    ])) as ConcentratedLiquidityModuleC;

    snapshot = await provider.send("evm_snapshot", []);

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
  });

  beforeEach(async function () {
    await provider.send("evm_revert", [snapshot]);
    snapshot = await provider.send("evm_snapshot", []); // Snapshots can only be used once
  });

  it("View functions", async function () {
    expect(await module.weth()).to.equal(WETH_ADDRESS);
    expect(await module.usdb()).to.equal(USDB_ADDRESS);
    expect(await module.thrusterManager()).to.equal(THRUSTER_ADDRESS);
  });

  it("Can deposit with WETH", async function () {
    // Wrap existing ETH to WETH, leaving some gas
    await signer
      .sendTransaction({
        to: WETH_ADDRESS,
        value: (await signer.getBalance()).sub(ethers.utils.parseEther("0.1")),
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
    await module.moduleC_depositBalance().then((tx) => tx.wait());

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

  it("Can deposit with ETH", async function () {
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
        value: (await signer.getBalance()).sub(ethers.utils.parseEther("0.1")),
      })
      .then((x) => x.wait());

    await USDB.transfer(module.address, USDB.balanceOf(user));

    await module.moduleC_depositBalance().then((tx) => tx.wait());

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

  describe("Withdrawal", () => {
    beforeEach(async () => {
      await signer
        .sendTransaction({
          to: module.address,
          value: (await signer.getBalance()).sub(
            ethers.utils.parseEther("0.1"),
          ),
        })
        .then((x) => x.wait());

      await USDB.transfer(module.address, USDB.balanceOf(user));

      await module.moduleC_depositBalance().then((tx) => tx.wait());
    });

    it("Can withdrawal to tba", async () => {
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("184016408846929722448459"), BN.from("0")]);

      await module.moduleC_withdrawBalance().then((tx) => tx.wait());

      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([
        BN.from("413026157656739951683271"),
        BN.from("60764638839453191712"),
      ]);
    });

    it("Can withdrawal to user", async () => {
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("184016408846929722448459"), BN.from("0")]);

      await module.moduleC_withdrawBalanceTo(user).then((tx) => tx.wait());

      expect(
        await Promise.all([USDB.balanceOf(user), WETH.balanceOf(user)]),
      ).to.deep.equal([
        BN.from("413026157656739951683271"),
        BN.from("60764638839453191712"),
      ]);
    });
  });
});
