/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish, utils } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;

import { IERC6551Registry, BlastooorGenesisAgents, AgentFactory01, BlastooorGenesisFactory, MockERC20, MockERC721, RevertAccount, MockERC1271, GasCollector, BlastooorGenesisAgentAccount, AgentRegistry, BlastooorAccountFactory, BalanceFetcher } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { toBytes32 } from "./../scripts/utils/setStorage";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { deployContract } from "../scripts/utils/deployContract";
import L1DataFeeAnalyzer from "../scripts/utils/L1DataFeeAnalyzer";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../scripts/utils/diamond"
import { sign, assembleSignature, getMintFromAllowlistDigest, getMintFromAllowlistSignature } from "./../scripts/utils/signature";

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const { formatUnits } = ethers.utils;


const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";
const BLAST_POINTS_ADDRESS            = "0x2fc95838c71e76ec69ff817983BFf17c710F34E0";
const BLAST_POINTS_OPERATOR_ADDRESS   = "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";
const ENTRY_POINT_ADDRESS             = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const MULTICALL_FORWARDER_ADDRESS     = ""; // v1.0.1

const WETH_ADDRESS                    = "0x4300000000000000000000000000000000000004";
const USDB_ADDRESS                    = "0x4300000000000000000000000000000000000003";

const THRUSTER_ROUTER_ADDRESS_030     = "0x98994a9A7a2570367554589189dC9772241650f6"; // 0.3% fee
const THRUSTER_ROUTER_ADDRESS_100     = "0x44889b52b71E60De6ed7dE82E2939fcc52fB2B4E"; // 1% fee
const THRUSTER_LP_TOKEN_ADDRESS       = "0x12c69BFA3fb3CbA75a1DEFA6e976B87E233fc7df";

const HYPERLOCK_STAKING_ADDRESS       = "0xC3EcaDB7a5faB07c72af6BcFbD588b7818c4a40e";

//const UNIVERSAL_ROUTER_ADDRESS        = "";
const RING_SWAP_V2_ROUTER_ADDRESS     = "0x7001F706ACB6440d17cBFaD63Fa50a22D51696fF";
const RING_STAKING_REWARDS_ADDRESS    = "0xEff87A51f5Abd015F1AFCD5737BBab450eA15A24";
const RING_FWWETH_ADDRESS             = "0x66714DB8F3397c767d0A602458B5b4E3C0FE7dd1";
const RING_FWUSDB_ADDRESS             = "0x866f2C06B83Df2ed7Ca9C2D044940E7CD55a06d6";
const RING_LP_TOKEN_ADDRESS           = "0x9BE8a40C9cf00fe33fd84EAeDaA5C4fe3f04CbC3";
const RING_FWLP_TOKEN_ADDRESS         = "0xA3F8128166E54d49A65ec2ba12b45965E4FA87C9";
//const RING_ADDRESS                    = "";
const RING_ADDRESS                    = "0x4300000000000000000000000000000000000003";
const RING_STAKING_REWARDS_INDEX      = 3;

const BLASTERSWAP_ROUTER_ADDRESS      = "0xc972FaE6b524E8A6e0af21875675bF58a3133e60";
const BLASTERSWAP_LP_TOKEN_ADDRESS    = "0x3b5d3f610Cc3505f4701E9FB7D0F0C93b7713adD";

const MAGIC_VALUE_0 = "0x00000000";
const MAGIC_VALUE_IS_VALID_SIGNER = "0x523e3260";
const MAGIC_VALUE_IS_VALID_SIGNATURE = "0x1626ba7e";

const STRATEGY_MANAGER_ROLE = "0x4170d100a3a3728ae51207936ee755ecaa64a7f6e9383c642ab204a136f90b1b";

describe("MultiplierMaxxooorModuleB", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let strategyManager: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  let erc6551Registry: IERC6551Registry;

  let gasCollector: GasCollector;
  let genesisAgentNft: BlastooorGenesisAgents;
  let strategyAgentNft: BlastooorStrategyAgents;
  let genesisAccountImplementation: BlastooorGenesisAgentAccount; // the base implementation for token bound accounts
  let strategyAccountImplementation: BlastooorStrategyAgentAccount; // the base implementation for token bound accounts
  let genesisFactory: BlastooorGenesisFactory;
  let strategyFactory: BlastooorStrategyFactory;
  let dispatcher: Dispatcher;
  let strategyModuleA: DexBalancerModuleA;
  let strategyModuleB: MultiplierMaxxooorModuleB;
  let multicallForwarder: MulticallForwarder;
  let agentRegistry: AgentRegistry;
  let genesisAccountFactory: BlastooorAccountFactory;
  let balanceFetcher: BalanceFetcher;
  let test1Callee: Test1Callee;
  let revertAccount: RevertAccount;

  let tbaccountG1A: BlastooorGenesisAgentAccount; // an account bound to a token
  let tbaccountG1B: BlastooorGenesisAgentAccount; // an account bound to a token
  let tbaccountG1C: BlastooorGenesisAgentAccount; // an account bound to a token
  let tbaccountG2A: BlastooorGenesisAgentAccount; // an account bound to a token
  let tbaccountG2B: BlastooorGenesisAgentAccount; // an account bound to a token
  let tbaccountS1: BlastooorStrategyAgentAccount; // an account bound to a token
  let tbaccountS2: BlastooorStrategyAgentAccount; // an account bound to a token
  let tbaccountS3: BlastooorStrategyAgentAccount; // an account bound to a token
  let tbaccountS4: BlastooorStrategyAgentAccount; // an account bound to a token
  let tbaccountS5: BlastooorStrategyAgentAccount; // an account bound to a token
  let tbaccountS6: BlastooorStrategyAgentAccount; // an account bound to a token
  let tbaccountS7: BlastooorStrategyAgentAccount; // an account bound to a token
  let agentInitializationCode1: any;
  let agentInitializationCode2: any;

  let erc20a: MockERC20;
  let erc20b: MockERC20;
  let erc20c: MockERC20;
  let weth: MockERC20;
  let usdb: MockERC20;

  let mockERC1271: MockERC1271;

  let thrusterRouter_030: IThrusterRouter;
  let thrusterRouter_100: IThrusterRouter;
  let thrusterLpToken: MockERC20;

  let hyperlockStaking: IHyperlockStaking;

  let ring: MockERC20;
  let ringLpToken: MockERC20;
  let ringStakingRewards: IFixedStakingRewards;

  let blasterRouter: IBlasterswapV2Router02;
  let blasterLpToken: MockERC20;

  let collectionListGenesis = []
  let collectionListStrategy = []
  let collectionListAll = []
  let tokenList = []

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

    erc20a = await deployContract(deployer, "MockERC20", [`Token A`, `TKNA`, 18]) as MockERC20;
    erc20b = await deployContract(deployer, "MockERC20", [`Token B`, `TKNB`, 18]) as MockERC20;
    erc20c = await deployContract(deployer, "MockERC20", [`Token C`, `TKNC`, 18]) as MockERC20;

    await expectDeployed(ERC6551_REGISTRY_ADDRESS); // expect to be run on a fork of a testnet with registry deployed
    await expectDeployed(WETH_ADDRESS);
    await expectDeployed(USDB_ADDRESS);

    erc6551Registry = await ethers.getContractAt("IERC6551Registry", ERC6551_REGISTRY_ADDRESS) as IERC6551Registry;

    weth = await ethers.getContractAt("MockERC20", WETH_ADDRESS) as MockERC20;
    usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS) as MockERC20;

    thrusterRouter_030 = await ethers.getContractAt("IThrusterRouter", THRUSTER_ROUTER_ADDRESS_030) as IThrusterRouter;
    thrusterRouter_100 = await ethers.getContractAt("IThrusterRouter", THRUSTER_ROUTER_ADDRESS_100) as IThrusterRouter;
    thrusterLpToken = await ethers.getContractAt("MockERC20", THRUSTER_LP_TOKEN_ADDRESS) as MockERC20;

    hyperlockStaking = await ethers.getContractAt("IHyperlockStaking", HYPERLOCK_STAKING_ADDRESS) as IHyperlockStaking;

    //ring = await ethers.getContractAt("MockERC20", RING_ADDRESS) as MockERC20;
    ringLpToken = await ethers.getContractAt("MockERC20", RING_LP_TOKEN_ADDRESS) as MockERC20;
    ringStakingRewards = await ethers.getContractAt("IFixedStakingRewards", RING_STAKING_REWARDS_ADDRESS) as IFixedStakingRewards;

    blasterRouter = await ethers.getContractAt("IBlasterswapV2Router02", BLASTERSWAP_ROUTER_ADDRESS) as IBlasterswapV2Router02;
    blasterLpToken = await ethers.getContractAt("MockERC20", BLASTERSWAP_LP_TOKEN_ADDRESS) as MockERC20;

    tokenList = [AddressZero, WETH_ADDRESS, USDB_ADDRESS, erc20a.address]
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
    it("can deploy BlastooorGenesisAgents ERC721", async function () {
      genesisAgentNft = await deployContract(deployer, "BlastooorGenesisAgents", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ERC6551_REGISTRY_ADDRESS]) as BlastooorGenesisAgents;
      await expectDeployed(genesisAgentNft.address);
      expect(await genesisAgentNft.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy BlastooorGenesisAgents", genesisAgentNft.deployTransaction);
      expect(await genesisAgentNft.totalSupply()).eq(0);
      expect(await genesisAgentNft.balanceOf(user1.address)).eq(0);
      expect(await genesisAgentNft.getERC6551Registry()).eq(ERC6551_REGISTRY_ADDRESS);
      collectionListGenesis = [genesisAgentNft.address]
    });
    it("can deploy MulticallForwarder", async function () {
      multicallForwarder = await deployContract(deployer, "MulticallForwarder", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]) as MulticallForwarder;
      await expectDeployed(multicallForwarder.address);
      l1DataFeeAnalyzer.register("deploy MulticallForwarder", multicallForwarder.deployTransaction);
    });
    it("can deploy BlastooorGenesisAgentAccount implementation", async function () {
      genesisAccountImplementation = await deployContract(deployer, "BlastooorGenesisAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero]) as BlastooorGenesisAgentAccount;
      await expectDeployed(genesisAccountImplementation.address);
      l1DataFeeAnalyzer.register("deploy BlastooorGenesisAgentAccount impl", genesisAccountImplementation.deployTransaction);
    });
    it("can deploy BlastooorGenesisFactory", async function () {
      genesisFactory = await deployContract(deployer, "BlastooorGenesisFactory", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, genesisAgentNft.address]) as BlastooorGenesisFactory;
      await expectDeployed(genesisFactory.address);
      expect(await genesisFactory.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy BlastooorGenesisFactory", genesisFactory.deployTransaction);
    });
    it("can deploy AgentRegistry", async function () {
      agentRegistry = await deployContract(deployer, "AgentRegistry", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]) as AgentRegistry;
      await expectDeployed(agentRegistry.address);
      expect(await agentRegistry.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy AgentRegistry", agentRegistry.deployTransaction);
    });
    it("can deploy BlastooorAccountFactory", async function () {
      genesisAccountFactory = await deployContract(deployer, "BlastooorAccountFactory", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, multicallForwarder.address, genesisAgentNft.address, agentRegistry.address, ERC6551_REGISTRY_ADDRESS]) as BlastooorAccountFactory;
      await expectDeployed(genesisAccountFactory.address);
      expect(await genesisAccountFactory.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy BlastooorAccountFactory", genesisAccountFactory.deployTransaction);
    });
    it("can deploy BlastooorStrategyAgents ERC721", async function () {
      strategyAgentNft = await deployContract(deployer, "BlastooorStrategyAgents", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]) as BlastooorStrategyAgents;
      await expectDeployed(strategyAgentNft.address);
      expect(await strategyAgentNft.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy BlastooorStrategyAgents", strategyAgentNft.deployTransaction);
      expect(await strategyAgentNft.totalSupply()).eq(0);
      expect(await strategyAgentNft.balanceOf(user1.address)).eq(0);
      collectionListStrategy = [strategyAgentNft.address]
      collectionListAll = [genesisAgentNft.address, strategyAgentNft.address]
    });
    it("can deploy BlastooorStrategyAgentAccount implementation", async function () {
      strategyAccountImplementation = await deployContract(deployer, "BlastooorStrategyAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero]) as BlastooorGenesisAgentAccount;
      await expectDeployed(strategyAccountImplementation.address);
      l1DataFeeAnalyzer.register("deploy BlastooorStrategyAgentAccount impl", strategyAccountImplementation.deployTransaction);
    });
    it("can deploy BlastooorStrategyFactory", async function () {
      strategyFactory = await deployContract(deployer, "BlastooorStrategyFactory", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, genesisAgentNft.address, strategyAgentNft.address, ERC6551_REGISTRY_ADDRESS, agentRegistry.address]) as BlastooorStrategyFactory;
      await expectDeployed(strategyFactory.address);
      expect(await strategyFactory.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy BlastooorStrategyFactory", strategyFactory.deployTransaction);
    });
    it("can deploy Dispatcher", async function () {
      dispatcher = await deployContract(deployer, "Dispatcher", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]);
      await expectDeployed(dispatcher.address);
      expect(await dispatcher.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy Dispatcher", dispatcher.deployTransaction);
    })
    it("can deploy DexBalancerModuleA", async function () {
      strategyModuleA = await deployContract(deployer, "DexBalancerModuleA", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]);
      await expectDeployed(strategyModuleA.address);
      l1DataFeeAnalyzer.register("deploy DexBalancerModuleA", strategyModuleA.deployTransaction);
    })
    it("can deploy MultiplierMaxxooorModuleB", async function () {
      strategyModuleB = await deployContract(deployer, "MultiplierMaxxooorModuleB", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]);
      await expectDeployed(strategyModuleB.address);
      l1DataFeeAnalyzer.register("deploy MultiplierMaxxooorModuleB", strategyModuleB.deployTransaction);
    })
    it("can deploy BalanceFetcher", async function () {
      balanceFetcher = await deployContract(deployer, "BalanceFetcher", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, agentRegistry.address]) as BalanceFetcher;
      await expectDeployed(balanceFetcher.address);
      l1DataFeeAnalyzer.register("deploy BalanceFetcher", balanceFetcher.deployTransaction);
    });
    it("can deploy MockERC1271", async function () {
      mockERC1271 = await deployContract(deployer, "MockERC1271", []) as MockERC1271;
      await expectDeployed(mockERC1271.address);
      l1DataFeeAnalyzer.register("deploy MockERC1271", mockERC1271.deployTransaction);
    });
    it("can deploy Test1Callee", async function () {
      test1Callee = await deployContract(deployer, "Test1Callee", []) as Test1Callee;
      await expectDeployed(test1Callee.address);
      l1DataFeeAnalyzer.register("deploy Test1Callee", test1Callee.deployTransaction);
    });
    it("can deploy RevertAccount", async function () {
      revertAccount = await deployContract(deployer, "RevertAccount", []) as RevertAccount;
      await expectDeployed(revertAccount.address);
      l1DataFeeAnalyzer.register("deploy RevertAccount", revertAccount.deployTransaction);
    });
  });

  describe("genesis agent creation", function () {
    it("owner can whitelist", async function () {
      let whitelist = [
        {
          factory: genesisFactory.address,
          shouldWhitelist: true
        }
      ];
      let tx = await genesisAgentNft.connect(owner).setWhitelist(whitelist);
      for(let i = 0; i < whitelist.length; i++) {
        let whitelistItem = whitelist[i]
        await expect(tx).to.emit(genesisAgentNft, "FactoryWhitelisted").withArgs(whitelistItem.factory, whitelistItem.shouldWhitelist);
        expect(await genesisAgentNft.factoryIsWhitelisted(whitelistItem.factory)).eq(whitelistItem.shouldWhitelist);
      }
      l1DataFeeAnalyzer.register("whitelist factories[1]", tx);
    });
    it("owner can postAgentCreationSettings", async function () {
      let params = {
        agentImplementation: genesisAccountImplementation.address,
        initializationCalls: [],
        isActive: true,
        paymentToken: AddressZero,
        paymentAmount: WeiPerEther.mul(1).div(100),
        paymentReceiver: owner.address,
        timestampAllowlistMintStart: 0,
        timestampAllowlistMintEnd: 1,
        timestampPublicMintStart: 0,
      }
      let tx = await genesisFactory.connect(owner).postAgentCreationSettings(params)
      let res = await genesisFactory.getAgentCreationSettings()
      expect(res.agentImplementation).eq(params.agentImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isActive).eq(params.isActive)
      await expect(tx).to.emit(genesisFactory, "AgentCreationSettingsPosted")
      l1DataFeeAnalyzer.register("postAgentCreationSettings", tx);
    })
    it("can create genesis agent pt 1", async function () {
      let ts = await genesisAgentNft.totalSupply();
      let bal = await genesisAgentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let agentRes = await genesisFactory.connect(user1).callStatic.blastooorPublicMint(1, {value:WeiPerEther.div(100)});
      expect(agentRes[0].agentID).eq(agentID);
      expect(await genesisAgentNft.exists(agentID)).eq(false);
      //await expect(genesisAgentNft.getAgentID(agentRes[0].agentAddress)).to.be.revertedWithCustomError(genesisAgentNft, "AgentDoesNotExist");
      expect(await genesisAgentNft.getAgentID(agentRes[0].agentAddress)).eq(0);
      expect(await genesisAgentNft.isAddressAgent(agentRes[0].agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes[0].agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await genesisFactory.connect(user1).blastooorPublicMint(1, {value:WeiPerEther.div(100)});
      await expect(tx).to.emit(genesisAgentNft, "Transfer").withArgs(AddressZero, genesisFactory.address, agentRes[0].agentID);
      await expect(tx).to.emit(genesisAgentNft, "Transfer").withArgs(genesisFactory.address, user1.address, agentRes[0].agentID);
      expect(await genesisAgentNft.totalSupply()).eq(ts.add(1));
      expect(await genesisAgentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await genesisAgentNft.exists(agentID)).eq(true);
      expect(await genesisAgentNft.ownerOf(agentRes[0].agentID)).eq(user1.address);
      let agentInfo = await genesisAgentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes[0].agentAddress); // may change
      expect(await genesisAgentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await genesisAgentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(genesisAccountImplementation.address);
      //tbaccountG1A = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createGenesisAgent[1]", tx);
    });
    it("can create genesis agent pt 2", async function () {
      let ts = await genesisAgentNft.totalSupply();
      let bal = await genesisAgentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let agentRes = await genesisFactory.connect(user1).callStatic.blastooorPublicMint(1, {value:WeiPerEther.div(100)});
      expect(agentRes[0].agentID).eq(agentID);
      expect(await genesisAgentNft.exists(agentID)).eq(false);
      //await expect(genesisAgentNft.getAgentID(agentRes[0].agentAddress)).to.be.revertedWithCustomError(genesisAgentNft, "AgentDoesNotExist");
      expect(await genesisAgentNft.getAgentID(agentRes[0].agentAddress)).eq(0);
      expect(await genesisAgentNft.isAddressAgent(agentRes[0].agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes[0].agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await genesisFactory.connect(user1).blastooorPublicMint(1, {value:WeiPerEther.div(100)});
      await expect(tx).to.emit(genesisAgentNft, "Transfer").withArgs(AddressZero, genesisFactory.address, agentRes[0].agentID);
      await expect(tx).to.emit(genesisAgentNft, "Transfer").withArgs(genesisFactory.address, user1.address, agentRes[0].agentID);
      expect(await genesisAgentNft.totalSupply()).eq(ts.add(1));
      expect(await genesisAgentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await genesisAgentNft.exists(agentID)).eq(true);
      expect(await genesisAgentNft.ownerOf(agentRes[0].agentID)).eq(user1.address);
      let agentInfo = await genesisAgentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes[0].agentAddress); // may change
      expect(await genesisAgentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await genesisAgentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(genesisAccountImplementation.address);
      //tbaccountG2A = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createGenesisAgent[2]", tx);
    });
    it("can fetch balances 0", async function () {
      let res = await balanceFetcher.callStatic.fetchAgents(AddressZero, collectionListAll, tokenList)
      //console.log(`Balances 0: (${res.length})`)
      //console.log(res)
    })
    it("can fetch balances 1", async function () {
      let res = await balanceFetcher.callStatic.fetchAgents(user1.address, collectionListGenesis, tokenList)
      //console.log(`Balances 1: (${res.length})`)
      //console.log(res)
    })
  });

  describe("new genesis accounts", function () {
    it("registry setup", async function () {
      let params1 = [
        {
          account: genesisAccountFactory.address,
          isAuthorized: true,
        },
        {
          account: user2.address,
          isAuthorized: false,
        },
      ]
      let tx = await agentRegistry.connect(owner).setOperators(params1)
      for(let i = 0; i < params1.length; i++) {
        let { account, isAuthorized } = params1[i]
        await expect(tx).to.emit(agentRegistry, "OperatorSet").withArgs(account, isAuthorized);
        expect(await agentRegistry.isOperator(account)).eq(isAuthorized);
      }
    });
    it("owner can postAgentCreationSettings", async function () {
      expect(await genesisAccountFactory.getAgentCreationSettingsCount()).eq(0)
      let params = {
        agentImplementation: genesisAccountImplementation.address,
        initializationCalls: [],
        isActive: true,
      }
      let settingsID = 1
      let tx = await genesisAccountFactory.connect(owner).postAgentCreationSettings(params)
      let res = await genesisAccountFactory.getAgentCreationSettings(settingsID)
      expect(res.agentImplementation).eq(params.agentImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isActive).eq(params.isActive)
      await expect(tx).to.emit(genesisAccountFactory, "AgentCreationSettingsPosted").withArgs(settingsID)
      await expect(tx).to.emit(genesisAccountFactory, "AgentCreationSettingsActivated").withArgs(settingsID, params.isActive)
        expect(await genesisAccountFactory.getAgentCreationSettingsCount()).eq(1)
    })
    it("owner can set max mint per user", async function () {
      expect(await genesisAccountFactory.maxCreationsPerAgent()).eq(0)
      let count = 999
      let tx = await genesisAccountFactory.connect(owner).setMaxCreationsPerAgent(count)
      await expect(tx).to.emit(genesisAccountFactory, "SetMaxCreationsPerAgent").withArgs(count)
      expect(await genesisAccountFactory.maxCreationsPerAgent()).eq(count)
    })
    it("owner can postAgentCreationSettings pt 2", async function () {
      let params = {
        agentImplementation: genesisAccountImplementation.address,
        initializationCalls: [
          genesisAccountImplementation.interface.encodeFunctionData("blastConfigure")
        ],
        isActive: true,
      }
      let settingsID = 2
      let tx = await genesisAccountFactory.connect(owner).postAgentCreationSettings(params)
      let res = await genesisAccountFactory.getAgentCreationSettings(settingsID)
      expect(res.agentImplementation).eq(params.agentImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isActive).eq(params.isActive)
      await expect(tx).to.emit(genesisAccountFactory, "AgentCreationSettingsPosted").withArgs(settingsID)
      await expect(tx).to.emit(genesisAccountFactory, "AgentCreationSettingsActivated").withArgs(settingsID, params.isActive)
      expect(await genesisAccountFactory.getAgentCreationSettingsCount()).eq(settingsID)
    })
  });

  describe("strategy agent creation advanced", function () {
    it("owner can whitelist factories", async function () {
      let whitelist = [
        {
          factory: user1.address,
          shouldWhitelist: true
        },
        {
          factory: user2.address,
          shouldWhitelist: false
        },
        {
          factory: strategyFactory.address,
          shouldWhitelist: true
        },
      ];
      let tx = await strategyAgentNft.connect(owner).setWhitelist(whitelist);
      for(let i = 0; i < whitelist.length; i++) {
        let whitelistItem = whitelist[i]
        await expect(tx).to.emit(strategyAgentNft, "FactoryWhitelisted").withArgs(whitelistItem.factory, whitelistItem.shouldWhitelist);
        expect(await strategyAgentNft.factoryIsWhitelisted(whitelistItem.factory)).eq(whitelistItem.shouldWhitelist);
      }
    });
    it("owner can postAgentCreationSettings", async function () {
      let params = {
        agentImplementation: strategyAccountImplementation.address,
        initializationCalls: [],
        isActive: true,
      }
      let settingsID = 1
      let tx = await strategyFactory.connect(owner).postAgentCreationSettings(params)
      let res = await strategyFactory.getAgentCreationSettings(settingsID)
      expect(res.agentImplementation).eq(params.agentImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isActive).eq(params.isActive)
      await expect(tx).to.emit(strategyFactory, "AgentCreationSettingsPosted").withArgs(settingsID)
      await expect(tx).to.emit(strategyFactory, "AgentCreationSettingsActivated").withArgs(settingsID, params.isActive)
        expect(await strategyFactory.getAgentCreationSettingsCount()).eq(1)
    })
    it("owner can postAgentCreationSettings 2", async function () {
      let params = {
        agentImplementation: strategyAccountImplementation.address,
        initializationCalls: [
          strategyAccountImplementation.interface.encodeFunctionData("blastConfigure")
        ],
        isActive: true,
      }
      let settingsID = 2
      let tx = await strategyFactory.connect(owner).postAgentCreationSettings(params)
      let res = await strategyFactory.getAgentCreationSettings(settingsID)
      expect(res.agentImplementation).eq(params.agentImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isActive).eq(params.isActive)
      await expect(tx).to.emit(strategyFactory, "AgentCreationSettingsPosted").withArgs(settingsID)
      await expect(tx).to.emit(strategyFactory, "AgentCreationSettingsActivated").withArgs(settingsID, params.isActive)
      expect(await strategyFactory.getAgentCreationSettingsCount()).eq(settingsID)
    })
    it("owner can set max mint per user", async function () {
      let count = 999
      let tx = await strategyFactory.connect(owner).setMaxCreationsPerGenesisAgent(count)
      await expect(tx).to.emit(strategyFactory, "SetMaxCreationsPerGenesisAgent").withArgs(count)
      expect(await strategyFactory.maxCreationsPerGenesisAgent()).eq(count)
    })
    it("registry setup", async function () {
      let params1 = [
        {
          account: strategyFactory.address,
          isAuthorized: true,
        },
        {
          account: user2.address,
          isAuthorized: false,
        },
      ]
      let tx = await agentRegistry.connect(owner).setOperators(params1)
      for(let i = 0; i < params1.length; i++) {
        let { account, isAuthorized } = params1[i]
        await expect(tx).to.emit(agentRegistry, "OperatorSet").withArgs(account, isAuthorized);
        expect(await agentRegistry.isOperator(account)).eq(isAuthorized);
      }
    });
    it("can create a genesis account and strategy agent pt 1", async function () {
      // vanilla strategy, no deposits
      let genesisAgentID = 1
      let strategyAgentID = 1

      let genesisConfigID = 2
      let strategyConfigID = 2

      expect(await genesisAgentNft.totalSupply()).eq(2);
      expect(await genesisAgentNft.balanceOf(user1.address)).eq(2);
      expect(await genesisAgentNft.exists(genesisAgentID)).eq(true);
      expect(await strategyAgentNft.totalSupply()).eq(0);
      expect(await strategyAgentNft.balanceOf(user1.address)).eq(0);
      expect(await strategyAgentNft.exists(strategyAgentID)).eq(false);

      let creationIndex = 1
      let genesisAgentAddress = await erc6551Registry.account(genesisAccountImplementation.address, toBytes32(creationIndex), chainID, genesisAgentNft.address, genesisAgentID)
      var strategyFactoryCalldata = strategyFactory.interface.encodeFunctionData("createAgent(uint256)", [strategyConfigID])
      var genesisAgentCalldata = genesisAccountImplementation.interface.encodeFunctionData("execute", [strategyFactory.address, 0, strategyFactoryCalldata, 0])

      let calls = [
        {
          target: genesisAccountFactory.address,
          callData: genesisAccountFactory.interface.encodeFunctionData('createAccount(uint256,uint256)', [genesisAgentID, genesisConfigID]),
        },
        {
          target: genesisAgentAddress,
          callData: genesisAgentCalldata,
        },
      ]
      let tx = await multicallForwarder.connect(user1).aggregate(calls)
      let receipt = await tx.wait()
      //console.log(`gasUsed: ${receipt.gasUsed.toNumber().toLocaleString()}`)

      let tbaList0 = await agentRegistry.getTbasOfNft(genesisAgentNft.address, genesisAgentID)
      expect(tbaList0.length).eq(1)
      let genesisAddress = tbaList0[0].agentAddress
      let tbaList1 = await agentRegistry.getTbasOfNft(strategyAgentNft.address, strategyAgentID)
      expect(tbaList1.length).eq(1)
      let strategyAddress = tbaList1[0].agentAddress

      await expect(tx).to.not.emit(genesisAgentNft, "Transfer")
      await expect(tx).to.emit(strategyAgentNft, "Transfer").withArgs(AddressZero, strategyFactory.address, strategyAgentID);
      await expect(tx).to.emit(strategyAgentNft, "Transfer").withArgs(strategyFactory.address, genesisAddress, strategyAgentID);
      await expect(tx).to.emit(agentRegistry, "AgentRegistered").withArgs(strategyAddress, strategyAgentNft.address, strategyAgentID)

      expect(await genesisAgentNft.totalSupply()).eq(2);
      expect(await genesisAgentNft.balanceOf(user1.address)).eq(2);
      expect(await genesisAgentNft.exists(genesisAgentID)).eq(true);
      expect(await strategyAgentNft.totalSupply()).eq(1);
      expect(await strategyAgentNft.balanceOf(user1.address)).eq(0);
      expect(await strategyAgentNft.balanceOf(genesisAddress)).eq(1);
      expect(await strategyAgentNft.ownerOf(strategyAgentID)).eq(genesisAddress);
      expect(await strategyAgentNft.exists(strategyAgentID)).eq(true);

      tbaccountG1A = await ethers.getContractAt("BlastooorGenesisAgentAccount", genesisAddress) as BlastooorGenesisAgentAccount;
      tbaccountS1 = await ethers.getContractAt("BlastooorStrategyAgentAccount", strategyAddress) as BlastooorStrategyAgentAccount;
      l1DataFeeAnalyzer.register("createGenesisAndStrategyAgent[1]", tx);

    });
  })

  describe("strategy agent usage pt 1", function () {
    let accountProxyA: any
    let accountProxyB: any

    let functionParamsB = [
      { selector: "0x93f0899a", isProtected: false }, // moduleName()
      { selector: "0x82ccd330", isProtected: false }, // strategyType()
    ]
    let functionParamsA = [
      { selector: "0xd36bfc2e", isProtected: true }, // moduleA_withdrawBalance()
      { selector: "0xc4fb5289", isProtected: true }, // moduleA_withdrawBalanceTo(address)
    ]
    let overrides:any = []

    let initSighash = "0x95b6ef0c"
    it("calcSighashes", async function () {
      overrides = [
        {
          implementation: strategyModuleB.address,
          functionParams: functionParamsB
        },
        {
          implementation: strategyModuleA.address,
          functionParams: functionParamsA
        },
      ]

      accountProxyA = await ethers.getContractAt("DexBalancerModuleA", tbaccountS1.address)
      accountProxyB = await ethers.getContractAt("MultiplierMaxxooorModuleB", tbaccountS1.address)
      //let sighashes1 = calcSighashes(strategyFactory, 'StrategyFactory', false)
      //let sighashes2 = calcSighashes(genesisAccountImplementation, 'GenesisAccountImplementation', false)
      //let sighashes3 = calcSighashes(strategyAccountImplementation, 'StrategyAccountImplementation', false)
      //let sighashes4 = calcSighashes(strategyModuleB, 'MultiplierMaxxooorModuleB', false)
    });
    it("non owner cannot set overrides", async function () {
      await expect(tbaccountS1.connect(user1).setOverrides([])).to.be.revertedWithCustomError(strategyFactory, "NotAuthorized")
      await expect(tbaccountS1.connect(user2).setOverrides([])).to.be.revertedWithCustomError(strategyFactory, "NotAuthorized")
    });
    it("owner can set overrides", async function () {
      for(const param of functionParamsA) {
        let { selector, isProtected } = param
        let res = await tbaccountS1.overrides(selector)
        expect(res.implementation).eq(AddressZero)
        expect(res.isProtected).eq(false)
      }
      for(const param of functionParamsB) {
        let { selector, isProtected } = param
        let res = await tbaccountS1.overrides(selector)
        expect(res.implementation).eq(AddressZero)
        expect(res.isProtected).eq(false)
      }
      let calldata = tbaccountS1.interface.encodeFunctionData("setOverrides", [overrides])
      let tx = await tbaccountG1A.connect(user1).execute(tbaccountS1.address, 0, calldata, 0)
      let receipt = await tx.wait()
      //console.log(`gasUsed: ${receipt.gasUsed.toNumber().toLocaleString()}`)
      for(const param of functionParamsA) {
        let { selector, isProtected } = param
        let res = await tbaccountS1.overrides(selector)
        expect(res.implementation).eq(strategyModuleA.address)
        expect(res.isProtected).eq(isProtected)
        await expect(tx).to.emit(tbaccountS1, "OverrideUpdated").withArgs(selector, strategyModuleA.address, isProtected)
      }
      for(const param of functionParamsB) {
        let { selector, isProtected } = param
        let res = await tbaccountS1.overrides(selector)
        expect(res.implementation).eq(strategyModuleB.address)
        expect(res.isProtected).eq(isProtected)
        await expect(tx).to.emit(tbaccountS1, "OverrideUpdated").withArgs(selector, strategyModuleB.address, isProtected)
      }
    });
    it("non owner cannot use protected overrides", async function () {
      await expect(accountProxyA.connect(user1).moduleA_withdrawBalance()).to.be.revertedWithCustomError(tbaccountS1, "NotAuthorized")
      await expect(accountProxyA.connect(user2).moduleA_withdrawBalance()).to.be.revertedWithCustomError(tbaccountS1, "NotAuthorized")
      await expect(accountProxyA.connect(user1).moduleA_withdrawBalanceTo(user1.address)).to.be.revertedWithCustomError(tbaccountS1, "NotAuthorized")
      await expect(accountProxyA.connect(user2).moduleA_withdrawBalanceTo(user1.address)).to.be.revertedWithCustomError(tbaccountS1, "NotAuthorized")
    })
    it("owner can use protected overrides", async function () {
      var calldata = accountProxyA.interface.encodeFunctionData("moduleA_withdrawBalance")
      var tx = await tbaccountG1A.connect(user1).execute(accountProxyA.address, 0, calldata, 0)
      var calldata = accountProxyA.interface.encodeFunctionData("moduleA_withdrawBalanceTo", [user1.address])
      var tx = await tbaccountG1A.connect(user1).execute(accountProxyA.address, 0, calldata, 0)
    })
    it("role begins unset", async function () {
      expect(await tbaccountS1.hasRole(STRATEGY_MANAGER_ROLE, strategyManager.address)).eq(false)
    })
    it("non owner cannot give role", async function () {
      await expect(tbaccountS1.connect(user1).setRoles([])).to.be.revertedWithCustomError(strategyFactory, "NotAuthorized")
    })
    it("owner can give role", async function () {
      let params = [
        {
          role: STRATEGY_MANAGER_ROLE,
          account: strategyManager.address,
          grantAccess: true,
        },
        {
          role: STRATEGY_MANAGER_ROLE,
          account: dispatcher.address,
          grantAccess: true,
        },
        {
          role: STRATEGY_MANAGER_ROLE,
          account: user3.address,
          grantAccess: false,
        },
      ]
      let calldata = tbaccountS1.interface.encodeFunctionData("setRoles", [params])
      let tx = await tbaccountG1A.connect(user1).execute(tbaccountS1.address, 0, calldata, 0)
      for(const param of params) {
        const { role, account, grantAccess } = param
        expect(await tbaccountS1.hasRole(role, account)).eq(grantAccess)
        await expect(tx).to.emit(tbaccountS1, "RoleAccessChanged").withArgs(role, account, grantAccess)
      }
    })
    it("strategy manager can use protected overrides", async function () {
      var tx = await accountProxyA.connect(strategyManager).moduleA_withdrawBalance();
      var tx = await accountProxyA.connect(strategyManager).moduleA_withdrawBalanceTo(user1.address);
    })
    it("anyone can call unprotected overrides", async function () {
      expect(await accountProxyB.moduleName()).eq('MultiplierMaxxooorModuleB')
      expect(await accountProxyB.strategyType()).eq('Multiplier Maxxooor')
    })
    it("can call sighash with no registered overrides", async function () {
      await expect(user2.sendTransaction({ to: tbaccountS1.address, data: "0x12345678" })).to.not.be.reverted
      await expect(user2.sendTransaction({ to: tbaccountS1.address, data: "0x87654321" })).to.not.be.reverted
    })
  })

  describe("strategy agent creation advanced", function () {
    it("owner can postAgentCreationSettings 3", async function () {
      let roles = [
        {
          role: STRATEGY_MANAGER_ROLE,
          account: dispatcher.address,
          grantAccess: true,
        }
      ]
      let functionParamsB = [
        { selector: "0x82ccd330", isProtected: false }, // strategyType()
      ]
      let functionParamsA = [
        { selector: "0xd36bfc2e", isProtected: true }, // moduleA_withdrawBalance()
        { selector: "0xc4fb5289", isProtected: true }, // moduleA_withdrawBalanceTo(address)
      ]
      let overrides = [
        {
          implementation: strategyModuleB.address,
          functionParams: functionParamsB
        },
        {
          implementation: strategyModuleA.address,
          functionParams: functionParamsA
        },
      ]
      let params = {
        agentImplementation: strategyAccountImplementation.address,
        initializationCalls: [
          strategyAccountImplementation.interface.encodeFunctionData("blastConfigure"),
          strategyAccountImplementation.interface.encodeFunctionData("setRoles", [roles]),
          strategyAccountImplementation.interface.encodeFunctionData("setOverrides", [overrides]),
        ],
        isActive: true,
      }

      let settingsID = 3
      let tx = await strategyFactory.connect(owner).postAgentCreationSettings(params)
      let res = await strategyFactory.getAgentCreationSettings(settingsID)
      expect(res.agentImplementation).eq(params.agentImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isActive).eq(params.isActive)
      await expect(tx).to.emit(strategyFactory, "AgentCreationSettingsPosted").withArgs(settingsID)
      await expect(tx).to.emit(strategyFactory, "AgentCreationSettingsActivated").withArgs(settingsID, params.isActive)
      expect(await strategyFactory.getAgentCreationSettingsCount()).eq(settingsID)
    })
    it("can create a genesis account and strategy agent pt 2", async function () {
      // dex balancer module A & deposit
      let genesisAgentID = 2
      let strategyAgentID = 2

      let genesisConfigID = 2
      let strategyConfigID = 3

      expect(await genesisAgentNft.totalSupply()).eq(2);
      expect(await genesisAgentNft.balanceOf(user1.address)).eq(2);
      expect(await genesisAgentNft.exists(genesisAgentID)).eq(true);
      expect(await strategyAgentNft.totalSupply()).eq(1);
      expect(await strategyAgentNft.balanceOf(user1.address)).eq(0);
      expect(await strategyAgentNft.exists(strategyAgentID)).eq(false);

      let depositAmountETH = WeiPerEther.mul(3).div(1000)
      let tokenDeposits = [
        {
          token: AddressZero,
          amount: depositAmountETH,
        },
      ]

      let creationIndex = 1
      let genesisAgentAddress = await erc6551Registry.account(genesisAccountImplementation.address, toBytes32(creationIndex), chainID, genesisAgentNft.address, genesisAgentID)
      var strategyFactoryCalldata = strategyFactory.interface.encodeFunctionData("createAgent(uint256,(address,uint256)[])", [strategyConfigID, tokenDeposits])
      let genesisCallBatch = []
      genesisCallBatch.push({
        to: strategyFactory.address,
        value: depositAmountETH,
        data: strategyFactoryCalldata,
        operation: 0
      })
      var genesisAgentCalldata = genesisAccountImplementation.interface.encodeFunctionData("executeBatch", [genesisCallBatch])

      let calls = [
        {
          target: genesisAccountFactory.address,
          callData: genesisAccountFactory.interface.encodeFunctionData('createAccount(uint256,uint256)', [genesisAgentID, genesisConfigID]),
          allowFailure: false,
          value: 0,
        },
        {
          target: genesisAgentAddress,
          callData: genesisAgentCalldata,
          allowFailure: false,
          value: depositAmountETH,
        },
      ]

      let tx = await multicallForwarder.connect(user1).aggregate3Value(calls, {value: depositAmountETH})

      let receipt = await tx.wait()
      //console.log(`gasUsed: ${receipt.gasUsed.toNumber().toLocaleString()}`)

      let tbaList0 = await agentRegistry.getTbasOfNft(genesisAgentNft.address, genesisAgentID)
      expect(tbaList0.length).eq(1)
      let genesisAddress = tbaList0[0].agentAddress
      let tbaList1 = await agentRegistry.getTbasOfNft(strategyAgentNft.address, strategyAgentID)
      expect(tbaList1.length).eq(1)
      let strategyAddress = tbaList1[0].agentAddress

      await expect(tx).to.not.emit(genesisAgentNft, "Transfer")
      await expect(tx).to.emit(strategyAgentNft, "Transfer").withArgs(AddressZero, strategyFactory.address, strategyAgentID);
      await expect(tx).to.emit(strategyAgentNft, "Transfer").withArgs(strategyFactory.address, genesisAddress, strategyAgentID);
      await expect(tx).to.emit(agentRegistry, "AgentRegistered").withArgs(strategyAddress, strategyAgentNft.address, strategyAgentID)

      expect(await genesisAgentNft.totalSupply()).eq(2);
      expect(await genesisAgentNft.balanceOf(user1.address)).eq(2);
      expect(await genesisAgentNft.exists(genesisAgentID)).eq(true);
      expect(await strategyAgentNft.totalSupply()).eq(2);
      expect(await strategyAgentNft.balanceOf(user1.address)).eq(0);
      expect(await strategyAgentNft.balanceOf(genesisAddress)).eq(1);
      expect(await strategyAgentNft.ownerOf(strategyAgentID)).eq(genesisAddress);
      expect(await strategyAgentNft.exists(strategyAgentID)).eq(true);

      tbaccountG2A = await ethers.getContractAt("BlastooorGenesisAgentAccount", genesisAddress) as BlastooorGenesisAgentAccount;
      tbaccountS2 = await ethers.getContractAt("BlastooorStrategyAgentAccount", strategyAddress) as BlastooorStrategyAgentAccount;
      l1DataFeeAnalyzer.register("createGenesisAndStrategyAgent[1]", tx);

      let balances3 = await getBalances(tbaccountS2.address)
      expect(balances3.eth).eq(depositAmountETH)
      expect(balances3.weth).eq(0)
      expect(balances3.usdb).eq(0)
    });
  })

  describe("dispatcher", function () {
    it("cannot call if not operator", async function () {
      let calls = []
      let target = tbaccountS1.address
      await expect(dispatcher.connect(user2).aggregate(calls)).to.be.revertedWithCustomError(dispatcher, "NotOperator")
      await expect(dispatcher.connect(user2).tryAggregate(false, calls)).to.be.revertedWithCustomError(dispatcher, "NotOperator")
      await expect(dispatcher.connect(user2).tryBlockAndAggregate(false, calls)).to.be.revertedWithCustomError(dispatcher, "NotOperator")
      await expect(dispatcher.connect(user2).blockAndAggregate(calls)).to.be.revertedWithCustomError(dispatcher, "NotOperator")
      await expect(dispatcher.connect(user2).aggregate3(calls)).to.be.revertedWithCustomError(dispatcher, "NotOperator")
      await expect(dispatcher.connect(user2).aggregate3Value(calls)).to.be.revertedWithCustomError(dispatcher, "NotOperator")
      await expect(dispatcher.connect(user2).aggregateAndStore(calls)).to.be.revertedWithCustomError(dispatcher, "NotOperator")
      await expect(dispatcher.connect(user2).aggregate3AndStore(calls)).to.be.revertedWithCustomError(dispatcher, "NotOperator")
      await expect(dispatcher.connect(user2).aggregate3ValueAndStore(calls)).to.be.revertedWithCustomError(dispatcher, "NotOperator")
      await expect(dispatcher.connect(user2).aggregateFromStorage1(target, 0)).to.be.revertedWithCustomError(dispatcher, "NotOperator")
      await expect(dispatcher.connect(user2).aggregateFromStorage2(target, [])).to.be.revertedWithCustomError(dispatcher, "NotOperator")
      await expect(dispatcher.connect(user2).aggregateFromStorage3(target, calls)).to.be.revertedWithCustomError(dispatcher, "NotOperator")
      await expect(dispatcher.connect(user2).aggregateFromStorage4([], 0)).to.be.revertedWithCustomError(dispatcher, "NotOperator")
      await expect(dispatcher.connect(user2).aggregateFromStorage5([], [])).to.be.revertedWithCustomError(dispatcher, "NotOperator")
    });
    it("non owner cannot set operators", async function () {
      await expect(dispatcher.connect(user2).setOperators([])).to.be.revertedWithCustomError(dispatcher, "NotContractOwner")
    });
    it("owner can set operators", async function () {
      let operators = [
        {
          account: user2.address,
          isAuthorized: true,
        },
        {
          account: user3.address,
          isAuthorized: true,
        },
        {
          account: user4.address,
          isAuthorized: false,
        },
      ]
      let tx = await dispatcher.connect(owner).setOperators(operators)
      for(let operator of operators) {
        let { account, isAuthorized } = operator
        expect(await dispatcher.isOperator(account)).eq(isAuthorized)
        await expect(tx).to.emit(dispatcher, "OperatorSet").withArgs(account, isAuthorized)
      }
    });
    it("non strategy manager cannot executeByStrategyManager", async function () {
      let param1 = { to: user3.address, data: "0x" }
      let params1 = [param1]
      let param2 = { to: user3.address, data: "0x", value: 0 }
      let params2 = [param2]
      await expect(tbaccountS1.connect(user2).executeByStrategyManager(param1)).to.be.revertedWithCustomError(tbaccountS1, "NotAuthorized")
      await expect(tbaccountS1.connect(user2).executePayableByStrategyManager(param2)).to.be.revertedWithCustomError(tbaccountS1, "NotAuthorized")
      await expect(tbaccountS1.connect(user2).executeBatchByStrategyManager(params1)).to.be.revertedWithCustomError(tbaccountS1, "NotAuthorized")
      await expect(tbaccountS1.connect(user2).executePayableBatchByStrategyManager(params2)).to.be.revertedWithCustomError(tbaccountS1, "NotAuthorized")
    });
    it("strategy manager can executeByStrategyManager", async function () {
      let param1 = { to: test1Callee.address, data: test1Callee.interface.encodeFunctionData("testFunc1") }
      let params1 = [{ to: test1Callee.address, data: test1Callee.interface.encodeFunctionData("testFunc2") }]
      let param2 = { to: test1Callee.address, data: test1Callee.interface.encodeFunctionData("testFunc3"), value: 0 }
      let params2 = [{ to: test1Callee.address, data: test1Callee.interface.encodeFunctionData("testFunc3"), value: 0 }]

      var p = tbaccountS1.connect(strategyManager).executeByStrategyManager(param1)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var p = tbaccountS1.connect(strategyManager).executePayableByStrategyManager(param2)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(3)

      var p = tbaccountS1.connect(strategyManager).executeBatchByStrategyManager(params1)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(2)

      var p = tbaccountS1.connect(strategyManager).executePayableBatchByStrategyManager(params2)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(3)
    });
    it("dispatcher can executeByStrategyManager", async function () {
      expect(await dispatcher.storedCalldatasLength()).eq(0)
      await expect(dispatcher.storedCalldatas(0)).to.be.revertedWithCustomError(dispatcher, "OutOfRange")
      await expect(dispatcher.storedCalldatas(1)).to.be.revertedWithCustomError(dispatcher, "OutOfRange")

      var callData1 = test1Callee.interface.encodeFunctionData("testFunc1")
      var callData2 = tbaccountS1.interface.encodeFunctionData("executeByStrategyManager", [{ to: test1Callee.address, data: callData1 }])

      var calls = [{ target: tbaccountS1.address, callData: callData2 }]
      var target = tbaccountS1.address

      var p = dispatcher.connect(user2).aggregate(calls)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var p = dispatcher.connect(user2).tryAggregate(false, calls)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var p = dispatcher.connect(user2).tryBlockAndAggregate(false, calls)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var p = dispatcher.connect(user2).blockAndAggregate(calls)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var p = dispatcher.connect(user2).aggregateAndStore(calls)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)
      await expect(tx).to.emit(dispatcher, "CalldataStored").withArgs(1)
      expect(await dispatcher.storedCalldatasLength()).eq(1)
      expect(await dispatcher.storedCalldatas(1)).eq(calls[0].callData)

      var calls = [{ target: tbaccountS1.address, callData: callData2, allowFailure: false }]

      var p = dispatcher.connect(user2).aggregate3(calls)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var p = dispatcher.connect(user2).aggregate3AndStore(calls)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)
      await expect(tx).to.emit(dispatcher, "CalldataStored").withArgs(2)
      expect(await dispatcher.storedCalldatasLength()).eq(2)
      expect(await dispatcher.storedCalldatas(2)).eq(calls[0].callData)

      var calls = [{ target: tbaccountS1.address, callData: callData2, allowFailure: false, value: 0 }]

      var p = dispatcher.connect(user2).aggregate3Value(calls)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var p = dispatcher.connect(user2).aggregate3ValueAndStore(calls)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)
      await expect(tx).to.emit(dispatcher, "CalldataStored").withArgs(3)
      expect(await dispatcher.storedCalldatasLength()).eq(3)
      expect(await dispatcher.storedCalldatas(3)).eq(calls[0].callData)

      var p = dispatcher.connect(user2).aggregateFromStorage1(target, 1)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var p = dispatcher.connect(user2).aggregateFromStorage2(target, [1,2])
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var p = dispatcher.connect(user2).aggregateFromStorage3(target, [{allowFailure:false, calldataID: 1}])
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var p = dispatcher.connect(user2).aggregateFromStorage4([target,target], 1)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var p = dispatcher.connect(user2).aggregateFromStorage5([target,target], [1,2])
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)
    });
    it("will hard fail on call fail", async function () {
      var callData1 = "0x"
      var callData2 = tbaccountS1.interface.encodeFunctionData("executeByStrategyManager", [{ to: revertAccount.address, data: callData1 }])

      var calls = [{ target: revertAccount.address, callData: callData2 }]
      var target = revertAccount.address

      await expect(dispatcher.connect(user2).aggregate(calls)).to.be.revertedWithCustomError(dispatcher, "CallFailed")
      await expect(dispatcher.connect(user2).tryAggregate(true, calls)).to.be.revertedWithCustomError(dispatcher, "CallFailed")
      await expect(dispatcher.connect(user2).tryBlockAndAggregate(true, calls)).to.be.revertedWithCustomError(dispatcher, "CallFailed")
      await expect(dispatcher.connect(user2).blockAndAggregate(calls)).to.be.revertedWithCustomError(dispatcher, "CallFailed")
      await expect(dispatcher.connect(user2).aggregateAndStore(calls)).to.be.revertedWithCustomError(dispatcher, "CallFailed")

      var calls = [{ target: revertAccount.address, callData: callData2, allowFailure: false }]

      await expect(dispatcher.connect(user2).aggregate3(calls)).to.be.revertedWithCustomError(dispatcher, "CallFailed")
      await expect(dispatcher.connect(user2).aggregate3AndStore(calls)).to.be.revertedWithCustomError(dispatcher, "CallFailed")

      var calls = [{ target: revertAccount.address, callData: callData2, allowFailure: false, value: 0 }]

      await expect(dispatcher.connect(user2).aggregate3Value(calls)).to.be.revertedWithCustomError(dispatcher, "CallFailed")
      await expect(dispatcher.connect(user2).aggregate3ValueAndStore(calls)).to.be.revertedWithCustomError(dispatcher, "CallFailed")

      await expect(dispatcher.connect(user2).aggregateFromStorage1(target, 1)).to.be.revertedWithCustomError(dispatcher, "CallFailed")
      await expect(dispatcher.connect(user2).aggregateFromStorage2(target, [1])).to.be.revertedWithCustomError(dispatcher, "CallFailed")
      await expect(dispatcher.connect(user2).aggregateFromStorage3(target, [{allowFailure:false, calldataID: 1}])).to.be.revertedWithCustomError(dispatcher, "CallFailed")
      await expect(dispatcher.connect(user2).aggregateFromStorage4([target], 1)).to.be.revertedWithCustomError(dispatcher, "CallFailed")
      await expect(dispatcher.connect(user2).aggregateFromStorage5([target], [1])).to.be.revertedWithCustomError(dispatcher, "CallFailed")
    });
    it("can allow soft fails", async function () {
      var callData1 = "0x"
      var callData2 = tbaccountS1.interface.encodeFunctionData("executeByStrategyManager", [{ to: revertAccount.address, data: callData1 }])

      var calls = [{ target: revertAccount.address, callData: callData2 }]
      var target = revertAccount.address

      await expect(dispatcher.connect(user2).tryAggregate(false, calls)).to.not.be.reverted
      await expect(dispatcher.connect(user2).tryBlockAndAggregate(false, calls)).to.not.be.reverted

      var calls = [{ target: revertAccount.address, callData: callData2, allowFailure: true }]

      await expect(dispatcher.connect(user2).aggregate3(calls)).to.not.be.reverted
      await expect(dispatcher.connect(user2).aggregate3AndStore(calls)).to.not.be.reverted

      var calls = [{ target: revertAccount.address, callData: callData2, allowFailure: true, value: 0 }]

      await expect(dispatcher.connect(user2).aggregate3Value(calls)).to.not.be.reverted
      await expect(dispatcher.connect(user2).aggregate3ValueAndStore(calls)).to.not.be.reverted

      await expect(dispatcher.connect(user2).aggregateFromStorage3(target, [{allowFailure:true, calldataID: 1}])).to.not.be.reverted
    });
    it("checks call value", async function () {
      await expect(dispatcher.connect(user2).aggregate3Value([], {value:1})).to.be.revertedWithCustomError(dispatcher, "ValueMismatch")
      await expect(dispatcher.connect(user2).aggregate3ValueAndStore([], {value:1})).to.be.revertedWithCustomError(dispatcher, "ValueMismatch")
    });
  });

  describe("multicall forwarder", function () {
    it("multicall forwarder can aggregate", async function () {
      var callData1 = test1Callee.interface.encodeFunctionData("testFunc1")
      var callData2 = tbaccountG1A.interface.encodeFunctionData("execute", [test1Callee.address, 0, callData1, 0])

      var calls = [{ target: tbaccountG1A.address, callData: callData2 }]
      var target = tbaccountG1A.address

      var p = multicallForwarder.connect(user1).aggregate(calls)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var p = multicallForwarder.connect(user1).tryAggregate(false, calls)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var p = multicallForwarder.connect(user1).tryBlockAndAggregate(false, calls)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var p = multicallForwarder.connect(user1).blockAndAggregate(calls)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var calls = [{ target: tbaccountG1A.address, callData: callData2, allowFailure: false }]

      var p = multicallForwarder.connect(user1).aggregate3(calls)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var calls = [{ target: tbaccountG1A.address, callData: callData2, allowFailure: false, value: 0 }]

      var p = multicallForwarder.connect(user1).aggregate3Value(calls)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)
    });
    it("will hard fail on call fail", async function () {
      var callData1 = "0x"
      var callData2 = tbaccountG1A.interface.encodeFunctionData("execute", [revertAccount.address, 0, callData1, 0])

      var calls = [{ target: revertAccount.address, callData: callData2 }]
      var target = revertAccount.address

      await expect(multicallForwarder.connect(user1).aggregate(calls)).to.be.revertedWith("Multicall3: call failed")
      await expect(multicallForwarder.connect(user1).tryAggregate(true, calls)).to.be.revertedWith("Multicall3: call failed")
      await expect(multicallForwarder.connect(user1).tryBlockAndAggregate(true, calls)).to.be.revertedWith("Multicall3: call failed")
      await expect(multicallForwarder.connect(user1).blockAndAggregate(calls)).to.be.revertedWith("Multicall3: call failed")

      var calls = [{ target: revertAccount.address, callData: callData2, allowFailure: false }]

      await expect(multicallForwarder.connect(user1).aggregate3(calls)).to.be.revertedWith("Multicall3: call failed")

      var calls = [{ target: revertAccount.address, callData: callData2, allowFailure: false, value: 0 }]

      await expect(multicallForwarder.connect(user1).aggregate3Value(calls)).to.be.revertedWith("Multicall3: call failed")
    });
    it("can allow soft fails", async function () {
      var callData1 = "0x"
      var callData2 = tbaccountG1A.interface.encodeFunctionData("execute", [revertAccount.address, 0, callData1, 0])

      var calls = [{ target: revertAccount.address, callData: callData2 }]
      var target = revertAccount.address

      await expect(multicallForwarder.connect(user1).tryAggregate(false, calls)).to.not.be.reverted
      await expect(multicallForwarder.connect(user1).tryBlockAndAggregate(false, calls)).to.not.be.reverted

      var calls = [{ target: revertAccount.address, callData: callData2, allowFailure: true }]

      await expect(multicallForwarder.connect(user1).aggregate3(calls)).to.not.be.reverted

      var calls = [{ target: revertAccount.address, callData: callData2, allowFailure: true, value: 0 }]

      await expect(multicallForwarder.connect(user1).aggregate3Value(calls)).to.not.be.reverted
    });
    it("checks call value", async function () {
      await expect(multicallForwarder.connect(user1).aggregate3Value([], {value:1})).to.be.revertedWith("Multicall3: value mismatch")
    });
    it("reverts if forwarding call to tba with incorrect owner", async function () {
      var callData1 = test1Callee.interface.encodeFunctionData("testFunc1")
      var callData2 = tbaccountG1A.interface.encodeFunctionData("execute", [test1Callee.address, 0, callData1, 0])

      var calls = [{ target: tbaccountG1A.address, callData: callData2 }]
      var target = tbaccountG1A.address

      await expect(multicallForwarder.connect(user2).aggregate(calls)).to.be.revertedWith("Multicall3: call failed")
      await expect(multicallForwarder.connect(user2).tryAggregate(true, calls)).to.be.revertedWith("Multicall3: call failed")
      await expect(multicallForwarder.connect(user2).tryBlockAndAggregate(true, calls)).to.be.revertedWith("Multicall3: call failed")
      await expect(multicallForwarder.connect(user2).blockAndAggregate(calls)).to.be.revertedWith("Multicall3: call failed")

      var calls = [{ target: tbaccountG1A.address, callData: callData2, allowFailure: false }]

      await expect(multicallForwarder.connect(user2).aggregate3(calls)).to.be.revertedWith("Multicall3: call failed")

      var calls = [{ target: tbaccountG1A.address, callData: callData2, allowFailure: false, value: 0 }]

      await expect(multicallForwarder.connect(user2).aggregate3Value(calls)).to.be.revertedWith("Multicall3: call failed")
    });
    it("cannot directly call nested account", async function () {
      var callData1 = test1Callee.interface.encodeFunctionData("testFunc1")
      var callData2 = tbaccountS1.interface.encodeFunctionData("execute", [test1Callee.address, 0, callData1, 0])

      var calls = [{ target: tbaccountS1.address, callData: callData2 }]
      var target = tbaccountS1.address

      await expect(multicallForwarder.connect(user2).aggregate(calls)).to.be.revertedWith("Multicall3: call failed")
      await expect(multicallForwarder.connect(user2).tryAggregate(true, calls)).to.be.revertedWith("Multicall3: call failed")
      await expect(multicallForwarder.connect(user2).tryBlockAndAggregate(true, calls)).to.be.revertedWith("Multicall3: call failed")
      await expect(multicallForwarder.connect(user2).blockAndAggregate(calls)).to.be.revertedWith("Multicall3: call failed")

      var calls = [{ target: tbaccountS1.address, callData: callData2, allowFailure: false }]

      await expect(multicallForwarder.connect(user2).aggregate3(calls)).to.be.revertedWith("Multicall3: call failed")

      var calls = [{ target: tbaccountS1.address, callData: callData2, allowFailure: false, value: 0 }]

      await expect(multicallForwarder.connect(user2).aggregate3Value(calls)).to.be.revertedWith("Multicall3: call failed")
    });
    it("can call nested account via root", async function () {
      var callData1 = test1Callee.interface.encodeFunctionData("testFunc1")
      var callData2 = tbaccountS1.interface.encodeFunctionData("execute", [test1Callee.address, 0, callData1, 0])

      var calls = [{ target: tbaccountS1.address, callData: callData2 }]
      var target = tbaccountS1.address

      var callData3 = multicallForwarder.interface.encodeFunctionData("aggregate", [calls])
      var p = tbaccountG1A.connect(user1).execute(multicallForwarder.address, 0, callData3, 0)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var callData3 = multicallForwarder.interface.encodeFunctionData("tryAggregate", [false, calls])
      var p = tbaccountG1A.connect(user1).execute(multicallForwarder.address, 0, callData3, 0)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var callData3 = multicallForwarder.interface.encodeFunctionData("tryBlockAndAggregate", [false, calls])
      var p = tbaccountG1A.connect(user1).execute(multicallForwarder.address, 0, callData3, 0)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var callData3 = multicallForwarder.interface.encodeFunctionData("blockAndAggregate", [calls])
      var p = tbaccountG1A.connect(user1).execute(multicallForwarder.address, 0, callData3, 0)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var calls = [{ target: tbaccountS1.address, callData: callData2, allowFailure: false }]

      var callData3 = multicallForwarder.interface.encodeFunctionData("aggregate3", [calls])
      var p = tbaccountG1A.connect(user1).execute(multicallForwarder.address, 0, callData3, 0)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var calls = [{ target: tbaccountS1.address, callData: callData2, allowFailure: false, value: 0 }]

      var p = multicallForwarder.connect(user1).aggregate3Value(calls)
      var callData3 = multicallForwarder.interface.encodeFunctionData("aggregate3Value", [calls])
      var p = tbaccountG1A.connect(user1).execute(multicallForwarder.address, 0, callData3, 0)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)
    });
    it("can multicall nested account via root", async function () {
      var callData1 = test1Callee.interface.encodeFunctionData("testFunc1")
      var callData2 = tbaccountS1.interface.encodeFunctionData("execute", [test1Callee.address, 0, callData1, 0])
      callData2 = tbaccountS1.interface.encodeFunctionData("multicall", [[callData2]])

      var calls = [{ target: tbaccountS1.address, callData: callData2 }]
      var target = tbaccountS1.address

      var callData3 = multicallForwarder.interface.encodeFunctionData("aggregate", [calls])
      var p = tbaccountG1A.connect(user1).execute(multicallForwarder.address, 0, callData3, 0)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var callData3 = multicallForwarder.interface.encodeFunctionData("tryAggregate", [false, calls])
      var p = tbaccountG1A.connect(user1).execute(multicallForwarder.address, 0, callData3, 0)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var callData3 = multicallForwarder.interface.encodeFunctionData("tryBlockAndAggregate", [false, calls])
      var p = tbaccountG1A.connect(user1).execute(multicallForwarder.address, 0, callData3, 0)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var callData3 = multicallForwarder.interface.encodeFunctionData("blockAndAggregate", [calls])
      var p = tbaccountG1A.connect(user1).execute(multicallForwarder.address, 0, callData3, 0)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var calls = [{ target: tbaccountS1.address, callData: callData2, allowFailure: false }]

      var callData3 = multicallForwarder.interface.encodeFunctionData("aggregate3", [calls])
      var p = tbaccountG1A.connect(user1).execute(multicallForwarder.address, 0, callData3, 0)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)

      var calls = [{ target: tbaccountS1.address, callData: callData2, allowFailure: false, value: 0 }]

      var p = multicallForwarder.connect(user1).aggregate3Value(calls)
      var callData3 = multicallForwarder.interface.encodeFunctionData("aggregate3Value", [calls])
      var p = tbaccountG1A.connect(user1).execute(multicallForwarder.address, 0, callData3, 0)
      var tx = await p
      await expect(p).to.not.be.reverted
      await expect(tx).to.emit(test1Callee, "Test1Event").withArgs(1)
    });
    it("can do other multicall functions", async function () {
      // these are just called here, the values are not checked
      let block = await provider.getBlock("latest")
      let blockNumber = block.number
      await multicallForwarder.getBlockHash(blockNumber)
      await multicallForwarder.getBlockNumber()
      await multicallForwarder.getCurrentBlockCoinbase()
      await multicallForwarder.getCurrentBlockDifficulty()
      await multicallForwarder.getCurrentBlockGasLimit()
      await multicallForwarder.getCurrentBlockTimestamp()
      await multicallForwarder.getEthBalance(tbaccountG1A.address)
      await multicallForwarder.getLastBlockHash()
      await multicallForwarder.getBasefee()
      await multicallForwarder.getChainId()
    });
  });

  async function getBalances(account:string, log=false) {
    let res = {
      eth: await provider.getBalance(account),
      weth: await weth.balanceOf(account),
      usdb: await usdb.balanceOf(account),
    }
    if(log) {
      console.log({
        eth: formatUnits(res.eth),
        weth: formatUnits(res.weth),
        usdb: formatUnits(res.usdb),
      })
    }
    return res
  }


  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});
