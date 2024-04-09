/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;

import { IERC6551Registry, ERC6551Account, Agents, AgentFactory01, MockERC20, MockERC721, RevertAccount, MockERC1271, GasCollector } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { toBytes32 } from "./../scripts/utils/setStorage";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
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
const MULTICALL_FORWARDER_ADDRESS     = ""; // v1.0.1

const MAGIC_VALUE_0 = "0x00000000";
const MAGIC_VALUE_IS_VALID_SIGNER = "0x523e3260";
const MAGIC_VALUE_IS_VALID_SIGNATURE = "0x1626ba7e";

const multicallSighash                 = "0xac9650d8";
const updateSupportedInterfacesSighash = "0xf71a8a0f";
const dummy1Sighash                    = "0x11111111";
const dummy2Sighash                    = "0x22222222";
const dummy3Sighash                    = "0x33333333";
const dummy4Sighash                    = "0x44444444";
const testFunc1Sighash                 = "0x561f5f89";
const testFunc2Sighash                 = "0x08752360";
const testFunc3Sighash                 = "0x9a5fb5a8";
const inscribeSighash                  = "0xde52f07d";

describe("AgentNft", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  let erc6551Registry: IERC6551Registry;

  let gasCollector: GasCollector;

  let agentNft1: Agents;
  let agentNft2: BlastooorGenesisAgents;
  let agentNft3: BlastooorStrategyAgents;

  let multicallForwarder: MulticallForwarder;
  let agentRegistry: AgentRegistry;
  let genesisAccountFactory: BlastooorAccountFactory;

  let genesisAgentAccountImplementation: BlastooorGenesisAgentAccount; // the base implementation for strategy accounts
  let strategyAgentAccountImplementation: BlastooorStrategyAgentAccount; // the base implementation for strategy accounts
  let accountV3Implementation: AccountV3; // the base implementation for token bound accounts

  let iblast: IBlast;
  let iblastpoints: IBlastPoints;

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

    await expectDeployed(ERC6551_REGISTRY_ADDRESS); // expect to be run on a fork of a testnet with registry deployed
    erc6551Registry = await ethers.getContractAt("IERC6551Registry", ERC6551_REGISTRY_ADDRESS) as IERC6551Registry;

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
    it("can deploy Agents ERC721", async function () {
      agentNft1 = await deployContract(deployer, "Agents", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ERC6551_REGISTRY_ADDRESS]) as Agents;
      await expectDeployed(agentNft1.address);
      expect(await agentNft1.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy Agents", agentNft1.deployTransaction);

      expect(await agentNft1.totalSupply()).eq(0);
      expect(await agentNft1.balanceOf(user1.address)).eq(0);
      expect(await agentNft1.getERC6551Registry()).eq(ERC6551_REGISTRY_ADDRESS);
    });
    it("can deploy BlastooorGenesisAgents ERC721", async function () {
      agentNft2 = await deployContract(deployer, "BlastooorGenesisAgents", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ERC6551_REGISTRY_ADDRESS]) as BlastooorGenesisAgents;
      await expectDeployed(agentNft2.address);
      expect(await agentNft2.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy BlastooorGenesisAgents", agentNft2.deployTransaction);

      expect(await agentNft2.totalSupply()).eq(0);
      expect(await agentNft2.balanceOf(user1.address)).eq(0);
      expect(await agentNft2.getERC6551Registry()).eq(ERC6551_REGISTRY_ADDRESS);
    });
    it("can deploy BlastooorStrategyAgents ERC721", async function () {
      agentNft3 = await deployContract(deployer, "BlastooorStrategyAgents", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]) as BlastooorStrategyAgents;
      await expectDeployed(agentNft3.address);
      expect(await agentNft3.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy Agents", agentNft3.deployTransaction);

      expect(await agentNft3.totalSupply()).eq(0);
      expect(await agentNft3.balanceOf(user1.address)).eq(0);
    });
    it("can deploy MulticallForwarder", async function () {
      multicallForwarder = await deployContract(deployer, "MulticallForwarder", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]) as MulticallForwarder;
      await expectDeployed(multicallForwarder.address);
      l1DataFeeAnalyzer.register("deploy MulticallForwarder", multicallForwarder.deployTransaction);
    });
    it("can deploy AccountV3 implementation", async function () {
      // AccountV3
      accountV3Implementation = await deployContract(deployer, "AccountV3", [ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero]) as AccountV3;
      await expectDeployed(accountV3Implementation.address);
      l1DataFeeAnalyzer.register("deploy AccountV3 impl", accountV3Implementation.deployTransaction);
    });
    it("can deploy BlastooorGenesisAgentAccount implementation", async function () {
      // BlastooorStrategyAgentAccount
      strategyAgentAccountImplementation = await deployContract(deployer, "BlastooorStrategyAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero]) as BlastooorStrategyAgentAccount;
      await expectDeployed(strategyAgentAccountImplementation.address);
      l1DataFeeAnalyzer.register("deploy BlastooorStrategyAgentAccount impl", strategyAgentAccountImplementation.deployTransaction);
    });
    it("can deploy BlastooorStrategyAgentAccount implementation", async function () {
      // BlastooorStrategyAgentAccount
      strategyAgentAccountImplementation = await deployContract(deployer, "BlastooorStrategyAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero]) as BlastooorStrategyAgentAccount;
      await expectDeployed(strategyAgentAccountImplementation.address);
      l1DataFeeAnalyzer.register("deploy BlastooorStrategyAgentAccount impl", strategyAgentAccountImplementation.deployTransaction);
    });
  });

  describe("test agent collection", function () {

    describe("agent creation via factory eoa", function () {
      it("cannot create agent with not whitelisted factory", async function () {
        await expect(agentNft1.connect(owner).createAgent(AddressZero)).to.be.revertedWithCustomError(agentNft1, "FactoryNotWhitelisted");
        await expect(agentNft1.connect(user1).createAgent(AddressZero)).to.be.revertedWithCustomError(agentNft1, "FactoryNotWhitelisted");
        await expect(agentNft1.connect(owner).createAgent(accountV3Implementation.address)).to.be.revertedWithCustomError(agentNft1, "FactoryNotWhitelisted");
        await expect(agentNft1.connect(user1).createAgent(accountV3Implementation.address)).to.be.revertedWithCustomError(agentNft1, "FactoryNotWhitelisted");
        await expect(agentNft1.connect(owner).createAgent(strategyAgentAccountImplementation.address)).to.be.revertedWithCustomError(agentNft1, "FactoryNotWhitelisted");
        await expect(agentNft1.connect(user1).createAgent(strategyAgentAccountImplementation.address)).to.be.revertedWithCustomError(agentNft1, "FactoryNotWhitelisted");
      });
      it("non owner cannot whitelist", async function () {
        await expect(agentNft1.connect(user1).setWhitelist([])).to.be.revertedWithCustomError(agentNft1, "NotContractOwner");
      });
      it("owner can whitelist 1", async function () {
        let whitelist = [
          {
            factory: user1.address,
            shouldWhitelist: true
          },
          {
            factory: user2.address,
            shouldWhitelist: false
          },
        ];
        let tx = await agentNft1.connect(owner).setWhitelist(whitelist);
        for(let i = 0; i < whitelist.length; i++) {
          let whitelistItem = whitelist[i]
          await expect(tx).to.emit(agentNft1, "FactoryWhitelisted").withArgs(whitelistItem.factory, whitelistItem.shouldWhitelist);
          expect(await agentNft1.factoryIsWhitelisted(whitelistItem.factory)).eq(whitelistItem.shouldWhitelist);
        }
      });
      it("can create agent pt 1", async function () {
        let ts = await agentNft1.totalSupply();
        let bal = await agentNft1.balanceOf(user1.address);
        let agentID = ts.add(1);
        let agentRes = await agentNft1.connect(user1).callStatic.createAgent(accountV3Implementation.address);
        expect(agentRes.agentID).eq(agentID);
        expect(await agentNft1.exists(agentID)).eq(false);
        //await expect(agentNft1.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft1, "AgentDoesNotExist");
        expect(await agentNft1.getAgentID(agentRes.agentAddress)).eq(0);
        expect(await agentNft1.isAddressAgent(agentRes.agentAddress)).eq(false);
        let isDeployed1 = await isDeployed(agentRes.agentAddress)
        expect(isDeployed1).to.be.false;
        let tx = await agentNft1.connect(user1).createAgent(accountV3Implementation.address);
        await expect(tx).to.emit(agentNft1, "Transfer").withArgs(AddressZero, user1.address, agentRes.agentID);
        expect(await agentNft1.totalSupply()).eq(ts.add(1));
        expect(await agentNft1.balanceOf(user1.address)).eq(bal.add(1));
        expect(await agentNft1.exists(agentID)).eq(true);
        expect(await agentNft1.ownerOf(agentRes.agentID)).eq(user1.address);
        let agentInfo = await agentNft1.getAgentInfo(agentID);
        //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
        expect(await agentNft1.getAgentID(agentInfo.agentAddress)).eq(agentID);
        expect(await agentNft1.isAddressAgent(agentInfo.agentAddress)).eq(true);
        let isDeployed2 = await isDeployed(agentInfo.agentAddress)
        expect(isDeployed2).to.be.true;
        expect(agentInfo.implementationAddress).eq(accountV3Implementation.address);
        l1DataFeeAnalyzer.register("createAgent", tx);
      });
      it("owner can whitelist 2", async function () {
        let whitelist = [
          {
            factory: AddressZero,
            shouldWhitelist: true
          },
        ];
        let tx = await agentNft1.connect(owner).setWhitelist(whitelist);
        for(let i = 0; i < whitelist.length; i++) {
          let whitelistItem = whitelist[i]
          await expect(tx).to.emit(agentNft1, "FactoryWhitelisted").withArgs(whitelistItem.factory, whitelistItem.shouldWhitelist);
          expect(await agentNft1.factoryIsWhitelisted(whitelistItem.factory)).eq(whitelistItem.shouldWhitelist);
        }
      });
      it("can create agent pt 1", async function () {
        let ts = await agentNft1.totalSupply();
        let bal = await agentNft1.balanceOf(user3.address);
        let agentID = ts.add(1);
        let agentRes = await agentNft1.connect(user3).callStatic.createAgent(accountV3Implementation.address);
        expect(agentRes.agentID).eq(agentID);
        expect(await agentNft1.exists(agentID)).eq(false);
        //await expect(agentNft1.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft1, "AgentDoesNotExist");
        expect(await agentNft1.getAgentID(agentRes.agentAddress)).eq(0);
        expect(await agentNft1.isAddressAgent(agentRes.agentAddress)).eq(false);
        let isDeployed1 = await isDeployed(agentRes.agentAddress)
        expect(isDeployed1).to.be.false;
        let tx = await agentNft1.connect(user3).createAgent(accountV3Implementation.address);
        await expect(tx).to.emit(agentNft1, "Transfer").withArgs(AddressZero, user3.address, agentRes.agentID);
        expect(await agentNft1.totalSupply()).eq(ts.add(1));
        expect(await agentNft1.balanceOf(user3.address)).eq(bal.add(1));
        expect(await agentNft1.exists(agentID)).eq(true);
        expect(await agentNft1.ownerOf(agentRes.agentID)).eq(user3.address);
        let agentInfo = await agentNft1.getAgentInfo(agentID);
        //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
        expect(await agentNft1.getAgentID(agentInfo.agentAddress)).eq(agentID);
        expect(await agentNft1.isAddressAgent(agentInfo.agentAddress)).eq(true);
        let isDeployed2 = await isDeployed(agentInfo.agentAddress)
        expect(isDeployed2).to.be.true;
        expect(agentInfo.implementationAddress).eq(accountV3Implementation.address);
        l1DataFeeAnalyzer.register("createAgent", tx);
      });
    });


    describe("metadata", function () {
      it("has the correct name and symbol", async function () {
        expect(await agentNft1.name()).eq("Agents")
        expect(await agentNft1.symbol()).eq("AGENTS")
      })
    })

    describe("tokenURI", function () {
      let base = "https://stats.agentfi.io/agents/?chainID=31337&collection=testagents&agentID=";
      let uri = "https://stats.agentfi.io/agents/?chainID=31337&collection=testagents&agentID=1";
      it("starts as id", async function () {
        expect(await agentNft1.baseURI()).eq("");
        expect(await agentNft1.tokenURI(1)).eq("1");
      });
      it("non owner cannot set base", async function () {
        await expect(agentNft1.connect(user1).setBaseURI(base)).to.be.revertedWithCustomError(agentNft1, "NotContractOwner");
      });
      it("owner can set base", async function () {
        let tx = await agentNft1.connect(owner).setBaseURI(base);
        await expect(tx).to.emit(agentNft1, "BaseURISet").withArgs(base);
        l1DataFeeAnalyzer.register("setBaseURI", tx);
      });
      it("can get new uri", async function () {
        expect(await agentNft1.baseURI()).eq(base);
        expect(await agentNft1.tokenURI(1)).eq(uri);
      });
      it("cannot get uri of nonexistant token", async function () {
        await expect(agentNft1.tokenURI(0)).to.be.revertedWithCustomError(agentNft1, "AgentDoesNotExist");
        await expect(agentNft1.tokenURI(999)).to.be.revertedWithCustomError(agentNft1, "AgentDoesNotExist");
      });
    });

    describe("contractURI", function () {
      let uri = "https://stats-cdn.agentfi.io/contract-uri-test-agents.json";
      it("starts null", async function () {
        expect(await agentNft1.contractURI()).eq("");
      });
      it("non owner cannot set uri", async function () {
        await expect(agentNft1.connect(user1).setContractURI(uri)).to.be.revertedWithCustomError(agentNft1, "NotContractOwner");
      });
      it("owner can set uri", async function () {
        let tx = await agentNft1.connect(owner).setContractURI(uri);
        await expect(tx).to.emit(agentNft1, "ContractURISet").withArgs(uri);
        l1DataFeeAnalyzer.register("setContractURI", tx);
      });
      it("can get new uri", async function () {
        expect(await agentNft1.contractURI()).eq(uri);
      });
    });

  })

  describe("genesis agent collection", function () {

    describe("agent creation via factory eoa", function () {
      it("cannot create agent with not whitelisted factory", async function () {
        await expect(agentNft2.connect(owner).createAgent(AddressZero)).to.be.revertedWithCustomError(agentNft2, "FactoryNotWhitelisted");
        await expect(agentNft2.connect(user1).createAgent(AddressZero)).to.be.revertedWithCustomError(agentNft2, "FactoryNotWhitelisted");
        await expect(agentNft2.connect(owner).createAgent(accountV3Implementation.address)).to.be.revertedWithCustomError(agentNft2, "FactoryNotWhitelisted");
        await expect(agentNft2.connect(user1).createAgent(accountV3Implementation.address)).to.be.revertedWithCustomError(agentNft2, "FactoryNotWhitelisted");
        await expect(agentNft2.connect(owner).createAgent(strategyAgentAccountImplementation.address)).to.be.revertedWithCustomError(agentNft2, "FactoryNotWhitelisted");
        await expect(agentNft2.connect(user1).createAgent(strategyAgentAccountImplementation.address)).to.be.revertedWithCustomError(agentNft2, "FactoryNotWhitelisted");
      });
      it("non owner cannot whitelist", async function () {
        await expect(agentNft2.connect(user1).setWhitelist([])).to.be.revertedWithCustomError(agentNft2, "NotContractOwner");
      });
      it("owner can whitelist 1", async function () {
        let whitelist = [
          {
            factory: user1.address,
            shouldWhitelist: true
          },
          {
            factory: user2.address,
            shouldWhitelist: false
          },
        ];
        let tx = await agentNft2.connect(owner).setWhitelist(whitelist);
        for(let i = 0; i < whitelist.length; i++) {
          let whitelistItem = whitelist[i]
          await expect(tx).to.emit(agentNft2, "FactoryWhitelisted").withArgs(whitelistItem.factory, whitelistItem.shouldWhitelist);
          expect(await agentNft2.factoryIsWhitelisted(whitelistItem.factory)).eq(whitelistItem.shouldWhitelist);
        }
      });
      it("can create agent pt 1", async function () {
        let ts = await agentNft2.totalSupply();
        let bal = await agentNft2.balanceOf(user1.address);
        let agentID = ts.add(1);
        let agentRes = await agentNft2.connect(user1).callStatic.createAgent(accountV3Implementation.address);
        expect(agentRes.agentID).eq(agentID);
        expect(await agentNft2.exists(agentID)).eq(false);
        //await expect(agentNft2.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft2, "AgentDoesNotExist");
        expect(await agentNft2.getAgentID(agentRes.agentAddress)).eq(0);
        expect(await agentNft2.isAddressAgent(agentRes.agentAddress)).eq(false);
        let isDeployed1 = await isDeployed(agentRes.agentAddress)
        expect(isDeployed1).to.be.false;
        let tx = await agentNft2.connect(user1).createAgent(accountV3Implementation.address);
        await expect(tx).to.emit(agentNft2, "Transfer").withArgs(AddressZero, user1.address, agentRes.agentID);
        expect(await agentNft2.totalSupply()).eq(ts.add(1));
        expect(await agentNft2.balanceOf(user1.address)).eq(bal.add(1));
        expect(await agentNft2.exists(agentID)).eq(true);
        expect(await agentNft2.ownerOf(agentRes.agentID)).eq(user1.address);
        let agentInfo = await agentNft2.getAgentInfo(agentID);
        //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
        expect(await agentNft2.getAgentID(agentInfo.agentAddress)).eq(agentID);
        expect(await agentNft2.isAddressAgent(agentInfo.agentAddress)).eq(true);
        let isDeployed2 = await isDeployed(agentInfo.agentAddress)
        expect(isDeployed2).to.be.true;
        expect(agentInfo.implementationAddress).eq(accountV3Implementation.address);
        l1DataFeeAnalyzer.register("createAgent", tx);
      });
      it("owner can whitelist 2", async function () {
        let whitelist = [
          {
            factory: AddressZero,
            shouldWhitelist: true
          },
        ];
        let tx = await agentNft2.connect(owner).setWhitelist(whitelist);
        for(let i = 0; i < whitelist.length; i++) {
          let whitelistItem = whitelist[i]
          await expect(tx).to.emit(agentNft2, "FactoryWhitelisted").withArgs(whitelistItem.factory, whitelistItem.shouldWhitelist);
          expect(await agentNft2.factoryIsWhitelisted(whitelistItem.factory)).eq(whitelistItem.shouldWhitelist);
        }
      });
      it("can create agent pt 2", async function () {
        let ts = await agentNft2.totalSupply();
        let bal = await agentNft2.balanceOf(user3.address);
        let agentID = ts.add(1);
        let agentRes = await agentNft2.connect(user3).callStatic.createAgent(accountV3Implementation.address);
        expect(agentRes.agentID).eq(agentID);
        expect(await agentNft2.exists(agentID)).eq(false);
        //await expect(agentNft2.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft2, "AgentDoesNotExist");
        expect(await agentNft2.getAgentID(agentRes.agentAddress)).eq(0);
        expect(await agentNft2.isAddressAgent(agentRes.agentAddress)).eq(false);
        let isDeployed1 = await isDeployed(agentRes.agentAddress)
        expect(isDeployed1).to.be.false;
        let tx = await agentNft2.connect(user3).createAgent(accountV3Implementation.address);
        await expect(tx).to.emit(agentNft2, "Transfer").withArgs(AddressZero, user3.address, agentRes.agentID);
        expect(await agentNft2.totalSupply()).eq(ts.add(1));
        expect(await agentNft2.balanceOf(user3.address)).eq(bal.add(1));
        expect(await agentNft2.exists(agentID)).eq(true);
        expect(await agentNft2.ownerOf(agentRes.agentID)).eq(user3.address);
        let agentInfo = await agentNft2.getAgentInfo(agentID);
        //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
        expect(await agentNft2.getAgentID(agentInfo.agentAddress)).eq(agentID);
        expect(await agentNft2.isAddressAgent(agentInfo.agentAddress)).eq(true);
        let isDeployed2 = await isDeployed(agentInfo.agentAddress)
        expect(isDeployed2).to.be.true;
        expect(agentInfo.implementationAddress).eq(accountV3Implementation.address);
        l1DataFeeAnalyzer.register("createAgent", tx);
      });
    });


    describe("metadata", function () {
      it("has the correct name and symbol", async function () {
        expect(await agentNft2.name()).eq("Blastooor Genesis")
        expect(await agentNft2.symbol()).eq("BLASTOOOR")
      })
    })

    describe("tokenURI", function () {
      let base = "https://stats.agentfi.io/agents/?chainID=31337&collection=genesis&agentID=";
      let uri = "https://stats.agentfi.io/agents/?chainID=31337&collection=genesis&agentID=1";
      it("starts as id", async function () {
        expect(await agentNft2.baseURI()).eq("");
        expect(await agentNft2.tokenURI(1)).eq("1");
      });
      it("non owner cannot set base", async function () {
        await expect(agentNft2.connect(user1).setBaseURI(base)).to.be.revertedWithCustomError(agentNft2, "NotContractOwner");
      });
      it("owner can set base", async function () {
        let tx = await agentNft2.connect(owner).setBaseURI(base);
        await expect(tx).to.emit(agentNft2, "BaseURISet").withArgs(base);
        l1DataFeeAnalyzer.register("setBaseURI", tx);
      });
      it("can get new uri", async function () {
        expect(await agentNft2.baseURI()).eq(base);
        expect(await agentNft2.tokenURI(1)).eq(uri);
      });
      it("cannot get uri of nonexistant token", async function () {
        await expect(agentNft2.tokenURI(0)).to.be.revertedWithCustomError(agentNft2, "AgentDoesNotExist");
        await expect(agentNft2.tokenURI(999)).to.be.revertedWithCustomError(agentNft2, "AgentDoesNotExist");
      });
    });

    describe("contractURI", function () {
      let uri = "https://stats-cdn.agentfi.io/contract-uri-genesis-agents.json";
      it("starts null", async function () {
        expect(await agentNft2.contractURI()).eq("");
      });
      it("non owner cannot set uri", async function () {
        await expect(agentNft2.connect(user1).setContractURI(uri)).to.be.revertedWithCustomError(agentNft2, "NotContractOwner");
      });
      it("owner can set uri", async function () {
        let tx = await agentNft2.connect(owner).setContractURI(uri);
        await expect(tx).to.emit(agentNft2, "ContractURISet").withArgs(uri);
        l1DataFeeAnalyzer.register("setContractURI", tx);
      });
      it("can get new uri", async function () {
        expect(await agentNft2.contractURI()).eq(uri);
      });
    });

  })

  describe("strategy agent collection", function () {

    describe("agent creation via factory eoa", function () {
      it("cannot create agent with not whitelisted factory", async function () {
        await expect(agentNft3.connect(owner).createAgent()).to.be.revertedWithCustomError(agentNft3, "FactoryNotWhitelisted");
        await expect(agentNft3.connect(user1).createAgent()).to.be.revertedWithCustomError(agentNft3, "FactoryNotWhitelisted");
      });
      it("non owner cannot whitelist", async function () {
        await expect(agentNft3.connect(user1).setWhitelist([])).to.be.revertedWithCustomError(agentNft3, "NotContractOwner");
      });
      it("owner can whitelist 1", async function () {
        let whitelist = [
          {
            factory: user1.address,
            shouldWhitelist: true
          },
          {
            factory: user2.address,
            shouldWhitelist: false
          },
        ];
        let tx = await agentNft3.connect(owner).setWhitelist(whitelist);
        for(let i = 0; i < whitelist.length; i++) {
          let whitelistItem = whitelist[i]
          await expect(tx).to.emit(agentNft3, "FactoryWhitelisted").withArgs(whitelistItem.factory, whitelistItem.shouldWhitelist);
          expect(await agentNft3.factoryIsWhitelisted(whitelistItem.factory)).eq(whitelistItem.shouldWhitelist);
        }
      });
      it("can create agent pt 1", async function () {
        let ts = await agentNft3.totalSupply();
        let bal = await agentNft3.balanceOf(user1.address);
        let agentID = ts.add(1);
        let agentRes = await agentNft3.connect(user1).callStatic.createAgent();
        expect(agentRes).eq(agentID);
        expect(await agentNft3.exists(agentID)).eq(false);
        let tx = await agentNft3.connect(user1).createAgent();
        await expect(tx).to.emit(agentNft3, "Transfer").withArgs(AddressZero, user1.address, agentRes);
        expect(await agentNft3.totalSupply()).eq(ts.add(1));
        expect(await agentNft3.balanceOf(user1.address)).eq(bal.add(1));
        expect(await agentNft3.exists(agentID)).eq(true);
        expect(await agentNft3.ownerOf(agentRes)).eq(user1.address);
        l1DataFeeAnalyzer.register("createStrategyAgent", tx);
      });
      it("owner can whitelist 2", async function () {
        let whitelist = [
          {
            factory: AddressZero,
            shouldWhitelist: true
          },
        ];
        let tx = await agentNft3.connect(owner).setWhitelist(whitelist);
        for(let i = 0; i < whitelist.length; i++) {
          let whitelistItem = whitelist[i]
          await expect(tx).to.emit(agentNft3, "FactoryWhitelisted").withArgs(whitelistItem.factory, whitelistItem.shouldWhitelist);
          expect(await agentNft3.factoryIsWhitelisted(whitelistItem.factory)).eq(whitelistItem.shouldWhitelist);
        }
      });
      it("can create agent pt 2", async function () {
        let ts = await agentNft3.totalSupply();
        let bal = await agentNft3.balanceOf(user1.address);
        let agentID = ts.add(1);
        let agentRes = await agentNft3.connect(user3).callStatic.createAgent();
        expect(agentRes).eq(agentID);
        expect(await agentNft3.exists(agentID)).eq(false);
        let tx = await agentNft3.connect(user1).createAgent();
        await expect(tx).to.emit(agentNft3, "Transfer").withArgs(AddressZero, user1.address, agentRes);
        expect(await agentNft3.totalSupply()).eq(ts.add(1));
        expect(await agentNft3.balanceOf(user1.address)).eq(bal.add(1));
        expect(await agentNft3.exists(agentID)).eq(true);
        expect(await agentNft3.ownerOf(agentRes)).eq(user1.address);
        l1DataFeeAnalyzer.register("createStrategyAgent", tx);
      });
    });


    describe("metadata", function () {
      it("has the correct name and symbol", async function () {
        expect(await agentNft3.name()).eq("Blastooor Strategy")
        expect(await agentNft3.symbol()).eq("BLASTOOOR STRATEGY")
      })
    })

    describe("tokenURI", function () {
      let base = "https://stats.agentfi.io/agents/?chainID=31337&collection=genesis&agentID=";
      let uri = "https://stats.agentfi.io/agents/?chainID=31337&collection=genesis&agentID=1";
      it("starts as id", async function () {
        expect(await agentNft3.baseURI()).eq("");
        expect(await agentNft3.tokenURI(1)).eq("1");
      });
      it("non owner cannot set base", async function () {
        await expect(agentNft3.connect(user1).setBaseURI(base)).to.be.revertedWithCustomError(agentNft3, "NotContractOwner");
      });
      it("owner can set base", async function () {
        let tx = await agentNft3.connect(owner).setBaseURI(base);
        await expect(tx).to.emit(agentNft3, "BaseURISet").withArgs(base);
        l1DataFeeAnalyzer.register("setBaseURI", tx);
      });
      it("can get new uri", async function () {
        expect(await agentNft3.baseURI()).eq(base);
        expect(await agentNft3.tokenURI(1)).eq(uri);
      });
      it("cannot get uri of nonexistant token", async function () {
        await expect(agentNft3.tokenURI(0)).to.be.revertedWithCustomError(agentNft3, "AgentDoesNotExist");
        await expect(agentNft3.tokenURI(999)).to.be.revertedWithCustomError(agentNft3, "AgentDoesNotExist");
      });
    });

    describe("contractURI", function () {
      let uri = "https://stats-cdn.agentfi.io/contract-uri-genesis-agents.json";
      it("starts null", async function () {
        expect(await agentNft3.contractURI()).eq("");
      });
      it("non owner cannot set uri", async function () {
        await expect(agentNft3.connect(user1).setContractURI(uri)).to.be.revertedWithCustomError(agentNft3, "NotContractOwner");
      });
      it("owner can set uri", async function () {
        let tx = await agentNft3.connect(owner).setContractURI(uri);
        await expect(tx).to.emit(agentNft3, "ContractURISet").withArgs(uri);
        l1DataFeeAnalyzer.register("setContractURI", tx);
      });
      it("can get new uri", async function () {
        expect(await agentNft3.contractURI()).eq(uri);
      });
    });

  })

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});

function createMockSignatureForContract(c:any) {
  var signature = c.address.toLowerCase()
  signature = signature.substring(2,signature.length)
  while(signature.length < 64) signature = '0' + signature // 32 bytes
  signature = '0x'+signature
  while(signature.length < 132) signature += '0' // 65 bytes
  return signature
}
