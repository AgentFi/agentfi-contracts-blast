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

describe("AgentRegistry", function () {
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
  let multicallForwarder: MulticallForwarder;
  let agentRegistry: AgentRegistry;
  let genesisAccountFactory: BlastooorAccountFactory;
  let balanceFetcher: BalanceFetcher;

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
    await expectDeployed(THRUSTER_ROUTER_ADDRESS_030);
    await expectDeployed(THRUSTER_ROUTER_ADDRESS_100);
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
    it("can deploy AgentRegistry", async function () {
      agentRegistry = await deployContract(deployer, "AgentRegistry", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]) as AgentRegistry;
      await expectDeployed(agentRegistry.address);
      expect(await agentRegistry.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy AgentRegistry", agentRegistry.deployTransaction);
    });
  });

  describe("AgentRegistry setup", function () {
    it("begins with no agents", async function () {
      let agentID = 1
      let agentInfo = await agentRegistry.getTbasOfNft(user1.address, agentID)
      expect(agentInfo.length).eq(0)
      let nftInfo = await agentRegistry.getNftOfTba(user1.address)
      expect(nftInfo.collection).eq(AddressZero)
      expect(nftInfo.agentID).eq(0)
      expect(await agentRegistry.isTbaRegisteredAgent(user1.address)).eq(false)
    });
    it("begins with no operators", async function () {
      expect(await agentRegistry.isOperator(AddressZero)).eq(false);
      expect(await agentRegistry.isOperator(user1.address)).eq(false);
    });
    it("non owner cannot add operators", async function () {
      await expect(agentRegistry.connect(user1).setOperators([])).to.be.revertedWithCustomError(agentRegistry, "NotContractOwner")
    });
    it("owner can add operators", async function () {
      let params1 = [
        {
          account: user3.address,
          isAuthorized: true,
        },
        {
          account: user4.address,
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
    it("non operator cannot register agents", async function () {
      let param = {
        agentAddress: AddressZero,
        implementationAddress: AddressZero,
        collection: AddressZero,
        agentID: 1
      }
      let params = [param]
      await expect(agentRegistry.connect(user4).registerAgent(param)).to.be.revertedWithCustomError(agentRegistry, "NotOperator")
      await expect(agentRegistry.connect(user4).tryRegisterAgent(param)).to.be.revertedWithCustomError(agentRegistry, "NotOperator")
      await expect(agentRegistry.connect(user4).registerAgents(params)).to.be.revertedWithCustomError(agentRegistry, "NotOperator")
      await expect(agentRegistry.connect(user4).tryRegisterAgents(params)).to.be.revertedWithCustomError(agentRegistry, "NotOperator")
    });
    it("operator can register agents 1", async function () {
      let param = {
        agentAddress: user1.address,
        implementationAddress: user2.address,
        collection: user3.address,
        agentID: 1
      }
      let params = [param]
      let tx = await agentRegistry.connect(user3).registerAgent(param)
      let tbas = await agentRegistry.getTbasOfNft(user3.address, 1)
      expect(tbas.length).eq(1)
      expect(tbas[0].agentAddress).eq(user1.address)
      expect(tbas[0].implementationAddress).eq(user2.address)
      let nft = await agentRegistry.getNftOfTba(user1.address)
      expect(nft.collection).eq(user3.address)
      expect(nft.agentID).eq(1)
      expect(await agentRegistry.isTbaRegisteredAgent(user1.address)).eq(true)
      await expect(tx).to.emit(agentRegistry, "AgentRegistered").withArgs(user1.address, user3.address, 1)
    });
    it("operator can register agents 2", async function () {
      let param = {
        agentAddress: user2.address,
        implementationAddress: user1.address,
        collection: user3.address,
        agentID: 2
      }
      let params = [param]
      let tx = await agentRegistry.connect(user3).registerAgents(params)
      let tbas = await agentRegistry.getTbasOfNft(user3.address, 2)
      expect(tbas.length).eq(1)
      expect(tbas[0].agentAddress).eq(user2.address)
      expect(tbas[0].implementationAddress).eq(user1.address)
      let nft = await agentRegistry.getNftOfTba(user2.address)
      expect(nft.collection).eq(user3.address)
      expect(nft.agentID).eq(2)
      expect(await agentRegistry.isTbaRegisteredAgent(user2.address)).eq(true)
      await expect(tx).to.emit(agentRegistry, "AgentRegistered").withArgs(user2.address, user3.address, 2)
    });
    it("operator can register agents 3", async function () {
      let param = {
        agentAddress: user3.address,
        implementationAddress: user1.address,
        collection: user2.address,
        agentID: 3
      }
      let params = [param]
      let tx = await agentRegistry.connect(user3).tryRegisterAgent(param)
      let tbas = await agentRegistry.getTbasOfNft(user2.address, 3)
      expect(tbas.length).eq(1)
      expect(tbas[0].agentAddress).eq(user3.address)
      expect(tbas[0].implementationAddress).eq(user1.address)
      let nft = await agentRegistry.getNftOfTba(user3.address)
      expect(nft.collection).eq(user2.address)
      expect(nft.agentID).eq(3)
      expect(await agentRegistry.isTbaRegisteredAgent(user3.address)).eq(true)
      await expect(tx).to.emit(agentRegistry, "AgentRegistered").withArgs(user3.address, user2.address, 3)
    });
    it("operator can register agents 4", async function () {
      let param = {
        agentAddress: user4.address,
        implementationAddress: user1.address,
        collection: user2.address,
        agentID: 4
      }
      let params = [param]
      let tx = await agentRegistry.connect(user3).tryRegisterAgents(params)
      let tbas = await agentRegistry.getTbasOfNft(user2.address, 4)
      expect(tbas.length).eq(1)
      expect(tbas[0].agentAddress).eq(user4.address)
      expect(tbas[0].implementationAddress).eq(user1.address)
      let nft = await agentRegistry.getNftOfTba(user4.address)
      expect(nft.collection).eq(user2.address)
      expect(nft.agentID).eq(4)
      expect(await agentRegistry.isTbaRegisteredAgent(user4.address)).eq(true)
      await expect(tx).to.emit(agentRegistry, "AgentRegistered").withArgs(user4.address, user2.address, 4)
    });
    it("double register hard fails", async function () {
      let param = {
        agentAddress: user1.address,
        implementationAddress: user2.address,
        collection: user3.address,
        agentID: 1
      }
      let params = [param]
      await expect(agentRegistry.connect(user3).registerAgent(param)).to.be.revertedWithCustomError(agentRegistry, "AlreadyRegistered")
      await expect(agentRegistry.connect(user3).registerAgents(params)).to.be.revertedWithCustomError(agentRegistry, "AlreadyRegistered")
    });
    it("double try register fails gracefully", async function () {
      let param = {
        agentAddress: user1.address,
        implementationAddress: user2.address,
        collection: user3.address,
        agentID: 1
      }
      let params = [param]
      let tx1 = await agentRegistry.connect(user3).tryRegisterAgent(param)
      let tx2 = await agentRegistry.connect(user3).tryRegisterAgents(params)
      await expect(tx1).to.not.emit(agentRegistry, "AgentRegistered")
      await expect(tx2).to.not.emit(agentRegistry, "AgentRegistered")
    });
  });

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});
