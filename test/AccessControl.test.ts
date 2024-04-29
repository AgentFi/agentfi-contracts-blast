/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;
import fs from "fs";

import { MockAccessControl } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { toBytes32 } from "./../scripts/utils/setStorage";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { leftPad, rightPad } from "../scripts/utils/strings";
import { deployContract } from "../scripts/utils/deployContract";
import L1DataFeeAnalyzer from "../scripts/utils/L1DataFeeAnalyzer";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../scripts/utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;

const STRATEGY_MANAGER_ROLE = "0x4170d100a3a3728ae51207936ee755ecaa64a7f6e9383c642ab204a136f90b1b";
const GAS_COLLECTOR_ROLE    = "0x18038a9d697cd0f00d74a657f4f375c0699115440db9cf1d8d28d3bcb609624c";

describe("AccessControl", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let strategyManager: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  let mockAccessControl: MockAccessControl;

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
    it("can deploy mock access control", async function () {
      mockAccessControl = await deployContract(deployer, "MockAccessControl", []);
      await expectDeployed(mockAccessControl.address);
      l1DataFeeAnalyzer.register("deploy MockAccessControl", mockAccessControl.deployTransaction);
    })
  })

  describe("access control", function () {
    it("begins with no roles", async function () {
      expect(await mockAccessControl.hasRole(toBytes32(0), AddressZero)).eq(false)
      expect(await mockAccessControl.hasRole(toBytes32(0), user1.address)).eq(false)
      expect(await mockAccessControl.hasRole(toBytes32(1), AddressZero)).eq(false)
      expect(await mockAccessControl.hasRole(toBytes32(1), user1.address)).eq(false)
      expect(await mockAccessControl.hasRole(STRATEGY_MANAGER_ROLE, AddressZero)).eq(false)
      expect(await mockAccessControl.hasRole(STRATEGY_MANAGER_ROLE, user1.address)).eq(false)
    })
    it("validates roles pt 1", async function () {
      await expect(mockAccessControl.connect(user1).validateHasRole(toBytes32(0), AddressZero)).to.be.revertedWithCustomError(mockAccessControl, "NotAuthorized")
      await expect(mockAccessControl.connect(user1).validateHasRole(toBytes32(0), user1.address)).to.be.revertedWithCustomError(mockAccessControl, "NotAuthorized")
      await expect(mockAccessControl.connect(user1).validateHasRole(toBytes32(1), AddressZero)).to.be.revertedWithCustomError(mockAccessControl, "NotAuthorized")
      await expect(mockAccessControl.connect(user1).validateHasRole(toBytes32(1), user1.address)).to.be.revertedWithCustomError(mockAccessControl, "NotAuthorized")
      await expect(mockAccessControl.connect(user1).validateHasRole(STRATEGY_MANAGER_ROLE, AddressZero)).to.be.revertedWithCustomError(mockAccessControl, "NotAuthorized")
      await expect(mockAccessControl.connect(user1).validateHasRole(STRATEGY_MANAGER_ROLE, user1.address)).to.be.revertedWithCustomError(mockAccessControl, "NotAuthorized")
    })
    it("can set roles", async function () {
      let setRoleParams = [
        {
          role: toBytes32(1),
          account: user1.address,
          grantAccess: true,
        },
        {
          role: toBytes32(2),
          account: user2.address,
          grantAccess: false,
        },
        {
          role: STRATEGY_MANAGER_ROLE,
          account: strategyManager.address,
          grantAccess: true,
        },
      ]
      let tx = await mockAccessControl.connect(user2).setRoles(setRoleParams)
      for(let i = 0; i < setRoleParams.length; ++i) {
        let { role, account, grantAccess } = setRoleParams[i]
        expect(await mockAccessControl.hasRole(role, account)).eq(grantAccess)
        await expect(tx).to.emit(mockAccessControl, "RoleAccessChanged").withArgs(role, account, grantAccess);
        if(grantAccess) {
          await expect(mockAccessControl.connect(user1).validateHasRole(role, account)).to.not.be.reverted
        } else {
          await expect(mockAccessControl.connect(user1).validateHasRole(role, account)).to.be.revertedWithCustomError(mockAccessControl, "NotAuthorized")
        }
      }
    })
  });

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});
