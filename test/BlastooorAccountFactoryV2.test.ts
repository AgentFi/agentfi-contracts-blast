/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish, utils } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;

import { IERC6551Registry, BlastooorGenesisAgents, AgentFactory01, BlastooorGenesisFactory, MockERC20, MockERC721, RevertAccount, MockERC1271, GasCollector, BlastooorGenesisAgentAccount, AgentRegistry, BlastooorAccountFactory, BlastooorAccountFactoryV2, BalanceFetcher } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { toBytes32 } from "./../scripts/utils/setStorage";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { deployContract } from "../scripts/utils/deployContract";
import L1DataFeeAnalyzer from "../scripts/utils/L1DataFeeAnalyzer";
import { MulticallProvider, MulticallContract } from "./../scripts/utils/multicall";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../scripts/utils/diamond"
import { sign, assembleSignature, getMintFromAllowlistDigest, getMintFromAllowlistSignature } from "./../scripts/utils/signature";

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const { formatUnits } = ethers.utils;

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";
const BLAST_POINTS_ADDRESS            = "0x2536FE9ab3F511540F2f9e2eC2A805005C3Dd800";
const BLAST_POINTS_OPERATOR_ADDRESS   = "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";

const ENTRY_POINT_ADDRESS             = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const MULTICALL_FORWARDER_ADDRESS     = "0xAD55F8b65d5738C6f63b54E651A09cC5d873e4d8"; // v1.0.1
const CONTRACT_FACTORY_ADDRESS        = "0x9D735e7926729cAB93b10cb5814FF8487Fb6D5e8"; // v1.0.0

const GAS_COLLECTOR_ADDRESS           = "0xf237c20584DaCA970498917470864f4d027de4ca"; // v1.0.0
const BALANCE_FETCHER_ADDRESS         = "0x3f8Dc480BEAeF711ecE5110926Ea2780a1db85C5"; // v1.0.1

const GENESIS_COLLECTION_ADDRESS      = "0x5066A1975BE96B777ddDf57b496397efFdDcB4A9"; // v1.0.0
const GENESIS_FACTORY_ADDRESS         = "0x700b6f8B315247DD41C42A6Cfca1dAE6B4567f3B"; // v1.0.0
const GENESIS_ACCOUNT_IMPL_ADDRESS    = "0xb9b7FFBaBEC52DFC0589f7b331E4B8Cb78E06301"; // v1.0.1
const GENESIS_ACCOUNT_FACTORY_ADDRESS = "0x101E03D71e756Da260dC5cCd19B6CdEEcbB4397F"; // v1.0.1

const AGENT_REGISTRY_ADDRESS          = "0x12F0A3453F63516815fe41c89fAe84d218Af0FAF"; // v1.0.1

const STRATEGY_COLLECTION_ADDRESS     = "0x73E75E837e4F3884ED474988c304dE8A437aCbEf"; // v1.0.1
const STRATEGY_FACTORY_ADDRESS        = "0x09906C1eaC081AC4aF24D6F7e05f7566440b4601"; // v1.0.1
const STRATEGY_ACCOUNT_IMPL_ADDRESS   = "0x4b1e8C60E4a45FD64f5fBf6c497d17Ab12fba213"; // v1.0.1

const DISPATCHER_ADDRESS              = "0x59c0269f4120058bA195220ba02dd0330d92c36D"; // v1.0.1




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

describe("BlastooorStrategyAgents", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let strategyManager: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;
  let user6: SignerWithAddress;
  let user7: SignerWithAddress;

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
  let genesisAccountFactoryV2: BlastooorAccountFactoryV2;
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
    [deployer, owner, strategyManager, user1, user2, user3, user4, user5, user6, user7] = await ethers.getSigners();
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
    it("can deploy agent ERC721", async function () {
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
    it("can deploy BlastooorAccountFactoryV2", async function () {
      genesisAccountFactoryV2 = await deployContract(deployer, "BlastooorAccountFactoryV2", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, genesisAgentNft.address, agentRegistry.address, ERC6551_REGISTRY_ADDRESS]) as BlastooorAccountFactoryV2;
      await expectDeployed(genesisAccountFactoryV2.address);
      expect(await genesisAccountFactoryV2.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy BlastooorAccountFactoryV2", genesisAccountFactoryV2.deployTransaction);
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
      tbaccountG1A = await ethers.getContractAt("BlastooorGenesisAgentAccount", agentInfo.agentAddress) as BlastooorGenesisAgentAccount;
      l1DataFeeAnalyzer.register("createGenesisAgent[1]", tx);
    });
  })

  describe("postAgentCreationSettings", function () {
    it("starts with empty settings", async function () {
      let lastCheckedAgentID = await genesisAccountFactoryV2.lastCheckedAgentID()
      expect(lastCheckedAgentID).eq(0);
      let settings = await genesisAccountFactoryV2.getAgentCreationSettings()
      expect(settings.agentNft).eq(genesisAgentNft.address)
      expect(settings.agentImplementation).eq(AddressZero)
      expect(settings.initializationCalls.length).eq(0)
    })
    it("non owner cannot post settings", async function () {
      await expect(genesisAccountFactoryV2.connect(user1).postAgentCreationSettings({
        agentImplementation: genesisAccountImplementation.address,
        initializationCalls: [],
      })).to.be.revertedWithCustomError(genesisAccountFactoryV2, "NotContractOwner")
    })
    it("owner can post settings", async function () {
      let tx = await genesisAccountFactoryV2.connect(owner).postAgentCreationSettings({
        agentImplementation: genesisAccountImplementation.address,
        initializationCalls: [
          genesisAccountImplementation.interface.encodeFunctionData("blastConfigure()")
        ]
      })
      let settings = await genesisAccountFactoryV2.getAgentCreationSettings()
      expect(settings.agentNft).eq(genesisAgentNft.address)
      expect(settings.agentImplementation).eq(genesisAccountImplementation.address)
      expect(settings.initializationCalls.length).eq(1)
      await expect(tx).to.emit(genesisAccountFactoryV2, "AgentCreationSettingsPosted")
    })
    //it("", async function () {})
  });

  describe("createAccounts", function () {
    it("genesis agent does not start with an account", async function () {
      let tbas = await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1)
      expect(tbas.length).eq(0)
    });
    it("non owner cannot create accounts", async function () {
      await expect(genesisAccountFactoryV2.connect(user1).createAccounts()).to.be.revertedWithCustomError(genesisAccountFactoryV2, "NotContractOwner")
    })
    it("cannot create account if factory is not an operator on the agent registry", async function () {
      await expect(genesisAccountFactoryV2.connect(owner).createAccounts({gasLimit: 15_000_000})).to.be.reverted
    })
    it("can set operator", async function () {
      let params1 = [
        {
          account: genesisAccountFactoryV2.address,
          isAuthorized: true,
        },
      ]
      let tx = await agentRegistry.connect(owner).setOperators(params1)
      l1DataFeeAnalyzer.register("setOperators", tx);
    })
    it("owner create accounts", async function () {
      let txnum = 0
      let supply = await genesisAgentNft.totalSupply()
      while(true) {
        let lastCheckedAgentID0 = await genesisAccountFactoryV2.lastCheckedAgentID()
        if(lastCheckedAgentID0.gte(supply)) {
          //console.log(`\n\nLast agent checked: ${lastCheckedAgentID0.toNumber()}. Supply: ${supply.toNumber()}. breaking`)
          break
        }
        ++txnum
        //console.log(`\n\nLast agent checked: ${lastCheckedAgentID0.toNumber()}. Supply: ${supply.toNumber()}. sending tx ${txnum}`)
        let tx = await genesisAccountFactoryV2.connect(owner).createAccounts({gasLimit: 15_000_000})
        l1DataFeeAnalyzer.register("createAccounts", tx);
        let receipt = await tx.wait()
        //console.log(`gasUsed: ${receipt.gasUsed.toNumber().toLocaleString()}`)
        /*
        console.log(`logs:`)
        for(let i = 0; i < receipt.logs.length; i++) {
          console.log(`log ${i}`)
          console.log(receipt.logs[i])
        }
        */
      }
    })
    it("actually creates accounts", async function () {
      let tbas = await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1)
      expect(tbas.length).eq(1)
      //expect(tbas[0].agentAddress).eq(genesisAccountImplementation.address)
      await expectDeployed(tbas[0].agentAddress)
      expect(tbas[0].implementationAddress).eq(genesisAccountImplementation.address)
      //await expectDeployed(tbas[0].implementationAddress)
      let nft = await agentRegistry.getNftOfTba(tbas[0].agentAddress)
      expect(nft.collection).eq(genesisAgentNft.address)
      expect(nft.agentID).eq(1)
    });
    it("reverts when done", async function () {
      let lastCheckedAgentID0 = await genesisAccountFactoryV2.lastCheckedAgentID()
      let supply = await genesisAgentNft.totalSupply()
      if(lastCheckedAgentID0.lt(supply)) {
        throw new Error("queue not processed")
      }
      await expect(genesisAccountFactoryV2.connect(owner).createAccounts({gasLimit: 15_000_000})).to.be.revertedWithCustomError(genesisAccountFactoryV2, "NoMoreItemsInQueue")
    })
    it("can mint more agents", async function () {
      await genesisFactory.connect(user1).blastooorPublicMint(9, {value:WeiPerEther.div(100).mul(9)});
      await genesisFactory.connect(user2).blastooorPublicMint(10, {value:WeiPerEther.div(100).mul(10)});
      await genesisFactory.connect(user3).blastooorPublicMint(10, {value:WeiPerEther.div(100).mul(10)});
      await genesisFactory.connect(user4).blastooorPublicMint(10, {value:WeiPerEther.div(100).mul(10)});
      await genesisFactory.connect(user5).blastooorPublicMint(10, {value:WeiPerEther.div(100).mul(10)});
      await genesisFactory.connect(user6).blastooorPublicMint(10, {value:WeiPerEther.div(100).mul(10)});
      await genesisFactory.connect(user7).blastooorPublicMint(10, {value:WeiPerEther.div(100).mul(10)});
    })
    it("can hit various gas marks", async function () {
      let gasLimits = [
        50_000,
        300_000,
        500_000,
        700_000,
        1_000_000,
        2_000_000,
        4_000_000,
        10_000_000,
        15_000_000,
      ]
      for(let gasLimit of gasLimits) {
        //console.log(`\n\nTesting with gasLimit ${gasLimit}`)
        let supply = await genesisAgentNft.totalSupply()
        let lastCheckedAgentID0 = await genesisAccountFactoryV2.lastCheckedAgentID()
        if(lastCheckedAgentID0.gte(supply)) {
          throw new Error("No more items in queue")
        }
        let tx = await genesisAccountFactoryV2.connect(owner).createAccounts({gasLimit: gasLimit})
        l1DataFeeAnalyzer.register("createAccounts", tx);
        let receipt = await tx.wait()
        //console.log(`gasUsed: ${receipt.gasUsed.toNumber().toLocaleString()}`)
      }
    })
    it("should not miss any accounts", async function () {
      /*
      let abi = agentRegistry.abi
      console.log(`abi`)
      console.log(abi)
      abi.forEach(x => { x.stateMutability = "view" })
      let agentRegistryMC = new MulticallContract(agentRegistry.address, abi)
      */
      let totalSupply = (await genesisAgentNft.totalSupply()).toNumber()
      for(let agentID = 1; agentID <= totalSupply; agentID++) {
        //console.log(`Checking agentID #${agentID}/${totalSupply}`)
        let tbas = await agentRegistry.getTbasOfNft(genesisAgentNft.address, agentID)
        expect(tbas.length).eq(1)
        await expectDeployed(tbas[0].agentAddress)
        expect(tbas[0].implementationAddress).eq(genesisAccountImplementation.address)
        let nft = await agentRegistry.getNftOfTba(tbas[0].agentAddress)
        expect(nft.collection).eq(genesisAgentNft.address)
        expect(nft.agentID).eq(agentID)
      }
    })
    it("can skip if items already processed", async function () {
      let genesisAccountFactoryV22 = await deployContract(deployer, "BlastooorAccountFactoryV2", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, genesisAgentNft.address, agentRegistry.address, ERC6551_REGISTRY_ADDRESS]) as BlastooorAccountFactoryV2;
      await genesisAccountFactoryV22.connect(owner).postAgentCreationSettings({
        agentImplementation: genesisAccountImplementation.address,
        initializationCalls: [
          genesisAccountImplementation.interface.encodeFunctionData("blastConfigure()")
        ]
      })
      expect(await genesisAccountFactoryV22.lastCheckedAgentID()).eq(0);
      let params1 = [
        {
          account: genesisAccountFactoryV22.address,
          isAuthorized: true,
        },
      ]
      await agentRegistry.connect(owner).setOperators(params1)

      let tx = await genesisAccountFactoryV22.connect(owner).createAccounts({gasLimit: 15_000_000})
      let receipt = await tx.wait()
      /*
      console.log(`logs:`)
      for(let i = 0; i < receipt.logs.length; i++) {
        console.log(`log ${i}`)
        console.log(receipt.logs[i])
      }
      */
      expect(receipt.logs.length).eq(0) // no accounts created
    })
    //it("", async function () {})
  });

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});
