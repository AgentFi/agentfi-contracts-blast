/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;

import { MockAccount, MockStrategyAccount, IERC6551Registry, MockERC20, MockERC721 } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { deployContract } from "../scripts/utils/deployContract";
import { toBytes32 } from "../scripts/utils/strings";

const { ZeroAddress, WeiPerEther, MaxUint256 } = ethers
const WeiPerUsdc = 1_000_000n

const ERC6551_REGISTRY_ADDRESS = "0x000000006551c19487814612e58FE06813775758";

describe("MockAccount", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  let entryPoint = "0x6900000000000000000000000000000000000001";
  let forwarder  = "0x6900000000000000000000000000000000000002";
  let guardian   = "0x6900000000000000000000000000000000000003";
  let another    = "0x6900000000000000000000000000000000000004";

  let nft: MockERC721;

  let accountImplementation1: MockAccount;
  let tba1: MockAccount;

  let accountImplementation2: MockStrategyAccount;
  let tba2: MockStrategyAccount;

  let chainID: number;
  let networkSettings: any;
  let snapshot: BN;

  before(async function () {
    [deployer, owner, user1, user2, user3, user4, user5] = await ethers.getSigners();
    chainID = (await provider.getNetwork()).chainId;
    networkSettings = getNetworkSettings(chainID);
    if(!networkSettings.isTestnet) throw new Error("Do not run tests on production networks");
    snapshot = await provider.send("evm_snapshot", []);
    await deployer.sendTransaction({to:deployer.address}); // for some reason this helps solidity-coverage

    await expectDeployed(ERC6551_REGISTRY_ADDRESS); // expect to be run on a fork of a testnet with registry deployed
  });

  after(async function () {
    await provider.send("evm_revert", [snapshot]);
  });

  describe("MockAccount setup", function () {
    let tokenID = 1
    it("can deploy account implementation", async function () {
      let args = [entryPoint, forwarder, ERC6551_REGISTRY_ADDRESS, guardian, another]
      accountImplementation1 = await deployContract(deployer, "MockAccount", args) as MockAccount;
      await expectDeployed(accountImplementation1.address);
      expect(await accountImplementation1.entryPoint()).eq(entryPoint)
      expect(await accountImplementation1.erc6551Registry()).eq(ERC6551_REGISTRY_ADDRESS)
      expect(await accountImplementation1.getGuardian()).eq(guardian)
      expect(await accountImplementation1.getSelf()).eq(accountImplementation1.address)
      expect(await accountImplementation1.getAddressThis()).eq(accountImplementation1.address)
      expect(await accountImplementation1.getAnotherAddress()).eq(another)
      expect(await accountImplementation1.getSomeValue()).eq(0)
    });
    it("can deploy erc721", async function () {
      let args = ["Test Token", "TEST"]
      nft = await deployContract(deployer, "MockERC721", args) as MockERC721;
      await expectDeployed(nft.address);
      await nft.mint(user1.address, tokenID)
    });
    it("can deploy tba1", async function () {
      let registry = await ethers.getContractAt("IERC6551Registry", ERC6551_REGISTRY_ADDRESS, user1) as IERC6551Registry;
      let tx = await registry.createAccount(accountImplementation1.address, toBytes32(0), 31337, nft.address, tokenID)
      let receipt = await tx.wait()
      //console.log(tx)
      //console.log(receipt)
      //console.log(receipt.logs)
      //console.log(receipt.events)
      let createEvents = receipt.logs.filter(log => log.address == ERC6551_REGISTRY_ADDRESS)
      let tba1Address = createEvents[0].args[0]
      //console.log('tba1')
      //console.log(tba1Address)
      await expectDeployed(tba1Address);

      tba1 = await ethers.getContractAt("MockAccount", tba1Address, user1) as MockAccount;
      await expectDeployed(tba1.target);

      expect(await tba1.entryPoint()).eq(entryPoint)
      expect(await tba1.erc6551Registry()).eq(ERC6551_REGISTRY_ADDRESS)
      expect(await tba1.getGuardian()).eq(guardian)
      expect(await tba1.getSelf()).eq(accountImplementation1.target)
      expect(await tba1.getAddressThis()).eq(tba1.target)
      expect(await tba1.getAnotherAddress()).eq(another)
      expect(await tba1.getSomeValue()).eq(0)
    });
  });

  describe("MockAccount ownership", function () {
    let tokenID = 1
    it("tba1 owner is nft owner", async function () {
      expect(await nft.ownerOf(tokenID)).eq(user1.address);
      expect(await tba1.owner()).eq(user1.address);
    });
    it("owner can execute", async function () {
      let state1 = await tba1.state();
      await tba1.connect(user1).execute(user3.address, 0, "0x", 0);
      let state2 = await tba1.state();
      expect(state2).not.eq(state1)
    });
    it("is tied to nft owner", async function () {
      expect(await nft.ownerOf(tokenID)).eq(user1.address);
      expect(await tba1.owner()).eq(user1.address);
      await nft.connect(user1).transferFrom(user1.address, user2.address, tokenID);
      expect(await nft.ownerOf(tokenID)).eq(user2.address);
      expect(await tba1.owner()).eq(user2.address);
    });
    it("old owner cannot execute", async function () {
      await expect(tba1.connect(user1).execute(user1.address, 0, "0x", 0)).to.be.revertedWithCustomError(tba1, "NotAuthorized");
      await expect(tba1.connect(user1).setSomeValue(1)).to.be.revertedWithCustomError(tba1, "NotAuthorized");
    });
    it("new owner can execute", async function () {
      let state1 = await tba1.state();
      await tba1.connect(user2).execute(user3.address, 0, "0x", 0);
      let state2 = await tba1.state();
      expect(state2).not.eq(state1)

      await tba1.connect(user2).setSomeValue(1)
      expect(await tba1.getSomeValue()).eq(1)
      let state3 = await tba1.state();
      expect(state3).not.eq(state1)
      expect(state3).not.eq(state2)
    });
    it("is tied to nft owner pt 2", async function () {
      expect(await nft.ownerOf(tokenID)).eq(user2.address);
      expect(await tba1.owner()).eq(user2.address);
      await nft.connect(user2).transferFrom(user2.address, user1.address, tokenID);
      expect(await nft.ownerOf(tokenID)).eq(user1.address);
      expect(await tba1.owner()).eq(user1.address);
    });
  });

  describe("MockStrategyAccount setup", function () {
    let tokenID = 2
    it("can deploy account implementation", async function () {
      let args = [entryPoint, forwarder, ERC6551_REGISTRY_ADDRESS, guardian]
      accountImplementation2 = await deployContract(deployer, "MockStrategyAccount", args) as MockStrategyAccount;
      await expectDeployed(accountImplementation2.address);
      expect(await accountImplementation2.entryPoint()).eq(entryPoint)
      expect(await accountImplementation2.erc6551Registry()).eq(ERC6551_REGISTRY_ADDRESS)
      expect(await accountImplementation2.getGuardian()).eq(guardian)
      expect(await accountImplementation2.getImplementation()).eq(accountImplementation2.address)
    });
    it("can deploy erc721", async function () {
      await nft.mint(user1.address, tokenID)
    });
    it("can deploy tba2", async function () {
      let registry = await ethers.getContractAt("IERC6551Registry", ERC6551_REGISTRY_ADDRESS, user1) as IERC6551Registry;
      let tx = await registry.createAccount(accountImplementation2.address, toBytes32(0), 31337, nft.address, tokenID)
      let receipt = await tx.wait()
      //console.log(tx)
      //console.log(receipt)
      //console.log(receipt.logs)
      //console.log(receipt.events)
      let createEvents = receipt.logs.filter(log => log.address == ERC6551_REGISTRY_ADDRESS)
      let tba2Address = createEvents[0].args[0]
      //console.log('tba2')
      //console.log(tba2Address)
      await expectDeployed(tba2Address);

      tba2 = await ethers.getContractAt("MockStrategyAccount", tba2Address, user1) as MockStrategyAccount;
      await expectDeployed(tba2.target);

      expect(await tba2.entryPoint()).eq(entryPoint)
      expect(await tba2.erc6551Registry()).eq(ERC6551_REGISTRY_ADDRESS)
      expect(await tba2.getGuardian()).eq(guardian)
      expect(await tba2.getImplementation()).eq(accountImplementation2.target)
    });
  });

  describe("MockStrategyAccount ownership", function () {
    let tokenID = 2
    it("tba2 owner is nft owner", async function () {
      expect(await nft.ownerOf(tokenID)).eq(user1.address);
      expect(await tba2.owner()).eq(user1.address);
    });
    it("owner can execute", async function () {
      let state1 = await tba2.state();
      await tba2.connect(user1).execute(user3.address, 0, "0x", 0);
      let state2 = await tba2.state();
      expect(state2).not.eq(state1)
    });
    it("is tied to nft owner", async function () {
      expect(await nft.ownerOf(tokenID)).eq(user1.address);
      expect(await tba2.owner()).eq(user1.address);
      await nft.connect(user1).transferFrom(user1.address, user2.address, tokenID);
      expect(await nft.ownerOf(tokenID)).eq(user2.address);
      expect(await tba2.owner()).eq(user2.address);
    });
    it("old owner cannot execute", async function () {
      await expect(tba2.connect(user1).execute(user1.address, 0, "0x", 0)).to.be.revertedWithCustomError(tba2, "NotAuthorized");
    });
    it("new owner can execute", async function () {
      let state1 = await tba2.state();
      await tba2.connect(user2).execute(user3.address, 0, "0x", 0);
      let state2 = await tba2.state();
      expect(state2).not.eq(state1)
    });
    it("is tied to nft owner pt 2", async function () {
      expect(await nft.ownerOf(tokenID)).eq(user2.address);
      expect(await tba2.owner()).eq(user2.address);
      await nft.connect(user2).transferFrom(user2.address, user1.address, tokenID);
      expect(await nft.ownerOf(tokenID)).eq(user1.address);
      expect(await tba2.owner()).eq(user1.address);
    });
  });

  describe("MockStrategyAccount access control", function () {
    let tokenID = 2
    let STRATEGY_MANAGER_ROLE = ethers.id("STRATEGY_MANAGER_ROLE")
    // '0x4170d100a3a3728ae51207936ee755ecaa64a7f6e9383c642ab204a136f90b1b'
    let OTHER_ROLE = ethers.id("OTHER_ROLE")

    it("can get role hash", async function () {
      let role1 = await accountImplementation2.STRATEGY_MANAGER_ROLE()
      expect(role1).eq(STRATEGY_MANAGER_ROLE)
      let role2 = await tba2.STRATEGY_MANAGER_ROLE()
      expect(role2).eq(STRATEGY_MANAGER_ROLE)
    });
    it("non permissioned cannot manage strategy", async function () {
      await expect(tba2.connect(user2).manageStrategy(5)).to.be.revertedWithCustomError(tba2, "NotAuthorized")
    });
    it("owner can manage strategy", async function () {
      let state1 = await tba2.state();
      let tx = await tba2.connect(user1).manageStrategy(7);
      await expect(tx).to.emit(tba2, "StrategyManaged").withArgs(7);
      let state2 = await tba2.state();
      expect(state2).not.eq(state1)
    });
    it("starts with no assigned roles", async function () {
      expect(await tba2.hasRole(STRATEGY_MANAGER_ROLE, user2.address)).eq(false)
    });
    it("non owner cannot assign roles", async function () {
      await expect(tba2.connect(user2).setRoles([])).to.be.revertedWithCustomError(tba2, "NotAuthorized")
    });
    it("owner can assign roles", async function () {
      let roles = [
        {
          role: STRATEGY_MANAGER_ROLE,
          account: user2.address,
          grantAccess: true,
        },
        {
          role: OTHER_ROLE,
          account: user3.address,
          grantAccess: true,
        },
        {
          role: OTHER_ROLE,
          account: user4.address,
          grantAccess: false,
        },
      ]
      let tx = await tba2.connect(user1).setRoles(roles)
      for(const rolex of roles) {
        let { role, account, grantAccess } = rolex
        expect(await tba2.hasRole(role, account)).eq(grantAccess)
        await expect(tx).to.emit(tba2, "RoleAccessChanged").withArgs(role, account, grantAccess)
      }
    });
    it("strategy manager role can manage strategy", async function () {
      let state1 = await tba2.state();
      let tx = await tba2.connect(user2).manageStrategy(9);
      await expect(tx).to.emit(tba2, "StrategyManaged").withArgs(9);
      let state2 = await tba2.state();
      expect(state2).not.eq(state1)
    });
    it("strategy manager cannot assign roles", async function () {
      await expect(tba2.connect(user2).setRoles([])).to.be.revertedWithCustomError(tba2, "NotAuthorized")
    });
  });
});
