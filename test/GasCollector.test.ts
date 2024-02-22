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

const ERC6551_REGISTRY_ADDRESS = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS            = "0x4300000000000000000000000000000000000002";

describe("GasCollector", function () {
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
      gasCollector = await deployContract(deployer, "GasCollector", [owner.address, BLAST_ADDRESS]);
      await expectDeployed(gasCollector.address);
      expect(await gasCollector.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy GasCollector", gasCollector.deployTransaction);
    })
    it("can deploy gas burner", async function () {
      gasBurner = await deployContract(deployer, "MockGasBurner", [owner.address, BLAST_ADDRESS, gasCollector.address]);
      await expectDeployed(gasBurner.address);
      expect(await gasBurner.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy MockGasBurner", gasBurner.deployTransaction);
    })
    it("should initialize correctly", async function () {
      expect(await gasCollector.owner()).eq(owner.address);
      expect(await gasCollector.pendingOwner()).eq(AddressZero);
      expect(await gasCollector.blast()).eq(BLAST_ADDRESS);
      let res = await gasCollector.getContractList();
      expect(res.contractList_).deep.eq([])
      expect(res.gasReceiver_).deep.eq(AddressZero)
    });
  });

  describe("ownable", function () {
    it("should initialize correctly", async function () {
      expect(await gasCollector.owner()).eq(owner.address);
      expect(await gasCollector.pendingOwner()).eq(AddressZero);
    });
    it("non owner cannot transfer ownership", async function () {
      await expect(gasCollector.connect(user1).transferOwnership(user1.address)).to.be.revertedWithCustomError(gasCollector, "NotContractOwner");
    });
    it("owner can start ownership transfer", async function () {
      let tx = await gasCollector.connect(owner).transferOwnership(user2.address);
      expect(await gasCollector.owner()).eq(owner.address);
      expect(await gasCollector.pendingOwner()).eq(user2.address);
      await expect(tx).to.emit(gasCollector, "OwnershipTransferStarted").withArgs(owner.address, user2.address);
    });
    it("non pending owner cannot accept ownership", async function () {
      await expect(gasCollector.connect(user1).acceptOwnership()).to.be.revertedWithCustomError(gasCollector, "NotPendingContractOwner");
    });
    it("new owner can accept ownership", async function () {
      let tx = await gasCollector.connect(user2).acceptOwnership();
      expect(await gasCollector.owner()).eq(user2.address);
      expect(await gasCollector.pendingOwner()).eq(AddressZero);
      await expect(tx).to.emit(gasCollector, "OwnershipTransferred").withArgs(owner.address, user2.address);
    });
    it("old owner does not have ownership rights", async function () {
      await expect(gasCollector.connect(owner).sweep(owner.address, [])).to.be.revertedWithCustomError(gasCollector, "NotContractOwner")
    });
    it("new owner has ownership rights", async function () {
      await gasCollector.connect(user2).sweep(owner.address, [AddressZero, erc20a.address])
    });
    it("non owner cannot renounce ownership", async function () {
      await expect(gasCollector.connect(user1).renounceOwnership()).to.be.revertedWithCustomError(gasCollector, "NotContractOwner");
    });
    it("owner can renounce ownership", async function () {
      let tx = await gasCollector.connect(user2).renounceOwnership();
      expect(await gasCollector.owner()).eq(AddressZero);
      expect(await gasCollector.pendingOwner()).eq(AddressZero);
      await expect(tx).to.emit(gasCollector, "OwnershipTransferred").withArgs(user2.address, AddressZero);
    });
    it("can init to address zero", async function () {
      // role begins revoked
      gasCollector = await deployContract(deployer, "MockGasBurner", [AddressZero, BLAST_ADDRESS, gasCollector.address]);
      await expectDeployed(gasCollector.address);
      expect(await gasCollector.owner()).eq(AddressZero);
      expect(await gasCollector.pendingOwner()).eq(AddressZero);
      await expect(gasCollector.connect(user1).transferOwnership(user1.address)).to.be.revertedWithCustomError(gasCollector, "NotContractOwner");
      await expect(gasCollector.connect(user1).renounceOwnership()).to.be.revertedWithCustomError(gasCollector, "NotContractOwner");
    })
  });

  describe("collecting yield", function () {
    it("can deploy mock blast", async function () {
      mockblast = await deployContract(deployer, "MockBlast", []);
      await expectDeployed(mockblast.address);
      await user1.sendTransaction({
        to: mockblast.address,
        value: WeiPerEther
      })
    })
    it("can redeploy gas collector", async function () {
      gasCollector = await deployContract(deployer, "GasCollector", [owner.address, mockblast.address]);
      await expectDeployed(gasCollector.address);
      expect(await gasCollector.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy GasCollector", gasCollector.deployTransaction);
    })
    it("can redeploy gas burner", async function () {
      gasBurner = await deployContract(deployer, "MockGasBurner", [owner.address, mockblast.address, gasCollector.address]);
      await expectDeployed(gasBurner.address);
      expect(await gasBurner.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy MockGasBurner", gasBurner.deployTransaction);
    })
    it("should initialize correctly", async function () {
      expect(await gasCollector.owner()).eq(owner.address);
      expect(await gasCollector.pendingOwner()).eq(AddressZero);
      expect(await gasCollector.blast()).eq(mockblast.address);
      let res = await gasCollector.getContractList();
      expect(res.contractList_).deep.eq([])
      expect(res.gasReceiver_).deep.eq(AddressZero)

      expect(await mockblast.isConfiguredAutomaticYield(user1.address)).eq(false);
      expect(await mockblast.isConfiguredAutomaticYield(gasCollector.address)).eq(true);
      expect(await mockblast.isConfiguredAutomaticYield(gasBurner.address)).eq(true);

      expect(await mockblast.isConfiguredClaimableGas(user1.address)).eq(false);
      expect(await mockblast.isConfiguredClaimableGas(gasCollector.address)).eq(true);
      expect(await mockblast.isConfiguredClaimableGas(gasBurner.address)).eq(true);

      expect(await mockblast.getGovernor(user1.address)).eq(AddressZero);
      expect(await mockblast.getGovernor(gasCollector.address)).eq(AddressZero);
      expect(await mockblast.getGovernor(gasBurner.address)).eq(gasCollector.address);
    });
    it("non owner cannot setClaimContractList", async function () {
      await expect(gasCollector.connect(user1).setClaimContractList([], user1.address)).to.be.revertedWithCustomError(gasCollector, "NotContractOwner")
    })
    it("owner can setClaimContractList", async function () {
      let contractList = [gasBurner.address]
      let receiver = user2.address
      let tx = await gasCollector.connect(owner).setClaimContractList(contractList, receiver);
      //expect(await gasCollector.claim)
      await expect(tx).to.emit(gasCollector, "ClaimContractListSet").withArgs(contractList, receiver)
      let res = await gasCollector.getContractList();
      expect(res.contractList_).deep.eq(contractList)
      expect(res.gasReceiver_).deep.eq(receiver)
    })
    it("can claimGas", async function () {
      let bal1A = await provider.getBalance(user2.address)
      let res = await gasCollector.connect(user3).callStatic.claimGas();
      expect(res).eq(1500)
      let tx = await gasCollector.connect(user3).claimGas();
      let bal2A = await provider.getBalance(user2.address)
      expect(bal2A.sub(bal1A)).eq(1500);
    })
  })

  describe("callBlastMulti", function () {
    it("non owner cannot call", async function () {
      await expect(gasCollector.connect(user1).callBlastMulti([])).to.be.revertedWithCustomError(gasCollector, "NotContractOwner")
    })
    it("can call pt 0", async function () {
      let calldatas = []
      let tx = await gasCollector.connect(owner).callBlastMulti(calldatas)
    })
    it("can call pt 1", async function () {
      let calldatas = [
        iblast.interface.encodeFunctionData("configureAutomaticYield", [])
      ]
      let tx = await gasCollector.connect(owner).callBlastMulti(calldatas)
    })
    it("can call pt 2", async function () {
      let calldatas = [
        iblast.interface.encodeFunctionData("configureAutomaticYield", []),
        iblast.interface.encodeFunctionData("claimAllGas", [gasCollector.address,user1.address]),
        iblast.interface.encodeFunctionData("claimMaxGas", [gasCollector.address,user1.address]),
      ]
      let tx = await gasCollector.connect(owner).callBlastMulti(calldatas)
    })
    it("can call pt 3", async function () {
      let calldatas = [
        iblast.interface.encodeFunctionData("configureAutomaticYield", []),
        iblast.interface.encodeFunctionData("claimAllGas", [gasBurner.address,user1.address]),
        iblast.interface.encodeFunctionData("claimMaxGas", [gasBurner.address,user1.address]),
      ]
      let tx = await gasCollector.connect(owner).callBlastMulti(calldatas)
    })
    it("reverts bad call pt 1", async function () {
      let calldatas = [
        iblast.interface.encodeFunctionData("claimMaxGas", [user1.address,user1.address]),
      ]
      await expect(gasCollector.connect(owner).callBlastMulti(calldatas)).to.be.reverted;
    })
    it("reverts bad call pt 2", async function () {
      let calldatas = [
        iblast.interface.encodeFunctionData("claimAllGas", [user1.address,user1.address]),
      ]
      await expect(gasCollector.connect(owner).callBlastMulti(calldatas)).to.be.reverted;
    })
  })

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});
