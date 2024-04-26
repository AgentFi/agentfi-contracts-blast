/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;
import fs from "fs";

import { MockCallee, Test1Callee, RevertAccount, SometimesRevertAccount } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { toBytes32 } from "./../scripts/utils/setStorage";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { leftPad, rightPad } from "../scripts/utils/strings";
import { deployContract } from "../scripts/utils/deployContract";
import L1DataFeeAnalyzer from "../scripts/utils/L1DataFeeAnalyzer";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../scripts/utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;

describe("Calls", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let strategyManager: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  let mockCaller1: MockCaller1;
  let mockCaller2: MockCaller2;
  let test1Callee: Test1Callee;
  let revertAccount: SometimesRevertAccount;

  let mockCallerCallee1: Test1Callee

  let chainID: number;
  let networkSettings: any;
  let snapshot: BN;

  let l1DataFeeAnalyzer = new L1DataFeeAnalyzer();

  before(async function () {
    [deployer, owner, strategyManager, user1, user2, user3, user4, user5] = await ethers.getSigners();
    chainID = (await provider.getNetwork()).chainId;
    networkSettings = getNetworkSettings(chainID);
    if(!networkSettings.isTestnet) throw new Error("Do not run tests on production networks");
    snapshot = await provider.send("evm_snapshot", []);
    await deployer.sendTransaction({to:deployer.address}); // for some reason this helps solidity-coverage
  });

  after(async function () {
    await provider.send("evm_revert", [snapshot]);
  });

  describe("setup", function () {
    it("can deploy mock caller 1", async function () {
      mockCaller1 = await deployContract(deployer, "MockCaller", []);
      await expectDeployed(mockCaller1.address);
      l1DataFeeAnalyzer.register("deploy MockCaller", mockCaller1.deployTransaction);
    })
    it("can deploy mock caller 2", async function () {
      mockCaller2 = await deployContract(deployer, "MockCaller", []);
      await expectDeployed(mockCaller2.address);
      l1DataFeeAnalyzer.register("deploy MockCaller", mockCaller2.deployTransaction);
    })
    it("can deploy Test1Callee", async function () {
      test1Callee = await deployContract(deployer, "Test1Callee", []) as Test1Callee;
      await expectDeployed(test1Callee.address);
      l1DataFeeAnalyzer.register("deploy Test1Callee", test1Callee.deployTransaction);
    });
    it("can deploy RevertAccount", async function () {
      revertAccount = await deployContract(deployer, "SometimesRevertAccount", []) as SometimesRevertAccount;
      await expectDeployed(revertAccount.address);
      l1DataFeeAnalyzer.register("deploy SometimesRevertAccount", revertAccount.deployTransaction);
    });
    it("can get mockCallerCallee1", async function () {
      mockCallerCallee1 = await ethers.getContractAt("Test1Callee", mockCaller1.address) as Test1Callee
    });
  })

  describe("calls", function () {
    it("can call an eoa", async function () {
      await expect(mockCaller1.connect(user1).sendValue(user2.address, 0)).to.not.be.reverted
      await expect(mockCaller1.connect(user1).functionCall(user2.address, "0x")).to.not.be.reverted
      await expect(mockCaller1.connect(user1).functionCall(user2.address, "0xabcd")).to.not.be.reverted
      await expect(mockCaller1.connect(user1).functionCallWithValue(user2.address, "0x", 0)).to.not.be.reverted
      await expect(mockCaller1.connect(user1).functionCallWithValue(user2.address, "0xabcd", 0)).to.not.be.reverted
      await expect(mockCaller1.connect(user1).functionDelegateCall(user2.address, "0x")).to.not.be.reverted
      await expect(mockCaller1.connect(user1).functionDelegateCall(user2.address, "0xabcd")).to.not.be.reverted
    })
    it("can call a contract", async function () {
      var p = mockCaller1.connect(user1).sendValue(test1Callee.address, 0)
      await expect(p).to.not.be.reverted
      await expect(p).to.emit(test1Callee, "Test1Event").withArgs(999)

      var p = mockCaller1.connect(user1).functionCall(test1Callee.address, "0x")
      await expect(p).to.not.be.reverted
      await expect(p).to.emit(test1Callee, "Test1Event").withArgs(999)

      var calldata = test1Callee.interface.encodeFunctionData("testFunc1")

      var p = mockCaller1.connect(user1).functionCall(test1Callee.address, calldata)
      await expect(p).to.not.be.reverted
      await expect(p).to.emit(test1Callee, "Test1Event").withArgs(1)

      var p = mockCaller1.connect(user1).functionCallWithValue(test1Callee.address, "0x", 0)
      await expect(p).to.not.be.reverted
      await expect(p).to.emit(test1Callee, "Test1Event").withArgs(999)

      var p = mockCaller1.connect(user1).functionCallWithValue(test1Callee.address, calldata, 0)
      await expect(p).to.not.be.reverted
      await expect(p).to.emit(test1Callee, "Test1Event").withArgs(1)

      var p = mockCaller1.connect(user1).functionDelegateCall(test1Callee.address, "0x")
      await expect(p).to.not.be.reverted
      await expect(p).to.emit(mockCallerCallee1, "Test1Event").withArgs(999)

      var p = mockCaller1.connect(user1).functionDelegateCall(test1Callee.address, calldata)
      await expect(p).to.not.be.reverted
      await expect(p).to.emit(mockCallerCallee1, "Test1Event").withArgs(1)
    })
    it("cannot call with insuffient funds pt 1", async function () {
      await expect(mockCaller1.connect(user1).sendValue(user2.address, 1)).to.be.revertedWithCustomError(mockCaller1, "InsufficientBalance")
      await expect(mockCaller1.connect(user1).functionCallWithValue(user2.address, "0x", 1)).to.be.revertedWithCustomError(mockCaller1, "InsufficientBalance")
      await expect(mockCaller1.connect(user1).functionCallWithValue(user2.address, "0xabcd", 1)).to.be.revertedWithCustomError(mockCaller1, "InsufficientBalance")
    })
    it("cannot call with insuffient funds pt 2", async function () {
      let depositAmount = WeiPerEther
      let transferAmount = depositAmount.add(1)
      await expect(mockCaller1.connect(user1).sendValue(user2.address, transferAmount, {value: depositAmount})).to.be.revertedWithCustomError(mockCaller1, "InsufficientBalance")
      await expect(mockCaller1.connect(user1).functionCallWithValue(user2.address, "0x", transferAmount, {value: depositAmount})).to.be.revertedWithCustomError(mockCaller1, "InsufficientBalance")
      await expect(mockCaller1.connect(user1).functionCallWithValue(user2.address, "0xabcd", transferAmount, {value: depositAmount})).to.be.revertedWithCustomError(mockCaller1, "InsufficientBalance")
    })
    it("cannot call with insuffient funds pt 3", async function () {
      let depositAmount = WeiPerEther
      let transferAmount = depositAmount.add(1)
      await user1.sendTransaction({to: mockCaller1.address, value: depositAmount})
      await expect(mockCaller1.connect(user1).sendValue(user2.address, transferAmount)).to.be.revertedWithCustomError(mockCaller1, "InsufficientBalance")
      await expect(mockCaller1.connect(user1).functionCallWithValue(user2.address, "0x", transferAmount)).to.be.revertedWithCustomError(mockCaller1, "InsufficientBalance")
      await expect(mockCaller1.connect(user1).functionCallWithValue(user2.address, "0xabcd", transferAmount)).to.be.revertedWithCustomError(mockCaller1, "InsufficientBalance")
    })
    it("can call and transfer eth pt 1", async function () {
      let transferAmount = 200
      await expect(mockCaller1.connect(user1).sendValue(user2.address, transferAmount)).to.not.be.reverted
      await expect(mockCaller1.connect(user1).functionCallWithValue(user2.address, "0x", transferAmount)).to.not.be.reverted
      await expect(mockCaller1.connect(user1).functionCallWithValue(user2.address, "0xabcd", transferAmount)).to.not.be.reverted
    })
    it("can call and transfer eth pt 2", async function () {
      let depositAmount = 300
      let transferAmount = 200
      await expect(mockCaller1.connect(user1).sendValue(user2.address, transferAmount, {value: depositAmount})).to.not.be.reverted
      await expect(mockCaller1.connect(user1).functionCallWithValue(user2.address, "0x", transferAmount, {value: depositAmount})).to.not.be.reverted
      await expect(mockCaller1.connect(user1).functionCallWithValue(user2.address, "0xabcd", transferAmount, {value: depositAmount})).to.not.be.reverted
    })
    it("reverts if the called contract reverts pt 1", async function () {
      await revertAccount.setRevertMode(1)
      await expect(mockCaller1.connect(user1).sendValue(revertAccount.address, 0)).to.be.reverted
      await expect(mockCaller1.connect(user1).functionCall(revertAccount.address, "0x")).to.be.reverted
      await expect(mockCaller1.connect(user1).functionCall(revertAccount.address, "0xabcd")).to.be.reverted
      await expect(mockCaller1.connect(user1).functionCallWithValue(revertAccount.address, "0x", 0)).to.be.reverted
      await expect(mockCaller1.connect(user1).functionCallWithValue(revertAccount.address, "0xabcd", 0)).to.be.reverted
      let calldata = revertAccount.interface.encodeFunctionData("setRevertMode", [1])
      await mockCaller1.functionDelegateCall(revertAccount.address, calldata)
      await expect(mockCaller1.connect(user1).functionDelegateCall(revertAccount.address, "0x")).to.be.reverted
      await expect(mockCaller1.connect(user1).functionDelegateCall(revertAccount.address, "0xabcd")).to.be.reverted
    })
    it("reverts if the called contract reverts pt 2", async function () {
      await revertAccount.setRevertMode(2)
      await expect(mockCaller1.connect(user1).sendValue(revertAccount.address, 0)).to.be.revertedWithCustomError(revertAccount, "UnknownError")
      await expect(mockCaller1.connect(user1).functionCall(revertAccount.address, "0x")).to.be.revertedWithCustomError(revertAccount, "UnknownError")
      await expect(mockCaller1.connect(user1).functionCall(revertAccount.address, "0xabcd")).to.be.revertedWithCustomError(revertAccount, "UnknownError")
      await expect(mockCaller1.connect(user1).functionCallWithValue(revertAccount.address, "0x", 0)).to.be.revertedWithCustomError(revertAccount, "UnknownError")
      await expect(mockCaller1.connect(user1).functionCallWithValue(revertAccount.address, "0xabcd", 0)).to.be.revertedWithCustomError(revertAccount, "UnknownError")
      let calldata = revertAccount.interface.encodeFunctionData("setRevertMode", [2])
      await mockCaller1.functionDelegateCall(revertAccount.address, calldata)
      await expect(mockCaller1.connect(user1).functionDelegateCall(revertAccount.address, "0x")).to.be.revertedWithCustomError(revertAccount, "UnknownError")
      await expect(mockCaller1.connect(user1).functionDelegateCall(revertAccount.address, "0xabcd")).to.be.revertedWithCustomError(revertAccount, "UnknownError")
    })
    it("reverts if the called contract reverts pt 3", async function () {
      await revertAccount.setRevertMode(3)
      await expect(mockCaller1.connect(user1).sendValue(revertAccount.address, 0)).to.be.revertedWith("generic error")
      await expect(mockCaller1.connect(user1).functionCall(revertAccount.address, "0x")).to.be.revertedWith("generic error")
      await expect(mockCaller1.connect(user1).functionCall(revertAccount.address, "0xabcd")).to.be.revertedWith("generic error")
      await expect(mockCaller1.connect(user1).functionCallWithValue(revertAccount.address, "0x", 0)).to.be.revertedWith("generic error")
      await expect(mockCaller1.connect(user1).functionCallWithValue(revertAccount.address, "0xabcd", 0)).to.be.revertedWith("generic error")
      let calldata = revertAccount.interface.encodeFunctionData("setRevertMode", [3])
      await mockCaller1.functionDelegateCall(revertAccount.address, calldata)
      await expect(mockCaller1.connect(user1).functionDelegateCall(revertAccount.address, "0x")).to.be.revertedWith("generic error")
      await expect(mockCaller1.connect(user1).functionDelegateCall(revertAccount.address, "0xabcd")).to.be.revertedWith("generic error")
    })
  })

  describe("verifyHasCode", function () {
    it("passes if calling a contract", async function () {
      await expect(mockCaller1.connect(user1).verifyHasCode(test1Callee.address)).to.not.be.reverted
    })
    it("reverts if calling an EOA", async function () {
      await expect(mockCaller1.connect(user1).verifyHasCode(user2.address)).to.be.revertedWithCustomError(mockCaller1, "NotAContract")
    })
  });

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});
