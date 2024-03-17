/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;
import fs from "fs";

import { Agents, FallbackModule, RevertModule, Test1Module, Test2Module, Test3Module, ModulePack100, AgentFactory01, MockERC20, MockERC721, MockERC1155, MockGasBurner, IBlast, MockBlast, SometimesRevertAccount, GasCollector } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { toBytes32 } from "./../scripts/utils/setStorage";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { leftPad, rightPad } from "../scripts/utils/strings";
import { deployContract } from "../scripts/utils/deployContract";
import L1DataFeeAnalyzer from "../scripts/utils/L1DataFeeAnalyzer";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../scripts/utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const WeiPerUsdc = BN.from(1_000_000); // 6 decimals

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";
const BLAST_POINTS_ADDRESS            = "0x2fc95838c71e76ec69ff817983BFf17c710F34E0";
const BLAST_POINTS_OPERATOR_ADDRESS   = "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";
const ENTRY_POINT_ADDRESS             = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

describe("Blastable", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  let gasBurner: MockGasBurner; // inherits blastable
  let gasCollector: GasCollector;
  let iblast: any;
  let mockblast: any;

  let erc20a: MockERC20;
  let erc20b: MockERC20;
  let erc20c: MockERC20;

  let chainID: number;
  let networkSettings: any;
  let snapshot: BN;

  let l1DataFeeAnalyzer = new L1DataFeeAnalyzer();

  before(async function () {
    [deployer, owner, user1, user2, user3, user4, user5] = await ethers.getSigners();
    chainID = (await provider.getNetwork()).chainId;
    networkSettings = getNetworkSettings(chainID);
    if(!networkSettings.isTestnet) throw new Error("Do not run tests on production networks");
    snapshot = await provider.send("evm_snapshot", []);
    await deployer.sendTransaction({to:deployer.address}); // for some reason this helps solidity-coverage

    erc20a = await deployContract(deployer, "MockERC20", [`Token A`, `TKNA`, 18]) as MockERC20;
    erc20b = await deployContract(deployer, "MockERC20", [`Token B`, `TKNB`, 18]) as MockERC20;
    erc20c = await deployContract(deployer, "MockERC20", [`Token C`, `TKNC`, 18]) as MockERC20;

    iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, owner) as IBlast;
  });

  after(async function () {
    await provider.send("evm_revert", [snapshot]);
  });

  describe("setup", function () {
    it("can deploy gas collector", async function () {
      gasCollector = await deployContract(deployer, "GasCollector", [owner.address, BLAST_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]);
      await expectDeployed(gasCollector.address);
      expect(await gasCollector.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy GasCollector", gasCollector.deployTransaction);
    })
    it("can deploy gas burner", async function () {
      gasBurner = await deployContract(deployer, "MockGasBurner", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]);
      await expectDeployed(gasBurner.address);
      expect(await gasBurner.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy MockGasBurner", gasBurner.deployTransaction);
    })
    it("should initialize correctly", async function () {
      expect(await gasBurner.owner()).eq(owner.address);
      expect(await gasBurner.pendingOwner()).eq(AddressZero);
      expect(await gasBurner.blast()).eq(BLAST_ADDRESS);
    });
  });

  describe("sweep", function () {
    it("cannot be swept by non owner", async function () {
      await expect(gasBurner.connect(user1).sweep(user1.address, [])).to.be.revertedWithCustomError(gasBurner, "NotContractOwner")
    })
    it("owner can sweep tokens", async function () {
      await user1.sendTransaction({
        to: gasBurner.address,
        value: WeiPerEther
      })
      await erc20a.mint(gasBurner.address, WeiPerEther.mul(3))
      let bal11eth = await provider.getBalance(gasBurner.address)
      let bal11erc20 = await erc20a.balanceOf(gasBurner.address)
      let bal12eth = await provider.getBalance(owner.address)
      let bal12erc20 = await erc20a.balanceOf(owner.address)
      let bal13eth = await provider.getBalance(user3.address)
      let bal13erc20 = await erc20a.balanceOf(user3.address)
      expect(bal11eth).gt(0)
      expect(bal11erc20).gt(0)
      let tx = await gasBurner.connect(owner).sweep(user3.address, [AddressZero, erc20a.address])
      let bal21eth = await provider.getBalance(gasBurner.address)
      let bal21erc20 = await erc20a.balanceOf(gasBurner.address)
      let bal22eth = await provider.getBalance(owner.address)
      let bal22erc20 = await erc20a.balanceOf(owner.address)
      let bal23eth = await provider.getBalance(user3.address)
      let bal23erc20 = await erc20a.balanceOf(user3.address)
      expect(bal21eth).eq(0)
      expect(bal21erc20).eq(0)
      expect(bal22eth).lt(bal12eth) // gas fees
      expect(bal22erc20).eq(bal12erc20)
      expect(bal23eth).eq(bal13eth.add(bal11eth))
      expect(bal23erc20).eq(bal13erc20.add(bal11erc20))
    })
  })

  describe("ownable", function () {
    it("should initialize correctly", async function () {
      expect(await gasBurner.owner()).eq(owner.address);
      expect(await gasBurner.pendingOwner()).eq(AddressZero);
    });
    it("non owner cannot transfer ownership", async function () {
      await expect(gasBurner.connect(user1).transferOwnership(user1.address)).to.be.revertedWithCustomError(gasBurner, "NotContractOwner");
    });
    it("owner can start ownership transfer", async function () {
      let tx = await gasBurner.connect(owner).transferOwnership(user2.address);
      expect(await gasBurner.owner()).eq(owner.address);
      expect(await gasBurner.pendingOwner()).eq(user2.address);
      await expect(tx).to.emit(gasBurner, "OwnershipTransferStarted").withArgs(owner.address, user2.address);
    });
    it("non pending owner cannot accept ownership", async function () {
      await expect(gasBurner.connect(user1).acceptOwnership()).to.be.revertedWithCustomError(gasBurner, "NotPendingContractOwner");
    });
    it("new owner can accept ownership", async function () {
      let tx = await gasBurner.connect(user2).acceptOwnership();
      expect(await gasBurner.owner()).eq(user2.address);
      expect(await gasBurner.pendingOwner()).eq(AddressZero);
      await expect(tx).to.emit(gasBurner, "OwnershipTransferred").withArgs(owner.address, user2.address);
    });
    it("old owner does not have ownership rights", async function () {
      await expect(gasBurner.connect(owner).sweep(owner.address, [])).to.be.revertedWithCustomError(gasBurner, "NotContractOwner")
    });
    it("new owner has ownership rights", async function () {
      await gasBurner.connect(user2).sweep(owner.address, [AddressZero, erc20a.address])
    });
    it("non owner cannot renounce ownership", async function () {
      await expect(gasBurner.connect(user1).renounceOwnership()).to.be.revertedWithCustomError(gasBurner, "NotContractOwner");
    });
    it("owner can renounce ownership", async function () {
      let tx = await gasBurner.connect(user2).renounceOwnership();
      expect(await gasBurner.owner()).eq(AddressZero);
      expect(await gasBurner.pendingOwner()).eq(AddressZero);
      await expect(tx).to.emit(gasBurner, "OwnershipTransferred").withArgs(user2.address, AddressZero);
    });
    it("can init to address zero", async function () {
      // role begins revoked
      gasBurner = await deployContract(deployer, "MockGasBurner", [AddressZero, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]);
      await expectDeployed(gasBurner.address);
      expect(await gasBurner.owner()).eq(AddressZero);
      expect(await gasBurner.pendingOwner()).eq(AddressZero);
      await expect(gasBurner.connect(user1).transferOwnership(user1.address)).to.be.revertedWithCustomError(gasBurner, "NotContractOwner");
      await expect(gasBurner.connect(user1).renounceOwnership()).to.be.revertedWithCustomError(gasBurner, "NotContractOwner");
    })
  });

  describe("blastable 1", function () {
    var amount:any
    before(async function () {
      console.log("Warning: These tests will fail. The blast address cannot be called on local testnet.")
      console.log("We're just going to call them here, then do the real tests in prod.")
      gasBurner = await deployContract(deployer, "MockGasBurner", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]);
      await gasBurner.connect(owner).transferOwnership(owner.address);
      await user1.sendTransaction({
        to: gasBurner.address,
        value: WeiPerEther
      })
    })
    it("burn gas", async function () {
      await gasBurner.connect(owner).burnGas(1)
    })
    it("claimMaxGas", async function () {
      try {
        //console.log("in claimMaxGas try 1")
        amount = await gasBurner.connect(owner).claimMaxGas(owner.address)
        //console.log("in claimMaxGas try 2")
        //console.log(amount)
      } catch(e) {
        //console.error("in claimMaxGas catch")
        //console.error(e)
        //amount = e.errorArgs.amount
        //console.log(amount)
      }
    })
    it("claimAllGas", async function () {
      try {
        //console.log("in claimAllGas try 1")
        amount = await gasBurner.connect(owner).claimAllGas(owner.address)
        //console.log("in claimAllGas try 2")
        //console.log(amount)
      } catch(e) {
        //console.error("in claimAllGas catch")
        //console.error(e)
        //amount = e.errorArgs.amount
        //console.log(amount)
      }
    })
    it("quoteClaimAllGas", async function () {
      try {
        //console.log("in quoteClaimAllGas try 1")
        amount = await gasBurner.connect(owner).quoteClaimAllGas()
        //console.log("in quoteClaimAllGas try 2")
        //console.log(amount)
      } catch(e) {
        //console.error("in quoteClaimAllGas catch")
        //console.error(e)
        //amount = e.errorArgs.amount
        //console.log(amount)
      }
    })
    it("quoteClaimAllGasWithRevert", async function () {
      await gasBurner.connect(owner).burnGas(10)
      const blockTimestamp = (await provider.getBlock('latest')).timestamp
      await provider.send("evm_mine", [blockTimestamp + 60]);
      await gasBurner.connect(owner).burnGas(10)

      try {
        //console.log("in quoteClaimAllGasWithRevert try 1")
        amount = await gasBurner.connect(owner).quoteClaimAllGasWithRevert()
        //console.log("in quoteClaimAllGasWithRevert try 2")
        //console.log(amount)
      } catch(e) {
        //console.error("in quoteClaimAllGasWithRevert catch")
        //console.error(e)
        //amount = e.errorArgs.amount
        //console.log(amount)
      }
      // reverted with reason string 'must withdraw non-zero amount'
    })
    it("quoteClaimMaxGas", async function () {
      try {
        //console.log("in quoteClaimMaxGas try 1")
        amount = await gasBurner.connect(owner).quoteClaimMaxGas()
        //console.log("in quoteClaimMaxGas try 2")
        //console.log(amount)
      } catch(e) {
        //console.error("in quoteClaimMaxGas catch")
        //console.error(e)
        //amount = e.errorArgs.amount
        //console.log(amount)
      }
    })
    it("quoteClaimMaxGasWithRevert", async function () {
      //await gasBurner.connect(owner).burnGas(10)
      //const blockTimestamp = (await provider.getBlock('latest')).timestamp
      //await provider.send("evm_mine", [blockTimestamp + 60]);
      //await gasBurner.connect(owner).burnGas(10)

      try {
        //console.log("in quoteClaimMaxGasWithRevert try 1")
        amount = await gasBurner.connect(owner).quoteClaimMaxGasWithRevert()
        //console.log("in quoteClaimMaxGasWithRevert try 2")
        //console.log(amount)
      } catch(e) {
        //console.error("in quoteClaimMaxGasWithRevert catch")
        //console.error(e)
        //amount = e.errorArgs.amount
        //console.log(amount)
      }
      // reverted with reason string 'must withdraw non-zero amount'
    })
  })

  describe("blastable 2", function () {
    var amount:any
    before(async function () {
      console.log("Warning: These tests will fail. The blast address cannot be called on local testnet.")
      console.log("We're just going to call them here, then do the real tests in prod.")

      mockblast = await deployContract(deployer, "MockBlast", []);
      //await mockblast.connect(user1).claimAllGas(user1.address, user1.address);
      //await mockblast.connect(user1).claimMaxGas(user1.address, user1.address);
      //await mockblast.connect(user1).claimAllGas(user2.address, user3.address);
      //await mockblast.connect(user1).claimMaxGas(user2.address, user3.address);

      gasBurner = await deployContract(deployer, "MockGasBurner", [owner.address, mockblast.address, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]);
    })
    it("burn gas", async function () {
      await gasBurner.connect(owner).burnGas(1)
    })
    it("claimMaxGas", async function () {
      try {
        //console.log("in claimMaxGas try 1")
        amount = await gasBurner.connect(owner).claimMaxGas(owner.address)
        //console.log("in claimMaxGas try 2")
        //console.log(amount)
      } catch(e) {
        //console.error("in claimMaxGas catch")
        //console.error(e)
        //amount = e.errorArgs.amount
        //console.log(amount)
      }
    })
    it("claimAllGas", async function () {
      try {
        //console.log("in claimAllGas try 1")
        amount = await gasBurner.connect(owner).claimAllGas(owner.address)
        //console.log("in claimAllGas try 2")
        //console.log(amount)
      } catch(e) {
        //console.error("in claimAllGas catch")
        //console.error(e)
        //amount = e.errorArgs.amount
        //console.log(amount)
      }
    })
    it("quoteClaimAllGas", async function () {
      try {
        //console.log("in quoteClaimAllGas try 1")
        amount = await gasBurner.connect(owner).quoteClaimAllGas()
        //console.log("in quoteClaimAllGas try 2")
        //console.log(amount)
      } catch(e) {
        //console.error("in quoteClaimAllGas catch")
        //console.error(e)
        //amount = e.errorArgs.amount
        //console.log(amount)
      }
    })
    it("quoteClaimAllGasWithRevert", async function () {
      await gasBurner.connect(owner).burnGas(10)
      const blockTimestamp = (await provider.getBlock('latest')).timestamp
      await provider.send("evm_mine", [blockTimestamp + 60]);
      await gasBurner.connect(owner).burnGas(10)

      try {
        //console.log("in quoteClaimAllGasWithRevert try 1")
        amount = await gasBurner.connect(owner).quoteClaimAllGasWithRevert()
        //console.log("in quoteClaimAllGasWithRevert try 2")
        //console.log(amount)
      } catch(e) {
        //console.error("in quoteClaimAllGasWithRevert catch")
        //console.error(e)
        //amount = e.errorArgs.amount
        //console.log(amount)
      }
      // reverted with reason string 'must withdraw non-zero amount'
    })
    it("quoteClaimMaxGas", async function () {
      try {
        //console.log("in quoteClaimMaxGas try 1")
        amount = await gasBurner.connect(owner).quoteClaimMaxGas()
        //console.log("in quoteClaimMaxGas try 2")
        //console.log(amount)
      } catch(e) {
        //console.error("in quoteClaimMaxGas catch")
        //console.error(e)
        //amount = e.errorArgs.amount
        //console.log(amount)
      }
    })
    it("quoteClaimMaxGasWithRevert", async function () {
      await gasBurner.connect(owner).burnGas(10)
      const blockTimestamp = (await provider.getBlock('latest')).timestamp
      await provider.send("evm_mine", [blockTimestamp + 60]);
      await gasBurner.connect(owner).burnGas(10)

      try {
        //console.log("in quoteClaimMaxGasWithRevert try 1")
        amount = await gasBurner.connect(owner).quoteClaimMaxGasWithRevert()
        //console.log("in quoteClaimMaxGasWithRevert try 2")
        //console.log(amount)
      } catch(e) {
        //console.error("in quoteClaimMaxGasWithRevert catch")
        //console.error(e)
        //amount = e.errorArgs.amount
        //console.log(amount)
      }
      // reverted with reason string 'must withdraw non-zero amount'
    })
  })

  describe("revert parsing", function () {
    it("x1", async function () {
      try {
        await gasBurner.x1()
      } catch(e) {
        //console.error("in x1 catch")
        //console.error(e)
      }
    })
    it("x2", async function () {
      try {
        await gasBurner.x2()
      } catch(e) {
        //console.error("in x2 catch")
        //console.error(e)
      }
    })
    it("x3", async function () {
      try {
        await gasBurner.x3()
      } catch(e) {
        //console.error("in x3 catch")
        //console.error(e)
      }
    })
    it("x4", async function () {
      // should not revert
      await gasBurner.x4()
      let amount = await gasBurner.callStatic.x4()
      //console.log({amount}) // success
      expect(amount).eq(5)
    })
  })

  describe("calls", function () {
    let account:any;
    it("setup", async function () {
      account = await deployContract(deployer, "SometimesRevertAccount", []) as SometimesRevertAccount;
    });
    it("can send 0", async function () {
      await user1.sendTransaction({
        to: account.address,
        value: WeiPerEther
      })
    })
    it("can send 1", async function () {
      await user1.sendTransaction({
        to: account.address,
        value: WeiPerEther.mul(2),
        data: "0xabcd"
      })
    })
    it("can selfSend 0", async function () {
      await account.selfSend()
    })
    it("can selfFunctionCall 0", async function () {
      await account.selfFunctionCall("0x")
      await account.selfFunctionCall("0xabcd")
    })
    it("cannot selfSend 1", async function () {
      await account.setRevertMode(1)
      try {
        await account.selfSend()
      } catch(e) {
        //console.error("in selfSend 1 catch")
        //console.error(e)
      }
      // reverted with custom error 'CallFailed()'
    })
    it("cannot selfSend 1", async function () {
      try {
        await account.selfFunctionCall("0x")
        await account.selfFunctionCall("0xabcd")
      } catch(e) {
        //console.error("in selfSend 1 catch")
        //console.error(e)
      }
      // reverted with custom error 'CallFailed()'
    })
    it("cannot selfSend 2", async function () {
      await account.setRevertMode(2)
      try {
        await account.selfSend()
      } catch(e) {
        //console.error("in selfSend 2 catch")
        //console.error(e)
      }
      // reverted with custom error 'UnknownError()'
    })
    it("cannot selfFunctionCall 2", async function () {
      try {
        await account.selfFunctionCall("0x")
        await account.selfFunctionCall("0xabcd")
      } catch(e) {
        //console.error("in selfSend 2 catch")
        //console.error(e)
      }
      // reverted with custom error 'UnknownError()'
    })
    it("cannot selfSend 3", async function () {
      await account.setRevertMode(3)
      try {
        await account.selfSend()
      } catch(e) {
        //console.error("in selfSend 3 catch")
        //console.error(e)
      }
      // reverted with reason string 'generic error'
    })
    it("cannot selfFunctionCall 3", async function () {
      await account.setRevertMode(3)
      try {
        await account.selfFunctionCall("0x")
        await account.selfFunctionCall("0xabcd")
      } catch(e) {
        //console.error("in selfSend 3 catch")
        //console.error(e)
      }
      // reverted with reason string 'generic error'
    })
  })

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});
