/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;

import { IERC6551Registry, Agents, ERC165Module, FallbackModule, RevertModule, AgentFactory01, AgentFactory02, MockERC20, MockERC721, RevertAccount, MockERC1271, GasCollector, BlastooorGenesisAgentAccount } from "./../typechain-types";

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
const diamondCutSighash                = "0x1f931c1c";
const updateSupportedInterfacesSighash = "0xf71a8a0f";
const dummy1Sighash                    = "0x11111111";
const dummy2Sighash                    = "0x22222222";
const dummy3Sighash                    = "0x33333333";
const dummy4Sighash                    = "0x44444444";
const testFunc1Sighash                 = "0x561f5f89";
const testFunc2Sighash                 = "0x08752360";
const testFunc3Sighash                 = "0x9a5fb5a8";
const inscribeSighash                  = "0xde52f07d";

describe("AgentFactory02", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  let erc6551Registry: IERC6551Registry;

  let gasCollector: GasCollector;
  let agentNft: Agents;

  let multicallForwarder: MulticallForwarder;
  let agentRegistry: AgentRegistry;
  let genesisAccountFactory: BlastooorAccountFactory;

  let blastAccountImplementation: BlastooorGenesisAgentAccount; // the base implementation for token bound accounts
  let tbaccount1: BlastooorGenesisAgentAccount; // an account bound to a token
  let tbaccount2: BlastooorGenesisAgentAccount; // an account bound to a token
  let agentInitializationCode1: any;
  let agentInitializationCode2: any;
  // factory
  let factory: AgentFactory02;

  let erc20a: MockERC20;
  let erc20b: MockERC20;
  let erc20c: MockERC20;

  let mockERC1271: MockERC1271;

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
      // to deployer
      agentNft = await deployContract(deployer, "Agents", [deployer.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ERC6551_REGISTRY_ADDRESS]) as Agents;
      await expectDeployed(agentNft.address);
      expect(await agentNft.owner()).eq(deployer.address);
      l1DataFeeAnalyzer.register("deploy Agents", agentNft.deployTransaction);
      // to owner
      agentNft = await deployContract(deployer, "Agents", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ERC6551_REGISTRY_ADDRESS]) as Agents;
      await expectDeployed(agentNft.address);
      expect(await agentNft.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy Agents", agentNft.deployTransaction);
    });
    it("initializes properly", async function () {
      expect(await agentNft.totalSupply()).eq(0);
      expect(await agentNft.balanceOf(user1.address)).eq(0);
      expect(await agentNft.getERC6551Registry()).eq(ERC6551_REGISTRY_ADDRESS);
    });
    it("can deploy MulticallForwarder", async function () {
      multicallForwarder = await deployContract(deployer, "MulticallForwarder", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]) as MulticallForwarder;
      await expectDeployed(multicallForwarder.address);
      l1DataFeeAnalyzer.register("deploy MulticallForwarder", multicallForwarder.deployTransaction);
    });
    it("can deploy account implementations", async function () {
      // BlastooorGenesisAgentAccount
      blastAccountImplementation = await deployContract(deployer, "BlastooorGenesisAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero]) as BlastooorGenesisAgentAccount;
      await expectDeployed(blastAccountImplementation.address);
      l1DataFeeAnalyzer.register("deploy BlastooorGenesisAgentAccount impl", blastAccountImplementation.deployTransaction);
    });
    it("can deploy AgentFactory02", async function () {
      // to deployer
      factory = await deployContract(deployer, "AgentFactory02", [deployer.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, agentNft.address]) as AgentFactory02;
      await expectDeployed(factory.address);
      expect(await factory.owner()).eq(deployer.address);
      l1DataFeeAnalyzer.register("deploy AgentFactory02", factory.deployTransaction);
      // to owner
      factory = await deployContract(deployer, "AgentFactory02", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, agentNft.address]) as AgentFactory02;
      await expectDeployed(factory.address);
      expect(await factory.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy AgentFactory02", factory.deployTransaction);
    });
    it("can deploy MockERC1271", async function () {
      mockERC1271 = await deployContract(deployer, "MockERC1271", []) as MockERC1271;
      await expectDeployed(mockERC1271.address);
      l1DataFeeAnalyzer.register("deploy MockERC1271", mockERC1271.deployTransaction);
    });
  });

  describe("agent creation via factory eoa", function () {
    it("cannot create agent with not whitelisted factory", async function () {
      await expect(agentNft.connect(owner).createAgent(AddressZero)).to.be.revertedWithCustomError(agentNft, "FactoryNotWhitelisted");
      await expect(agentNft.connect(user1).createAgent(AddressZero)).to.be.revertedWithCustomError(agentNft, "FactoryNotWhitelisted");
      await expect(agentNft.connect(owner).createAgent(blastAccountImplementation.address)).to.be.revertedWithCustomError(agentNft, "FactoryNotWhitelisted");
      await expect(agentNft.connect(user1).createAgent(blastAccountImplementation.address)).to.be.revertedWithCustomError(agentNft, "FactoryNotWhitelisted");
    });
    it("non owner cannot whitelist", async function () {
      await expect(agentNft.connect(user1).setWhitelist([])).to.be.revertedWithCustomError(agentNft, "NotContractOwner");
    });
    it("owner can whitelist", async function () {
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
      let tx = await agentNft.connect(owner).setWhitelist(whitelist);
      for(let i = 0; i < whitelist.length; i++) {
        let whitelistItem = whitelist[i]
        await expect(tx).to.emit(agentNft, "FactoryWhitelisted").withArgs(whitelistItem.factory, whitelistItem.shouldWhitelist);
        expect(await agentNft.factoryIsWhitelisted(whitelistItem.factory)).eq(whitelistItem.shouldWhitelist);
      }
    });
    it("can create agent pt 1", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let agentRes = await agentNft.connect(user1).callStatic.createAgent(blastAccountImplementation.address);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await agentNft.connect(user1).createAgent(blastAccountImplementation.address);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount1 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress);
      l1DataFeeAnalyzer.register("createAgent", tx);
    });
  });

  describe("agent creation via factory contract", function () {
    it("owner can whitelist", async function () {
      let whitelist = [
        {
          factory: factory.address,
          shouldWhitelist: true
        }
      ];
      let tx = await agentNft.connect(owner).setWhitelist(whitelist);
      for(let i = 0; i < whitelist.length; i++) {
        let whitelistItem = whitelist[i]
        await expect(tx).to.emit(agentNft, "FactoryWhitelisted").withArgs(whitelistItem.factory, whitelistItem.shouldWhitelist);
        expect(await agentNft.factoryIsWhitelisted(whitelistItem.factory)).eq(whitelistItem.shouldWhitelist);
      }
    });
    it("cannot getAgentCreationSettings with invalid creationSettingsID pt 1", async function () {
      expect(await factory.getAgentCreationSettingsCount()).eq(0)
      await expect(factory.getAgentCreationSettings(0)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory.getAgentCreationSettings(1)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory.getAgentCreationSettings(2)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory.getAgentCreationSettings(999)).to.be.revertedWithCustomError(factory, "OutOfRange")
    })
    it("cannot createAgent with invalid creationSettingsID pt 1", async function () {
      await expect(factory['createAgent(uint256)'](0)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory['createAgent(uint256,bytes[])'](0, [])).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory['createAgent(uint256,address)'](0, user1.address)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory['createAgent(uint256,bytes[],address)'](0, [], user1.address)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory['createAgent(uint256)'](1)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory['createAgent(uint256,bytes[])'](1, [])).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory['createAgent(uint256,address)'](1, user1.address)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory['createAgent(uint256,bytes[],address)'](1, [], user1.address)).to.be.revertedWithCustomError(factory, "OutOfRange")
    })
    it("can non owner cannot postAgentCreationSettings", async function () {
      let params = {
        agentImplementation: blastAccountImplementation.address,
        initializationCalls: [],
        isPaused: false,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      await expect(factory.connect(user1).postAgentCreationSettings(params)).to.be.revertedWithCustomError(factory, "NotContractOwner")
    })
    it("cannot postAgentCreationSettings with non contract", async function () {
      let params = {
        agentImplementation: user1.address,
        initializationCalls: [],
        isPaused: false,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      await expect(factory.connect(owner).postAgentCreationSettings(params)).to.be.revertedWithCustomError(factory, "NotAContract")
    })
    it("owner can postAgentCreationSettings", async function () {
      let params = {
        agentImplementation: blastAccountImplementation.address,
        initializationCalls: [],
        isPaused: false,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      let tx = await factory.connect(owner).postAgentCreationSettings(params)
      expect(await factory.getAgentCreationSettingsCount()).eq(1)
      let res = await factory.getAgentCreationSettings(1)
      expect(res.agentImplementation).eq(params.agentImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isPaused).eq(params.isPaused)
      expect(res.giveTokenList).deep.eq(params.giveTokenList)
      expect(res.giveTokenAmounts).deep.eq(params.giveTokenAmounts)
      await expect(tx).to.emit(factory, "AgentCreationSettingsPosted").withArgs(1)
      await expect(tx).to.emit(factory, "AgentCreationSettingsPaused").withArgs(1, params.isPaused)

      await expect(factory.getAgentCreationSettings(0)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory.getAgentCreationSettings(2)).to.be.revertedWithCustomError(factory, "OutOfRange")
    })
    it("can create agent pt 2", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let agentRes = await factory.connect(user1).callStatic['createAgent(uint256)'](1);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createAgent(uint256)'](1);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, factory.address, agentRes.agentID);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(factory.address, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createAgent", tx);
    });
    it("can create agent pt 3", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let agentRes = await factory.connect(user1).callStatic['createAgent(uint256)'](1);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createAgent(uint256)'](1);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, factory.address, agentRes.agentID);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(factory.address, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createAgent", tx);
    });
    it("owner can whitelist pt 2", async function () {
      let whitelist = [
        {
          factory: user1.address,
          shouldWhitelist: false
        },
        {
          factory: user2.address,
          shouldWhitelist: false
        },
        {
          factory: user3.address,
          shouldWhitelist: false
        },
        {
          factory: factory.address,
          shouldWhitelist: false
        },
        {
          factory: AddressZero, // whitelist all
          shouldWhitelist: true
        }
      ];
      let tx = await agentNft.connect(owner).setWhitelist(whitelist);
      for(let i = 0; i < whitelist.length; i++) {
        let whitelistItem = whitelist[i]
        await expect(tx).to.emit(agentNft, "FactoryWhitelisted").withArgs(whitelistItem.factory, whitelistItem.shouldWhitelist);
        expect(await agentNft.factoryIsWhitelisted(whitelistItem.factory)).eq(whitelistItem.shouldWhitelist);
      }
    });
    it("non owner cannot pause", async function () {
      await expect(factory.connect(user1).setPaused(1, true)).to.be.revertedWithCustomError(factory, "NotContractOwner")
      await expect(factory.connect(user1).setPaused(1, false)).to.be.revertedWithCustomError(factory, "NotContractOwner")
    })
    it("cannot pause non existing creationSettingsID", async function () {
      await expect(factory.connect(owner).setPaused(0, true)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory.connect(owner).setPaused(0, false)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory.connect(owner).setPaused(999, true)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory.connect(owner).setPaused(999, false)).to.be.revertedWithCustomError(factory, "OutOfRange")
    })
    it("owner can pause", async function () {
      let settings1 = await factory.getAgentCreationSettings(1);
      expect(settings1.isPaused).eq(false)
      let tx = await factory.connect(owner).setPaused(1, true)
      await expect(tx).to.emit(factory, "AgentCreationSettingsPaused").withArgs(1, true)
      let settings2 = await factory.getAgentCreationSettings(1);
      expect(settings2.isPaused).eq(true)
    })
    it("cannot create agent while creation settings paused", async function () {
      await expect(factory.connect(user1)['createAgent(uint256)'](1)).to.be.revertedWithCustomError(factory, "CreationSettingsPaused")
      await expect(factory.connect(user1)['createAgent(uint256,address)'](1,user1.address)).to.be.revertedWithCustomError(factory, "CreationSettingsPaused")
      await expect(factory.connect(user1)['createAgent(uint256,bytes[])'](1,[])).to.be.revertedWithCustomError(factory, "CreationSettingsPaused")
      await expect(factory.connect(user1)['createAgent(uint256,bytes[],address)'](1,[],user1.address)).to.be.revertedWithCustomError(factory, "CreationSettingsPaused")
    })
    it("owner can postAgentCreationSettings pt 2", async function () {
      let params = {
        agentImplementation: blastAccountImplementation.address,
        initializationCalls: [],
        isPaused: false,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      let tx = await factory.connect(owner).postAgentCreationSettings(params)
      expect(await factory.getAgentCreationSettingsCount()).eq(2)
      let res = await factory.getAgentCreationSettings(2)
      expect(res.agentImplementation).eq(params.agentImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isPaused).eq(params.isPaused)
      expect(res.giveTokenList).deep.eq(params.giveTokenList)
      expect(res.giveTokenAmounts).deep.eq(params.giveTokenAmounts)
      await expect(tx).to.emit(factory, "AgentCreationSettingsPosted").withArgs(2)
      await expect(tx).to.emit(factory, "AgentCreationSettingsPaused").withArgs(2, params.isPaused)

      await expect(factory.getAgentCreationSettings(0)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory.getAgentCreationSettings(3)).to.be.revertedWithCustomError(factory, "OutOfRange")
    })
    it("can create agent pt 4", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let agentRes = await factory.connect(user1).callStatic['createAgent(uint256)'](2);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createAgent(uint256)'](2);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, factory.address, agentRes.agentID);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(factory.address, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createAgent", tx);
    });
  });

  describe("agent creation via factory eoa pt 2", function () {
    it("can create agent pt 5", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let agentRes = await agentNft.connect(user1).callStatic.createAgent(blastAccountImplementation.address);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await agentNft.connect(user1).createAgent(blastAccountImplementation.address);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount1 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress);
      l1DataFeeAnalyzer.register("createAgent", tx);
    });
    it("can create agent pt 6", async function () {
      // create
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let agentRes = await agentNft.connect(user1).callStatic.createAgent(blastAccountImplementation.address);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await agentNft.connect(user1).createAgent(blastAccountImplementation.address);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount1 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress);
      tbaccount2 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createAgent", tx);
    });
  });

  describe("agent creation via factory contract pt 2", function () {
    it("can getAgentCreationSettings", async function () {
      var settings = await factory.getAgentCreationSettings(1);
      var { agentImplementation, initializationCalls, isPaused } = settings
      //console.log(settings)
      expect(agentImplementation).eq(blastAccountImplementation.address)
    });
    it("can create agent pt 7", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let extraData = [] // no data
      let agentRes = await factory.connect(user1).callStatic['createAgent(uint256,bytes[])'](2,extraData);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createAgent(uint256,bytes[])'](2,extraData);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, factory.address, agentRes.agentID);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(factory.address, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createAgent", tx);
    });
    it("can create agent pt 8", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let extraData = ["0x"] // single call to receive
      let agentRes = await factory.connect(user1).callStatic['createAgent(uint256,bytes[])'](2,extraData);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createAgent(uint256,bytes[])'](2,extraData);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, factory.address, agentRes.agentID);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(factory.address, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createAgent", tx);
    });
    it("create fails if extra data is bad", async function () {
      await expect(factory.connect(user1)['createAgent(uint256,bytes[])'](1,["0x1"])).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createAgent(uint256,bytes[])'](1,["0x12"])).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createAgent(uint256,bytes[])'](1,["0x12345678"])).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createAgent(uint256,bytes[])'](1,["0x1234567800000000000"])).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createAgent(uint256,bytes[])'](1,[multicallSighash+"a"])).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createAgent(uint256,bytes[])'](1,[multicallSighash+"ab"])).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createAgent(uint256,bytes[],address)'](1,["0x1"],user1.address)).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createAgent(uint256,bytes[],address)'](1,["0x12"],user1.address)).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createAgent(uint256,bytes[],address)'](1,["0x12345678"],user1.address)).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createAgent(uint256,bytes[],address)'](1,["0x1234567800000000000"],user1.address)).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createAgent(uint256,bytes[],address)'](1,[multicallSighash+"a"],user1.address)).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createAgent(uint256,bytes[],address)'](1,[multicallSighash+"ab"],user1.address)).to.be.revertedWithCustomError;
    });
    it("owner can postAgentCreationSettings pt 3", async function () {let params = {
        agentImplementation: blastAccountImplementation.address,
        initializationCalls: [],
        isPaused: false,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      let tx = await factory.connect(owner).postAgentCreationSettings(params)
      expect(await factory.getAgentCreationSettingsCount()).eq(3)
      let res = await factory.getAgentCreationSettings(3)
      expect(res.agentImplementation).eq(params.agentImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isPaused).eq(params.isPaused)
      expect(res.giveTokenList).deep.eq(params.giveTokenList)
      expect(res.giveTokenAmounts).deep.eq(params.giveTokenAmounts)
      await expect(tx).to.emit(factory, "AgentCreationSettingsPosted").withArgs(3)
      await expect(tx).to.emit(factory, "AgentCreationSettingsPaused").withArgs(3, params.isPaused)
    })
    it("can create agent pt 9", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let extraData = ["0x"] // single call to receive
      let agentRes = await factory.connect(user1).callStatic['createAgent(uint256,bytes[])'](3,extraData);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createAgent(uint256,bytes[])'](3,extraData);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, factory.address, agentRes.agentID);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(factory.address, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createAgent", tx);
    });
    it("owner can postAgentCreationSettings pt 4", async function () {
      let params = {
        agentImplementation: blastAccountImplementation.address,
        initializationCalls: [],
        isPaused: false,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      let tx = await factory.connect(owner).postAgentCreationSettings(params)
      expect(await factory.getAgentCreationSettingsCount()).eq(4)
      let res = await factory.getAgentCreationSettings(4)
      expect(res.agentImplementation).eq(params.agentImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isPaused).eq(params.isPaused)
      expect(res.giveTokenList).deep.eq(params.giveTokenList)
      expect(res.giveTokenAmounts).deep.eq(params.giveTokenAmounts)
      await expect(tx).to.emit(factory, "AgentCreationSettingsPosted").withArgs(4)
      await expect(tx).to.emit(factory, "AgentCreationSettingsPaused").withArgs(4, params.isPaused)
    })
    it("can create agent pt 10", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let extraData = ["0x"] // single call to receive
      let agentRes = await factory.connect(user1).callStatic['createAgent(uint256,bytes[])'](4,extraData);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createAgent(uint256,bytes[])'](4,extraData);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, factory.address, agentRes.agentID);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(factory.address, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createAgent", tx);
    });
    it("can create agent pt 11", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let extraData = ["0x", blastAccountImplementation.interface.encodeFunctionData("execute", [user1.address, 0, "0x", 0])] // more calls
      let agentRes = await factory.connect(user1).callStatic['createAgent(uint256,bytes[])'](4,extraData);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createAgent(uint256,bytes[])'](4,extraData);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, factory.address, agentRes.agentID);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(factory.address, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createAgent", tx);
    });
    it("can create agent pt 12", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user2.address);
      let agentID = ts.add(1);
      let agentRes = await factory.connect(user1).callStatic['createAgent(uint256,address)'](4,user2.address);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createAgent(uint256,address)'](4,user2.address);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, factory.address, agentRes.agentID);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(factory.address, user2.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user2.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user2.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createAgent", tx);

    });
    it("can create agent pt 13", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user2.address);
      let agentID = ts.add(1);
      let extraData = ["0x"] // single call to receive
      let agentRes = await factory.connect(user1).callStatic['createAgent(uint256,bytes[],address)'](4,extraData,user2.address);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      await user3.sendTransaction({
        to: factory.address,
        value: 5
      })
      let tx = await factory.connect(user1)['createAgent(uint256,bytes[],address)'](4,extraData,user2.address, { value: 70 });
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, factory.address, agentRes.agentID);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(factory.address, user2.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user2.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user2.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createAgent", tx);
      expect(await provider.getBalance(factory.address)).eq(75)
      expect(await provider.getBalance(agentInfo.agentAddress)).eq(0)
    });
    it("can create agent pt 14", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let extraData = ["0x"] // single call to receive
      let agentRes = await factory.connect(user1).callStatic['createAgent(uint256)'](2);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createAgent(uint256)'](2, { value: 20 });
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, factory.address, agentRes.agentID);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(factory.address, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createAgent", tx);
      expect(await provider.getBalance(factory.address)).eq(95)
      expect(await provider.getBalance(agentInfo.agentAddress)).eq(0)
    });
    /*
    it("cannot create agent with bad init code pt 1", async function () {
      // revert with reason
      let agentInitializationCode32 = revertModule.interface.encodeFunctionData("revertWithReason", [])
      let agentInitializationCode31 = modulePack100.interface.encodeFunctionData("diamondCut", [[{
        facetAddress: revertModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [agentInitializationCode32]
      }], AddressZero, "0x"])
      let txdatas3 = [agentInitializationCode31, agentInitializationCode32]
      let agentInitializationCode33 = modulePack100.interface.encodeFunctionData("multicall", [txdatas3])
      let params = {
        agentImplementation: blastAccountImplementation.address,
        initializationCalls: [agentInitializationCode1, agentInitializationCode33],
        isPaused: false,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      let tx = await factory.connect(owner).postAgentCreationSettings(params)
      expect(await factory.getAgentCreationSettingsCount()).eq(5)
      await expect(factory.connect(user1)['createAgent(uint256)'](5)).to.be.revertedWithCustomError;//(newAccount, "RevertWithReason")
    })
    it("cannot create agent with bad init code pt 2", async function () {
      // revert without reason
      let agentInitializationCode42 = revertModule.interface.encodeFunctionData("revertWithoutReason", [])
      let agentInitializationCode41 = modulePack100.interface.encodeFunctionData("diamondCut", [[{
        facetAddress: revertModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [agentInitializationCode42]
      }], AddressZero, "0x"])
      let txdatas4 = [agentInitializationCode41, agentInitializationCode42]
      let agentInitializationCode43 = modulePack100.interface.encodeFunctionData("multicall", [txdatas4])
      let params = {
        agentImplementation: blastAccountImplementation.address,
        initializationCalls: [agentInitializationCode1, agentInitializationCode43],
        isPaused: false,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      let tx = await factory.connect(owner).postAgentCreationSettings(params)
      expect(await factory.getAgentCreationSettingsCount()).eq(6)
      await expect(factory.connect(user1)['createAgent(uint256)'](6)).to.be.revertedWithCustomError;//(factory, "CallFailed");
    })
    it("cannot create agent with bad init code pt 3", async function () {
      await expect(user1.sendTransaction({
        to: revertModule.address,
        data: "0x"
      })).to.be.reverted;
      await expect(user1.sendTransaction({
        to: revertModule.address,
        data: "0xabcd"
      })).to.be.reverted;
    })
    it("cannot create agent with bad init code pt 4", async function () {
      revertAccount = await deployContract(deployer, "RevertAccount", []) as RevertAccount;
      await expect(user1.sendTransaction({
        to: revertAccount.address,
        data: "0x"
      })).to.be.reverted;
      await expect(user1.sendTransaction({
        to: revertAccount.address,
        data: "0xabcd"
      })).to.be.reverted;
    })
    */
    it("post filler", async function () {
      let params = {
        agentImplementation: blastAccountImplementation.address,
        initializationCalls: [],
        isPaused: true,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      let tx1 = await factory.connect(owner).postAgentCreationSettings(params)
      let tx2 = await factory.connect(owner).postAgentCreationSettings(params)
    })
    it("owner can postAgentCreationSettings pt 7", async function () {
      let params = {
        agentImplementation: blastAccountImplementation.address,
        initializationCalls: [],
        isPaused: false,
        giveTokenList: [AddressZero, erc20a.address],
        giveTokenAmounts: [60, WeiPerEther.mul(100)],
      }
      let tx = await factory.connect(owner).postAgentCreationSettings(params)
      expect(await factory.getAgentCreationSettingsCount()).eq(7)
      let res = await factory.getAgentCreationSettings(7)
      expect(res.agentImplementation).eq(params.agentImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isPaused).eq(params.isPaused)
      expect(res.giveTokenList).deep.eq(params.giveTokenList)
      expect(res.giveTokenAmounts).deep.eq(params.giveTokenAmounts)
      await expect(tx).to.emit(factory, "AgentCreationSettingsPosted").withArgs(7)
      await expect(tx).to.emit(factory, "AgentCreationSettingsPaused").withArgs(7, params.isPaused)
      await erc20a.mint(factory.address, WeiPerEther.mul(125));
    })
    it("cannot postAgentCreationSettings with length mismatch", async function () {
      let params = {
        agentImplementation: blastAccountImplementation.address,
        initializationCalls: [],
        isPaused: false,
        giveTokenList: [AddressZero],
        giveTokenAmounts: [60, WeiPerEther.mul(100)],
      }
      await expect(factory.connect(owner).postAgentCreationSettings(params)).to.be.revertedWithCustomError(factory, "LengthMismatch")
    })
    it("can create agent pt 15", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let extraData = ["0x"] // single call to receive
      let agentRes = await factory.connect(user1).callStatic['createAgent(uint256)'](7);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createAgent(uint256)'](7);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, factory.address, agentRes.agentID);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(factory.address, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createAgent", tx);
      expect(await provider.getBalance(factory.address)).eq(35)
      expect(await provider.getBalance(agentInfo.agentAddress)).eq(60)
      expect(await erc20a.balanceOf(factory.address)).eq(WeiPerEther.mul(25))
      expect(await erc20a.balanceOf(agentInfo.agentAddress)).eq(WeiPerEther.mul(100))
    });
    it("can create agent pt 16", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let extraData = ["0x"] // single call to receive
      let agentRes = await factory.connect(user1).callStatic['createAgent(uint256)'](7);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createAgent(uint256)'](7);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, factory.address, agentRes.agentID);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(factory.address, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createAgent", tx);
      expect(await provider.getBalance(factory.address)).eq(0)
      expect(await provider.getBalance(agentInfo.agentAddress)).eq(35)
      expect(await erc20a.balanceOf(factory.address)).eq(0)
      expect(await erc20a.balanceOf(agentInfo.agentAddress)).eq(WeiPerEther.mul(25))
    });
    it("can create agent pt 17", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let extraData = ["0x"] // single call to receive
      let agentRes = await factory.connect(user1).callStatic['createAgent(uint256)'](7);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createAgent(uint256)'](7);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, factory.address, agentRes.agentID);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(factory.address, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createAgent", tx);
      expect(await provider.getBalance(factory.address)).eq(0)
      expect(await provider.getBalance(agentInfo.agentAddress)).eq(0)
      expect(await erc20a.balanceOf(factory.address)).eq(0)
      expect(await erc20a.balanceOf(agentInfo.agentAddress)).eq(WeiPerEther.mul(0))
    });
  })

  // bypasses the nft
  describe("agent creation via registry", function () {
    it("account with nft on other chain has no owner on this chain", async function () {
      // create agent
      let salt = toBytes32(0);
      let tokenId2 = 2;
      let chainId2 = 9999;
      let predictedAddress = await erc6551Registry.account(blastAccountImplementation.address, salt, chainId2, agentNft.address, tokenId2);
      let tx = await erc6551Registry.createAccount(blastAccountImplementation.address, salt, chainId2, agentNft.address, tokenId2);
      await expectDeployed(predictedAddress)
      let bbaccount2 = await ethers.getContractAt("BlastooorGenesisAgentAccount", predictedAddress);
      /*
      // before init
      await expect(bbaccount2.owner()).to.be.reverted;
      await expect(bbaccount2.token()).to.be.reverted;
      // init
      let diamondCutInit = [
        {
          facetAddress: modulePack100.address,
          action: FacetCutAction.Add,
          functionSelectors: calcSighashes(modulePack100, 'ModulePack100'),
        },
      ]
      await bbaccount2.initialize(diamondCutInit, dataStore.address)
      // after init
      */
      expect(await bbaccount2.owner()).eq(AddressZero);
      let tokenRes = await bbaccount2.token();
      expect(tokenRes.chainId).eq(chainId2);
      expect(tokenRes.tokenContract).eq(agentNft.address);
      expect(tokenRes.tokenId).eq(tokenId2);
      expect(await bbaccount2.state()).eq(0);
      expect(await bbaccount2['isValidSigner(address,bytes)'](AddressZero, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
      expect(await bbaccount2['isValidSigner(address,bytes)'](user1.address, "0x")).eq(MAGIC_VALUE_0);
      expect(await bbaccount2['isValidSigner(address,bytes)'](user1.address, "0x00abcd")).eq(MAGIC_VALUE_0);
      expect(await bbaccount2['isValidSigner(address,bytes)'](user2.address, "0x")).eq(MAGIC_VALUE_0);
      //expect(await bbaccount2.isValidSignature(toBytes32(0), "0x")).eq(MAGIC_VALUE_0);
      await expect(bbaccount2.isValidSignature(toBytes32(0), "0x")).to.be.reverted;
      l1DataFeeAnalyzer.register("registry.createAccount", tx);
    });
  })

  const agentMetadatas = [
    { // created by eoa, improperly setup
      agentID: 1,
      accountType: "BlastooorGenesisAgentAccount",
      createdBy: "EOA",
      createdState: "correct",
    },{ // created by factory, improperly setup
      agentID: 2,
      accountType: "BlastooorGenesisAgentAccount",
      createdBy: "contract",
      createdState: "correct",
    },{ // created by factory, properly setup
      agentID: 3,
      accountType: "BlastooorGenesisAgentAccount",
      createdBy: "contract",
      createdState: "correct",
    },{ // created by factory, properly setup
      agentID: 4,
      accountType: "BlastooorGenesisAgentAccount",
      createdBy: "contract",
      createdState: "correct",
    },{ // created by eoa, improperly setup
      agentID: 5,
      accountType: "BlastooorGenesisAgentAccount",
      createdBy: "EOA",
      createdState: "correct",
    },{ // created by eoa, properly setup
      agentID: 6,
      accountType: "BlastooorGenesisAgentAccount",
      createdBy: "EOA",
      createdState: "correct",
    },{ // created by factory, properly setup
      agentID: 7,
      accountType: "BlastooorGenesisAgentAccount",
      createdBy: "contract",
      createdState: "correct",
    },{ // created by factory, properly setup
      agentID: 8,
      accountType: "BlastooorGenesisAgentAccount",
      createdBy: "contract",
      createdState: "correct",
      extraModules: "fallback",
    },{ // created by factory, properly setup
      agentID: 9,
      accountType: "BlastooorGenesisAgentAccount",
      createdBy: "contract",
      createdState: "correct",
      extraModules: "fallback",
    },{ // created by factory, properly setup
      agentID: 10,
      accountType: "BlastooorGenesisAgentAccount",
      createdBy: "contract",
      createdState: "correct",
      extraModules: "fallback",
    },{ // created by factory, properly setup
      agentID: 11,
      accountType: "BlastooorGenesisAgentAccount",
      createdBy: "contract",
      createdState: "correct",
      extraModules: "fallback",
      initialStateNum: 1
    },{ // created by factory, properly setup
      agentID: 12,
      accountType: "BlastooorGenesisAgentAccount",
      createdBy: "contract",
      createdState: "correct",
      extraModules: "fallback",
    },{ // created by factory, properly setup
      agentID: 13,
      accountType: "BlastooorGenesisAgentAccount",
      createdBy: "contract",
      createdState: "correct",
      extraModules: "fallback",
    },{ // created by factory, properly setup
      agentID: 14,
      accountType: "BlastooorGenesisAgentAccount",
      createdBy: "contract",
      createdState: "correct",
    },{ // created by factory, properly setup
      agentID: 15,
      accountType: "BlastooorGenesisAgentAccount",
      createdBy: "contract",
      createdState: "correct",
    },{ // created by factory, properly setup
      agentID: 16,
      accountType: "BlastooorGenesisAgentAccount",
      createdBy: "contract",
      createdState: "correct",
    },{ // created by factory, properly setup
      agentID: 17,
      accountType: "BlastooorGenesisAgentAccount",
      createdBy: "contract",
      createdState: "correct",
    }
  ];

  describe("agents in prod", function () {
    for(const agentMetadata of agentMetadatas) {
      const { agentID, accountType, createdBy, createdState, initialStateNum } = agentMetadata;
      const extraModules = agentMetadata.extraModules || ""
      let agentAccount:any;
      let agentOwner: any;

      describe(`agentID ${agentID} created by ${createdBy} type ${accountType}`, function () {

        it("can get basic info", async function () {
          // get info
          expect(await agentNft.exists(agentID)).eq(true);
          let agentInfo = await agentNft.getAgentInfo(agentID);
          if(accountType == "BlastooorGenesisAgentAccount") agentAccount = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress);
          //else if(accountType == "BlastooorGenesisAgentAccount") agentAccount = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
          //else if(accountType == "BlastooorGenesisAgentAccount") agentAccount = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress);
          else if(accountType == "BlastooorGenesisAgentAccount" || accountType == "BlastooorGenesisAgentAccount") {
            agentAccount = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress);
          }
          else throw new Error("unknown agent type");

          expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
          expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
        })
        if(createdState == "correct") {
          it("account begins with correct state", async function () {
            // get owner
            let ownerAddress = await agentAccount.owner();
            if(ownerAddress == user1.address) agentOwner = user1;
            else if(ownerAddress == user2.address) agentOwner = user2;
            else if(ownerAddress == user3.address) agentOwner = user3;
            else throw new Error("unknown owner");
            // get token
            let tokenRes = await agentAccount.token();
            expect(tokenRes.chainId).eq(chainID);
            expect(tokenRes.tokenContract).eq(agentNft.address);
            expect(tokenRes.tokenId).eq(agentID);
            // other info
            //expect(await agentAccount.state()).eq(initialStateNum||0);
            /*
            expect(await agentAccount.isValidSigner(agentOwner.address)).eq(true);
            expect(await agentAccount.isValidSigner(deployer.address)).eq(false);
            expect(await agentAccount.isValidSigner(AddressZero)).eq(false);
            expect(await agentAccount.isValidSigner(agentOwner.address, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
            expect(await agentAccount.isValidSigner(agentOwner.address, "0x00abcd")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
            expect(await agentAccount.isValidSigner(deployer.address, "0x")).eq(MAGIC_VALUE_0);
            expect(await agentAccount.isValidSigner(AddressZero, "0x")).eq(MAGIC_VALUE_0);
            */
            expect(await agentAccount['isValidSigner(address,bytes)'](agentOwner.address, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
            expect(await agentAccount['isValidSigner(address,bytes)'](agentOwner.address, "0x00abcd")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
            expect(await agentAccount['isValidSigner(address,bytes)'](deployer.address, "0x")).eq(MAGIC_VALUE_0);
            expect(await agentAccount['isValidSigner(address,bytes)'](AddressZero, "0x")).eq(MAGIC_VALUE_0);
            await expect(agentAccount.isValidSignature(toBytes32(0), "0x")).to.be.reverted;
            expect(await agentAccount.supportsInterface("0x01ffc9a7")).eq(true); // ERC165
            expect(await agentAccount.supportsInterface("0x6faff5f1")).eq(true); // ERC6551Account
            expect(await agentAccount.supportsInterface("0x51945447")).eq(true); // ERC6551Executable
            expect(await agentAccount.supportsInterface("0xffffffff")).eq(false);
            expect(await agentAccount.supportsInterface("0x00000000")).eq(false);
          });
          //it("it can isValidSignature on an eoa", async function () {})
          it("it can isValidSignature on an erc1271", async function () {
            let tx1 = await agentNft.connect(agentOwner).transferFrom(agentOwner.address, mockERC1271.address, agentID);
            expect(await agentNft.ownerOf(agentID)).eq(mockERC1271.address)
            expect(await agentAccount['isValidSigner(address,bytes)'](agentOwner.address, "0x")).eq(MAGIC_VALUE_0);
            expect(await agentAccount['isValidSigner(address,bytes)'](agentOwner.address, "0x00abcd")).eq(MAGIC_VALUE_0);
            expect(await agentAccount['isValidSigner(address,bytes)'](mockERC1271.address, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
            expect(await agentAccount['isValidSigner(address,bytes)'](mockERC1271.address, "0x00abcd")).eq(MAGIC_VALUE_IS_VALID_SIGNER);

            await expect(agentAccount.isValidSignature(toBytes32(0), "0x")).to.be.reverted;
            await expect(agentAccount.isValidSignature(toBytes32(123), "0x9988776655")).to.be.reverted;
            var signature = createMockSignatureForContract(mockERC1271);
            expect(await agentAccount.isValidSignature(toBytes32(0), signature)).eq(MAGIC_VALUE_IS_VALID_SIGNATURE);
          })
        }
        else if(createdState == "incorrect") {
          it("account begins with incorrect state", async function () {
            await expect(agentAccount.owner()).to.be.reverted;
            await expect(agentAccount.token()).to.be.reverted;
            await expect(agentAccount.state()).to.be.reverted;
            //await expect(agentAccount.isValidSigner(user1.address, "0x")).to.be.reverted;
            await expect(agentAccount['isValidSigner(address,bytes)'](user1.address, "0x")).to.be.reverted;
            await expect(agentAccount.isValidSignature(toBytes32(0), "0x")).to.be.reverted;
            await expect(agentAccount.supportsInterface("0x01ffc9a7")).to.be.reverted;
          });
        }
        else {
          throw new Error(`unknown createdState ${createdState}`)
        }
        //it("can receive gas token", async function () {})

      });
    }
  });

  describe("metadata", function () {
    it("has the correct name and symbol", async function () {
      expect(await agentNft.name()).eq("Agents")
      expect(await agentNft.symbol()).eq("AGENTS")
    })
  })

  describe("tokenURI", function () {
    let base = "https://stats.agentfi.io/agents/?chainID=31337&agentID=";
    let uri = "https://stats.agentfi.io/agents/?chainID=31337&agentID=1";
    it("starts as id", async function () {
      expect(await agentNft.baseURI()).eq("");
      expect(await agentNft.tokenURI(1)).eq("1");
    });
    it("non owner cannot set base", async function () {
      await expect(agentNft.connect(user1).setBaseURI(base)).to.be.revertedWithCustomError(agentNft, "NotContractOwner");
    });
    it("owner can set base", async function () {
      let tx = await agentNft.connect(owner).setBaseURI(base);
      await expect(tx).to.emit(agentNft, "BaseURISet").withArgs(base);
      l1DataFeeAnalyzer.register("setBaseURI", tx);
    });
    it("can get new uri", async function () {
      expect(await agentNft.baseURI()).eq(base);
      expect(await agentNft.tokenURI(1)).eq(uri);
    });
    it("cannot get uri of nonexistant token", async function () {
      await expect(agentNft.tokenURI(0)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      await expect(agentNft.tokenURI(999)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
    });
  });

  describe("contractURI", function () {
    let uri = "https://stats-cdn.agentfi.io/contract-uri.json";
    it("starts null", async function () {
      expect(await agentNft.contractURI()).eq("");
    });
    it("non owner cannot set uri", async function () {
      await expect(agentNft.connect(user1).setContractURI(uri)).to.be.revertedWithCustomError(agentNft, "NotContractOwner");
    });
    it("owner can set uri", async function () {
      let tx = await agentNft.connect(owner).setContractURI(uri);
      await expect(tx).to.emit(agentNft, "ContractURISet").withArgs(uri);
      l1DataFeeAnalyzer.register("setContractURI", tx);
    });
    it("can get new uri", async function () {
      expect(await agentNft.contractURI()).eq(uri);
    });
  });

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
