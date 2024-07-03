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
import { toBytes32, manipulateERC20BalanceOf } from "./../scripts/utils/setStorage";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { deployContract } from "../scripts/utils/deployContract";
import L1DataFeeAnalyzer from "../scripts/utils/L1DataFeeAnalyzer";
import { MulticallProvider, MulticallContract } from "./../scripts/utils/multicall";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../scripts/utils/diamond"
import { sign, assembleSignature, getMintFromAllowlistDigest, getMintFromAllowlistSignature } from "./../scripts/utils/signature";
import { getERC20PermitSignature } from "./../scripts/utils/getERC20PermitSignature";
import { convertToStruct, almostEqual } from "../scripts/utils/test";
import { moduleEFunctionParams as functionParams } from "../scripts/configuration/ConcentratedLiquidityModuleE";

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

const POOL_ADDRESS                  = "0xdA5AaEb22eD5b8aa76347eC57424CA0d109eFB2A";
const POSITION_MANAGER_ADDRESS      = "0x7553b306773EFa59E6f9676aFE049D2D2AbdfDd6";
const SWAP_ROUTER_ADDRESS           = "0x9b6D09975E29D1888b98B83e31e72c00bC4D93C5";
const FARMING_CENTER_ADDRESS        = "0x8D2eB277a50c5aeEf2C04ef4819055639F9BC168";
const ETERNAL_FARMING_ADDRESS       = "0xa0Cfb41a88f197d75FE2D07c7576679C1624a40E";
const BLADE_ADDRESS                 = "0xD1FedD031b92f50a50c05E2C45aF1aDb4CEa82f4";

const THRUSTER_ROUTER_ADDRESS_030     = "0x98994a9A7a2570367554589189dC9772241650f6"; // 0.3% fee

const MAGIC_VALUE_0 = "0x00000000";
const MAGIC_VALUE_IS_VALID_SIGNER = "0x523e3260";
const MAGIC_VALUE_IS_VALID_SIGNATURE = "0x1626ba7e";

const STRATEGY_MANAGER_ROLE = "0x4170d100a3a3728ae51207936ee755ecaa64a7f6e9383c642ab204a136f90b1b";

describe("AlgebraCLAgentFactory Blast Mainnet", function () {
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
  let explorerAgentNft: ExplorerAgents;
  let genesisAccountImplementation: BlastooorGenesisAgentAccount; // the base implementation for token bound accounts
  let strategyAccountImplementation: BlastooorStrategyAgentAccount; // the base implementation for token bound accounts
  let explorerAccountImplementation: ExplorerAgentAccount; // the base implementation for token bound accounts
  let genesisFactory: BlastooorGenesisFactory;
  let strategyFactory: BlastooorStrategyFactory;
  let dispatcher: Dispatcher;
  let strategyModuleA: DexBalancerModuleA;
  let multicallForwarder: MulticallForwarder;
  let agentRegistry: AgentRegistry;
  let genesisAccountFactory: BlastooorAccountFactory;
  let genesisAccountFactoryV2: BlastooorAccountFactoryV2;
  let balanceFetcher: BalanceFetcher;
  let clAgentFactory: AlgebraCLAgentFactory;

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
  let tbaccountE1: BlastooorStrategyAgentAccount; // an account bound to a token

  let moduleE: ConcentratedLiquidityModuleE;

  let erc20a: MockERC20;
  let erc20b: MockERC20;
  let erc20c: MockERC20;
  let weth: MockERC20;
  let usdb: MockERC20;

  let mockERC1271: MockERC1271;

  let algebraPositionManager: INonfungiblePositionManager;
  let farmingCenter: IFarmingCenter;
  let eternalFarming: IAlgebraEternalFarming;
  let blade: MockERC20;
  let bladeswapPool: IAlgebraPool;

  // start with no farm params, set later
  let farmParams = {
    rewardToken: AddressZero,
    bonusRewardToken: AddressZero,
    nonce: 0,
  }

  let thrusterRouter_030: IThrusterRouter;

  let collectionListGenesis = []
  let collectionListStrategy = []
  let collectionListAll = []
  let tokenList = []

  let chainID: number;
  let networkSettings: any;
  let snapshot: BN;

  let l1DataFeeAnalyzer = new L1DataFeeAnalyzer();

  before(async function () {
    // use blast mainnet with set fork block
    const blockNumber = 4637000;
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.BLAST_URL,
            blockNumber,
          },
        },
      ],
    });

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
    await expectDeployed(SWAP_ROUTER_ADDRESS);
    await expectDeployed(POSITION_MANAGER_ADDRESS);
    await expectDeployed(POOL_ADDRESS);
    await expectDeployed(WETH_ADDRESS);
    await expectDeployed(USDB_ADDRESS);
    await expectDeployed(FARMING_CENTER_ADDRESS);
    await expectDeployed(ETERNAL_FARMING_ADDRESS);
    await expectDeployed(BLADE_ADDRESS);
    await expectDeployed(THRUSTER_ROUTER_ADDRESS_030);

    erc6551Registry = await ethers.getContractAt("IERC6551Registry", ERC6551_REGISTRY_ADDRESS) as IERC6551Registry;

    weth = await ethers.getContractAt("MockERC20", WETH_ADDRESS) as MockERC20;
    usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS) as MockERC20;

    algebraPositionManager = await ethers.getContractAt("contracts/interfaces/external/Algebra/INonfungiblePositionManager.sol:INonfungiblePositionManager", POSITION_MANAGER_ADDRESS) as INonfungiblePositionManager;
    farmingCenter = await ethers.getContractAt("IFarmingCenter", FARMING_CENTER_ADDRESS) as IFarmingCenter;
    eternalFarming = await ethers.getContractAt("IAlgebraEternalFarming", ETERNAL_FARMING_ADDRESS) as IThrusterRIAlgebraEternalFarmingouter;
    blade = await ethers.getContractAt("MockERC20", BLADE_ADDRESS) as MockERC20;
    bladeswapPool = await ethers.getContractAt("IAlgebraPool", POOL_ADDRESS) as IAlgebraPool;


    thrusterRouter_030 = await ethers.getContractAt("IThrusterRouter", THRUSTER_ROUTER_ADDRESS_030) as IThrusterRouter;

    tokenList = [AddressZero, WETH_ADDRESS, USDB_ADDRESS, erc20a.address]
  });

  after(async function () {
    //await provider.send("evm_revert", [snapshot]);
    // reset back to blast
    const blockNumber = parseInt(process.env.BLAST_FORK_BLOCK);
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.BLAST_URL,
            blockNumber,
          },
        },
      ],
    });
  });

  describe("setup", function () {
    it("can deploy gas collector", async function () {
      gasCollector = await deployContract(deployer, "GasCollector", [owner.address, BLAST_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]);
      await expectDeployed(gasCollector.address);
      expect(await gasCollector.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy GasCollector", gasCollector.deployTransaction);
    })
    it("can deploy genesis agent ERC721", async function () {
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
    it("can deploy ExplorerAgents ERC721", async function () {
      explorerAgentNft = await deployContract(deployer, "ExplorerAgents", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]) as ExplorerAgents;
      await expectDeployed(explorerAgentNft.address);
      expect(await explorerAgentNft.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy ExplorerAgents", explorerAgentNft.deployTransaction);
      expect(await explorerAgentNft.totalSupply()).eq(0);
      expect(await explorerAgentNft.balanceOf(user1.address)).eq(0);
      collectionListStrategy = [explorerAgentNft.address]
      collectionListAll = [genesisAgentNft.address, explorerAgentNft.address]
    });
    it("can deploy ExplorerAgentAccount implementation", async function () {
      explorerAccountImplementation = await deployContract(deployer, "ExplorerAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero]) as ExplorerAgentAccount;
      await expectDeployed(explorerAccountImplementation.address);
      l1DataFeeAnalyzer.register("deploy ExplorerAgentAccount impl", explorerAccountImplementation.deployTransaction);
    });
    it("can deploy AlgebraCLAgentFactory", async function () {
      clAgentFactory = await deployContract(deployer, "AlgebraCLAgentFactory", [owner.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, multicallForwarder.address, genesisAgentNft.address, strategyAgentNft.address, explorerAgentNft.address, ERC6551_REGISTRY_ADDRESS, agentRegistry.address, WETH_ADDRESS]) as AlgebraCLAgentFactory;
      await expectDeployed(clAgentFactory.address);
      expect(await clAgentFactory.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy AlgebraCLAgentFactory", clAgentFactory.deployTransaction);
    });
    it("can deploy ConcentratedLiquidityModuleE", async function () {
      moduleE = await deployContract(deployer, "ConcentratedLiquidityModuleE", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, WETH_ADDRESS, FARMING_CENTER_ADDRESS, ETERNAL_FARMING_ADDRESS]) as ConcentratedLiquidityModuleE;
      await expectDeployed(moduleE.address);
      l1DataFeeAnalyzer.register("deploy ConcentratedLiquidityModuleE", moduleE.deployTransaction);
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
    it("can create genesis agents", async function () {
      let tx = await genesisFactory.connect(user1).blastooorPublicMint(10, {value:WeiPerEther.div(100).mul(10)});
    });
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
    it("can set agent registry operator", async function () {
      let params1 = [
        {
          account: genesisAccountFactoryV2.address,
          isAuthorized: true,
        },
        {
          account: user5.address,
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
      }
    })
  });

  describe("initial values", function () {
    it("static addresses are set properly", async function () {
      let res = await clAgentFactory.getStaticAddresses()
      expect(res.erc6551Registry_).eq(erc6551Registry.address)
      expect(res.agentRegistry_).eq(agentRegistry.address)
      expect(res.genesisAgentNft_).eq(genesisAgentNft.address)
      expect(res.strategyAgentNft_).eq(strategyAgentNft.address)
      expect(res.explorerAgentNft_).eq(explorerAgentNft.address)
      expect(res.weth_).eq(weth.address)
    })
    it("creation settings are initially empty", async function () {
      let res = await clAgentFactory.getAgentCreationSettings()
      expect(res.strategyAccountImpl_).eq(AddressZero)
      expect(res.explorerAccountImpl_).eq(AddressZero)
      expect(res.strategyInitializationCall_).eq("0x")
      expect(res.explorerInitializationCall_).eq("0x")
      expect(res.isActive_).eq(false)
    })
  });

  describe("ways to not create agents pt 1", function () {
    const sqrtPriceX96 = BN.from("1392486909633467119786647344");
    let mintParams = {
      manager: POSITION_MANAGER_ADDRESS,
      pool: POOL_ADDRESS,
      slippageLiquidity: 1_000_000,
      tickLower: -82920,
      tickUpper: -76020,
      sqrtPriceX96: sqrtPriceX96,
    }
    let deposit0 = {
      token: WETH_ADDRESS,
      amount: WeiPerEther.div(10)
    }
    let deposit1 = {
      token: USDB_ADDRESS,
      amount: WeiPerEther.mul(300)
    }
    it("cannot create agents if inactive pt 1", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRoot(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.revertedWithCustomError(clAgentFactory, "CreationSettingsPaused")
    })
    it("cannot create agents if inactive pt 2", async function () {
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentAndExplorer(
        mintParams, farmParams, deposit0, deposit1
      )).to.be.revertedWithCustomError(clAgentFactory, "CreationSettingsPaused")
    })
    it("cannot create agents if inactive pt 3", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRootAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.revertedWithCustomError(clAgentFactory, "CreationSettingsPaused")
    })
    it("cannot create agents if inactive pt 4", async function () {
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentAndExplorerAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1
      )).to.be.revertedWithCustomError(clAgentFactory, "CreationSettingsPaused")
    })
  });

  describe("post settings", function () {
    it("non owner cannot post settings", async function () {
      await expect(clAgentFactory.connect(user1).postAgentCreationSettings({
        strategyAccountImpl: strategyAccountImplementation.address,
        explorerAccountImpl: explorerAccountImplementation.address,
        strategyInitializationCall: "0x",
        explorerInitializationCall: "0x",
        isActive: true,
      })).to.be.revertedWithCustomError(clAgentFactory, "NotContractOwner")
    })
    it("owner can post settings", async function () {
      let blastConfigureCalldata = strategyAccountImplementation.interface.encodeFunctionData("blastConfigure()")
      let overrides = [
        {
          implementation: moduleE.address,
          functionParams: functionParams
        }
      ]
      let setOverridesCalldata = strategyAccountImplementation.interface.encodeFunctionData("setOverrides", [overrides])
      let txdatas = [blastConfigureCalldata, setOverridesCalldata]
      let multicallCalldata = strategyAccountImplementation.interface.encodeFunctionData("multicall", [txdatas])
      let settings1 = {
        strategyAccountImpl: strategyAccountImplementation.address,
        explorerAccountImpl: explorerAccountImplementation.address,
        strategyInitializationCall: multicallCalldata,
        explorerInitializationCall: blastConfigureCalldata,
        isActive: true,
      }
      let tx = await clAgentFactory.connect(owner).postAgentCreationSettings(settings1)
      await expect(tx).to.emit(clAgentFactory, "AgentCreationSettingsPosted")
      let res = await clAgentFactory.getAgentCreationSettings()
      expect(res.strategyAccountImpl_).eq(settings1.strategyAccountImpl)
      expect(res.explorerAccountImpl_).eq(settings1.explorerAccountImpl)
      expect(res.strategyInitializationCall_).eq(settings1.strategyInitializationCall)
      expect(res.explorerInitializationCall_).eq(settings1.explorerInitializationCall)
      expect(res.isActive_).eq(settings1.isActive)
      l1DataFeeAnalyzer.register("AlgebraCLAgentFactory.postAgentCreationSettings", tx);
    })
  });

  describe("ways to not create agents pt 2", function () {
    const sqrtPriceX96 = BN.from("1392486909633467119786647344");
    let mintParams = {
      manager: POSITION_MANAGER_ADDRESS,
      pool: POOL_ADDRESS,
      slippageLiquidity: 1_000_000,
      tickLower: -82920,
      tickUpper: -76020,
      sqrtPriceX96: sqrtPriceX96,
    }
    let deposit0 = {
      token: WETH_ADDRESS,
      amount: WeiPerEther.div(10)
    }
    let deposit1 = {
      token: USDB_ADDRESS,
      amount: WeiPerEther.mul(300)
    }

    it("cannot create a v3 agent for not an agent pt 1", async function () {
      let rootAgentAddress = AddressZero
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRoot(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.revertedWithCustomError(clAgentFactory, "NotAnAgent")
    })
    it("cannot create a v3 agent for not an agent pt 2", async function () {
      let rootAgentAddress = user1.address
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRoot(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.revertedWithCustomError(clAgentFactory, "NotAnAgent")
    })
    it("cannot create a v3 agent for not an agent pt 3", async function () {
      let rootAgentAddress = strategyAccountImplementation.address
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRoot(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.revertedWithCustomError(clAgentFactory, "NotAnAgent")
    })
    it("cannot create a v3 agent for not an agent pt 4", async function () {
      let rootAgentAddress = AddressZero
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRootAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.revertedWithCustomError(clAgentFactory, "NotAnAgent")
    })
    it("cannot create a v3 agent for not an agent pt 5", async function () {
      let rootAgentAddress = user1.address
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRootAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.revertedWithCustomError(clAgentFactory, "NotAnAgent")
    })
    it("cannot create a v3 agent for not an agent pt 6", async function () {
      let rootAgentAddress = strategyAccountImplementation.address
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRootAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.revertedWithCustomError(clAgentFactory, "NotAnAgent")
    })
    it("register more agents", async function () {
      let registerAgentParams = [
        {
            agentAddress: user1.address,
            implementationAddress: user1.address,
            collection: user1.address,
            agentID: 999,
        },
        {
            agentAddress: user2.address,
            implementationAddress: user2.address,
            collection: genesisAgentNft.address,
            agentID: 999,
        },
        {
            agentAddress: user3.address,
            implementationAddress: user3.address,
            collection: strategyAgentNft.address,
            agentID: 999,
        },
        {
            agentAddress: user4.address,
            implementationAddress: user4.address,
            collection: explorerAgentNft.address,
            agentID: 999,
        },
      ]
      await agentRegistry.connect(user5).registerAgents(registerAgentParams)
    })
    it("cannot create a v3 agent for not an agent pt 7", async function () {
      let rootAgentAddress = user1.address
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRoot(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.revertedWithCustomError(clAgentFactory, "NotAnAgent")
    })
    it("cannot create a v3 agent for not an agent pt 8", async function () {
      let rootAgentAddress = user1.address
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRootAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.revertedWithCustomError(clAgentFactory, "NotAnAgent")
    })
    it("cannot create a v3 agent for a root agent you dont own pt 1", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      await expect(clAgentFactory.connect(user2).createConcentratedLiquidityAgentForRoot(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.revertedWithCustomError(clAgentFactory, "NotOwnerOfAgent")
    })
    it("cannot create a v3 agent for a root agent you dont own pt 2", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      await expect(clAgentFactory.connect(user2).createConcentratedLiquidityAgentForRootAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.revertedWithCustomError(clAgentFactory, "NotOwnerOfAgent")
    })
    it("cannot create a v3 agent with insufficient balance pt 1", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRoot(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.reverted
    })
    it("cannot create a v3 agent with insufficient balance pt 2", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRootAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.reverted
    })
    it("get tokens", async function () {
      expect(await weth.balanceOf(user1.address)).eq(0)
      expect(await usdb.balanceOf(user1.address)).eq(0)

      //await weth.connect(user1).deposit({value: WeiPerEther})
      await user1.sendTransaction({
        to: WETH_ADDRESS,
        value: WeiPerEther.mul(10),
        gasLimit: 100_000
      })
      /*
      // mint some usdb
      let slot = 0; //await findERC20BalanceOfSlot(USDB_ADDRESS)
      let desiredBalance = WeiPerEther.mul(1_000_000)
      await manipulateERC20BalanceOf(USDB_ADDRESS, slot, user1.address, desiredBalance)
      await manipulateERC20BalanceOf(USDB_ADDRESS, slot, user3.address, desiredBalance)
      */

      let amountIn = WeiPerEther.mul(10)
      let amountOutMin = WeiPerEther.mul(10_000)
      let path = [WETH_ADDRESS, USDB_ADDRESS]
      let tx = await thrusterRouter_030.connect(user1).swapExactETHForTokens(amountOutMin, path, user1.address, MaxUint256, {value:amountIn})

      expect(await weth.balanceOf(user1.address)).eq(WeiPerEther.mul(10))
      expect(await usdb.balanceOf(user1.address)).gte(amountOutMin)
    })
    it("cannot create a v3 agent with insufficient allowance pt 1", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRoot(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.reverted
    })
    it("cannot create a v3 agent with insufficient allowance pt 2", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRootAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.reverted
    })
    it("approve", async function () {
      await weth.connect(user1).approve(clAgentFactory.address, MaxUint256)
      await usdb.connect(user1).approve(clAgentFactory.address, MaxUint256)
    })
    it("cannot create a v3 agent if factory is not whitelisted for strategy agents pt 1", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRoot(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.revertedWithCustomError(strategyAgentNft, "FactoryNotWhitelisted")
    })
    it("cannot create a v3 agent if factory is not whitelisted for strategy agents pt 2", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRootAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.revertedWithCustomError(strategyAgentNft, "FactoryNotWhitelisted")
    })
    it("cannot create a v3 agent if factory is not whitelisted for strategy agents pt 3", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentAndExplorer(
        mintParams, farmParams, deposit0, deposit1
      )).to.be.revertedWithCustomError(strategyAgentNft, "FactoryNotWhitelisted")
    })
    it("cannot create a v3 agent if factory is not whitelisted for strategy agents pt 4", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentAndExplorerAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1
      )).to.be.revertedWithCustomError(strategyAgentNft, "FactoryNotWhitelisted")
    })
    it("whitelist factory for strategy agents", async function () {
      let whitelist = [
        {
          factory: clAgentFactory.address,
          shouldWhitelist: true
        }
      ];
      let tx = await strategyAgentNft.connect(owner).setWhitelist(whitelist);
      for(let i = 0; i < whitelist.length; i++) {
        let whitelistItem = whitelist[i]
        await expect(tx).to.emit(strategyAgentNft, "FactoryWhitelisted").withArgs(whitelistItem.factory, whitelistItem.shouldWhitelist);
        expect(await strategyAgentNft.factoryIsWhitelisted(whitelistItem.factory)).eq(whitelistItem.shouldWhitelist);
      }
      l1DataFeeAnalyzer.register("whitelist factories 2", tx);
    });
    it("cannot create a explorer agent if factory is not whitelisted for explorer agents pt 1", async function () {
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentAndExplorer(
        mintParams, farmParams, deposit0, deposit1
      )).to.be.revertedWithCustomError(explorerAgentNft, "FactoryNotWhitelisted")
    })
    it("cannot create a explorer agent if factory is not whitelisted for explorer agents pt 2", async function () {
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentAndExplorerAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1
      )).to.be.revertedWithCustomError(explorerAgentNft, "FactoryNotWhitelisted")
    })
    it("whitelist factory for explorer agents", async function () {
      let whitelist = [
        {
          factory: clAgentFactory.address,
          shouldWhitelist: true
        }
      ];
      let tx = await explorerAgentNft.connect(owner).setWhitelist(whitelist);
      for(let i = 0; i < whitelist.length; i++) {
        let whitelistItem = whitelist[i]
        await expect(tx).to.emit(explorerAgentNft, "FactoryWhitelisted").withArgs(whitelistItem.factory, whitelistItem.shouldWhitelist);
        expect(await explorerAgentNft.factoryIsWhitelisted(whitelistItem.factory)).eq(whitelistItem.shouldWhitelist);
      }
      l1DataFeeAnalyzer.register("whitelist factories 2", tx);
    });
    it("cannot create agent if factory is not registry operator pt 1", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRoot(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.revertedWithCustomError(agentRegistry, "NotOperator");
    });
    it("cannot create agent if factory is not registry operator pt 2", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRootAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )).to.be.revertedWithCustomError(agentRegistry, "NotOperator");
    });
    it("cannot create agent if factory is not registry operator pt 3", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentAndExplorer(
        mintParams, farmParams, deposit0, deposit1
      )).to.be.revertedWithCustomError(agentRegistry, "NotOperator");
    });
    it("cannot create agent if factory is not registry operator pt 4", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentAndExplorerAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1
      )).to.be.revertedWithCustomError(agentRegistry, "NotOperator");
    });
    it("registry setup", async function () {
      let params1 = [
        {
          account: clAgentFactory.address,
          isAuthorized: true,
        },
      ]
      let tx = await agentRegistry.connect(owner).setOperators(params1)
      for(let i = 0; i < params1.length; i++) {
        let { account, isAuthorized } = params1[i]
        await expect(tx).to.emit(agentRegistry, "OperatorSet").withArgs(account, isAuthorized);
        expect(await agentRegistry.isOperator(account)).eq(isAuthorized);
      }
    });
    it("cannot create a v3 agent using eth with insufficient value pt 1", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      deposit0.token = AddressZero
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRoot(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress, {value: deposit0.amount.sub(1)}
      )).to.be.revertedWithCustomError(clAgentFactory, "InsufficientBalance");
    })
    it("cannot create a v3 agent using eth with insufficient value pt 2", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      deposit0.token = AddressZero
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRootAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress, {value: deposit0.amount.sub(1)}
      )).to.be.revertedWithCustomError(clAgentFactory, "InsufficientBalance");
    })
    it("cannot create a v3 agent using eth with insufficient value pt 3", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      deposit0.token = AddressZero
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentAndExplorer(
        mintParams, farmParams, deposit0, deposit1, {value: deposit0.amount.sub(1)}
      )).to.be.revertedWithCustomError(clAgentFactory, "InsufficientBalance");
    })
    it("cannot create a v3 agent using eth with insufficient value pt 4", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      deposit0.token = AddressZero
      await expect(clAgentFactory.connect(user1).createConcentratedLiquidityAgentAndExplorerAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, {value: deposit0.amount.sub(1)}
      )).to.be.revertedWithCustomError(clAgentFactory, "InsufficientBalance");
    })
  });

  describe("createConcentratedLiquidityAgentForRoot()", function () {
    const sqrtPriceX96 = BN.from("1392486909633467119786647344");
    let mintParams = {
      manager: POSITION_MANAGER_ADDRESS,
      pool: POOL_ADDRESS,
      slippageLiquidity: 1_000_000,
      tickLower: -82920,
      tickUpper: -76020,
      sqrtPriceX96: sqrtPriceX96,
    }
    let deposit0 = {
      token: WETH_ADDRESS,
      amount: WeiPerEther.div(10)
    }
    let deposit1 = {
      token: USDB_ADDRESS,
      amount: WeiPerEther.mul(300)
    }

    it("can create a v3 agent for a root agent you do own", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      // create
      let staticRes = await clAgentFactory.connect(user1).callStatic.createConcentratedLiquidityAgentForRoot(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )
      let strategyAgentID = 1
      expect(staticRes.strategyAgentID).eq(strategyAgentID)
      let tx = await clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRoot(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )
      l1DataFeeAnalyzer.register("createConcentratedLiquidityAgentForRoot", tx);
      await watchTxForEvents(tx)
      // created a new agent
      expect(await strategyAgentNft.totalSupply()).eq(1)
      expect(await strategyAgentNft.balanceOf(user1.address)).eq(0)
      expect(await strategyAgentNft.balanceOf(rootAgentAddress)).eq(1)
      let tbas = await agentRegistry.getTbasOfNft(strategyAgentNft.address, strategyAgentID)
      expect(tbas.length).eq(1)
      let agentAddress = tbas[0].agentAddress
      await expectDeployed(agentAddress)
      expect(agentAddress).eq(staticRes.strategyAddress)
      let balances = await getBalances(agentAddress, false, "strategy agent")
      expect(balances.eth).eq(0)
      expect(balances.weth).gte(0)
      expect(balances.usdb).gte(0)
      expect(balances.weth.add(balances.usdb)).gt(0) // should keep dust amounts
      expect(balances.genesisAgents).eq(0)
      expect(balances.strategyAgents).eq(0)
      expect(balances.explorerAgents).eq(0)
      expect(balances.bladeswapPositions).eq(1)
      // agent has a v3 position
      let moduleContract = await ethers.getContractAt("ConcentratedLiquidityModuleE", agentAddress) as ConcentratedLiquidityModuleE
      let moduleName = await moduleContract.moduleName()
      expect(moduleName).eq("ConcentratedLiquidityModuleE")
      let strategyType = await moduleContract.strategyType()
      expect(strategyType).eq("Concentrated Liquidity")
      let manager = await moduleContract.manager()
      expect(manager).eq(POSITION_MANAGER_ADDRESS)
      let pool = await moduleContract.pool()
      expect(pool).eq(POOL_ADDRESS)
      let tokenId = await moduleContract.tokenId()
      expect(tokenId).gt(0)
      expect(tokenId).eq(staticRes.nonfungiblePositionTokenId)
      //console.log(`tokenId ${tokenId.toString()}`)
      let state = await moduleContract.safelyGetStateOfAMM()
      //console.log(`state`, state)
      //expect().eq("")
      let position = await moduleContract.position()
      //console.log(`position`, position)
      expect(position.token0).eq(USDB_ADDRESS)
      expect(position.token1).eq(WETH_ADDRESS)
      expect(position.liquidity).gt(0)
      // does not create an explorer agent
      expect(await explorerAgentNft.totalSupply()).eq(0)
    })
    it("can create a v3 agent using eth pt 1", async function () {
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, 1))[0].agentAddress
      // create
      deposit0.token = AddressZero
      let staticRes = await clAgentFactory.connect(user1).callStatic.createConcentratedLiquidityAgentForRoot(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress, {value: deposit0.amount}
      )
      let strategyAgentID = 2
      expect(staticRes.strategyAgentID).eq(strategyAgentID)
      let tx = await clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRoot(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress, {value: deposit0.amount}
      )
      l1DataFeeAnalyzer.register("createConcentratedLiquidityAgentForRoot", tx);
      await watchTxForEvents(tx)
      // created a new agent
      expect(await strategyAgentNft.totalSupply()).eq(2)
      expect(await strategyAgentNft.balanceOf(user1.address)).eq(0)
      expect(await strategyAgentNft.balanceOf(rootAgentAddress)).eq(2)
      let tbas = await agentRegistry.getTbasOfNft(strategyAgentNft.address, strategyAgentID)
      expect(tbas.length).eq(1)
      let agentAddress = tbas[0].agentAddress
      await expectDeployed(agentAddress)
      expect(agentAddress).eq(staticRes.strategyAddress)
      let balances = await getBalances(agentAddress, false, "strategy agent")
      expect(balances.eth).eq(0)
      expect(balances.weth).gte(0)
      expect(balances.usdb).gte(0)
      expect(balances.weth.add(balances.usdb)).gt(0) // should keep dust amounts
      expect(balances.genesisAgents).eq(0)
      expect(balances.strategyAgents).eq(0)
      expect(balances.explorerAgents).eq(0)
      expect(balances.bladeswapPositions).eq(1)
      // agent has a v3 position
      let moduleContract = await ethers.getContractAt("ConcentratedLiquidityModuleE", agentAddress) as ConcentratedLiquidityModuleE
      let moduleName = await moduleContract.moduleName()
      expect(moduleName).eq("ConcentratedLiquidityModuleE")
      let strategyType = await moduleContract.strategyType()
      expect(strategyType).eq("Concentrated Liquidity")
      let manager = await moduleContract.manager()
      expect(manager).eq(POSITION_MANAGER_ADDRESS)
      let pool = await moduleContract.pool()
      expect(pool).eq(POOL_ADDRESS)
      let tokenId = await moduleContract.tokenId()
      expect(tokenId).gt(0)
      expect(tokenId).eq(staticRes.nonfungiblePositionTokenId)
      //console.log(`tokenId ${tokenId.toString()}`)
      let state = await moduleContract.safelyGetStateOfAMM()
      //console.log(`state`, state)
      //expect().eq("")
      let position = await moduleContract.position()
      //console.log(`position`, position)
      expect(position.token0).eq(USDB_ADDRESS)
      expect(position.token1).eq(WETH_ADDRESS)
      expect(position.liquidity).gt(0)
      // does not create an explorer agent
      expect(await explorerAgentNft.totalSupply()).eq(0)
    })
    it("can create a v3 agent using eth pt 2", async function () {
      let genesisAgentID = 2
      let strategyAgentID = 3
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, genesisAgentID))[0].agentAddress
      // create
      deposit0 = {
        token: USDB_ADDRESS,
        amount: WeiPerEther.mul(300)
      }
      deposit1 = {
        token: AddressZero,
        amount: WeiPerEther.div(10)
      }
      let staticRes = await clAgentFactory.connect(user1).callStatic.createConcentratedLiquidityAgentForRoot(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress, {value: deposit1.amount}
      )
      expect(staticRes.strategyAgentID).eq(strategyAgentID)
      let tx = await clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRoot(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress, {value: deposit1.amount}
      )
      l1DataFeeAnalyzer.register("createConcentratedLiquidityAgentForRoot", tx);
      await watchTxForEvents(tx)
      // created a new agent
      expect(await strategyAgentNft.totalSupply()).eq(3)
      expect(await strategyAgentNft.balanceOf(user1.address)).eq(0)
      expect(await strategyAgentNft.balanceOf(rootAgentAddress)).eq(1)
      let tbas = await agentRegistry.getTbasOfNft(strategyAgentNft.address, strategyAgentID)
      expect(tbas.length).eq(1)
      let agentAddress = tbas[0].agentAddress
      await expectDeployed(agentAddress)
      expect(agentAddress).eq(staticRes.strategyAddress)
      let balances = await getBalances(agentAddress, false, "strategy agent")
      expect(balances.eth).eq(0)
      expect(balances.weth).gte(0)
      expect(balances.usdb).gte(0)
      expect(balances.weth.add(balances.usdb)).gt(0) // should keep dust amounts
      expect(balances.genesisAgents).eq(0)
      expect(balances.strategyAgents).eq(0)
      expect(balances.explorerAgents).eq(0)
      expect(balances.bladeswapPositions).eq(1)
      // agent has a v3 position
      let moduleContract = await ethers.getContractAt("ConcentratedLiquidityModuleE", agentAddress) as ConcentratedLiquidityModuleE
      let moduleName = await moduleContract.moduleName()
      expect(moduleName).eq("ConcentratedLiquidityModuleE")
      let strategyType = await moduleContract.strategyType()
      expect(strategyType).eq("Concentrated Liquidity")
      let manager = await moduleContract.manager()
      expect(manager).eq(POSITION_MANAGER_ADDRESS)
      let pool = await moduleContract.pool()
      expect(pool).eq(POOL_ADDRESS)
      let tokenId = await moduleContract.tokenId()
      expect(tokenId).gt(0)
      expect(tokenId).eq(staticRes.nonfungiblePositionTokenId)
      //console.log(`tokenId ${tokenId.toString()}`)
      let state = await moduleContract.safelyGetStateOfAMM()
      //console.log(`state`, state)
      //expect().eq("")
      let position = await moduleContract.position()
      //console.log(`position`, position)
      expect(position.token0).eq(USDB_ADDRESS)
      expect(position.token1).eq(WETH_ADDRESS)
      expect(position.liquidity).gt(0)
      // does not create an explorer agent
      expect(await explorerAgentNft.totalSupply()).eq(0)
    })
  });

  describe("createConcentratedLiquidityAgentAndExplorer()", function () {
    const sqrtPriceX96 = BN.from("1392486909633467119786647344");
    let mintParams = {
      manager: POSITION_MANAGER_ADDRESS,
      pool: POOL_ADDRESS,
      slippageLiquidity: 1_000_000,
      tickLower: -82920,
      tickUpper: -76020,
      sqrtPriceX96: sqrtPriceX96,
    }
    let deposit0 = {
      token: WETH_ADDRESS,
      amount: WeiPerEther.div(10)
    }
    let deposit1 = {
      token: USDB_ADDRESS,
      amount: WeiPerEther.mul(300)
    }

    it("can create a v3 agent and new explorer agent", async function () {
      // create
      let strategyAgentID = 4
      let explorerAgentID = 1
      let staticRes = await clAgentFactory.connect(user1).callStatic.createConcentratedLiquidityAgentAndExplorer(
        mintParams, farmParams, deposit0, deposit1
      )
      expect(staticRes.strategyAgentID).eq(strategyAgentID)
      expect(staticRes.explorerAgentID).eq(explorerAgentID)
      let tx = await clAgentFactory.connect(user1).createConcentratedLiquidityAgentAndExplorer(
        mintParams, farmParams, deposit0, deposit1
      )
      l1DataFeeAnalyzer.register("createConcentratedLiquidityAgentAndExplorer", tx);
      await watchTxForEvents(tx)
      // created a new explorer agent
      expect(await explorerAgentNft.totalSupply()).eq(1)
      expect(await explorerAgentNft.balanceOf(user1.address)).eq(1)
      let explorerTbas = await agentRegistry.getTbasOfNft(explorerAgentNft.address, explorerAgentID)
      expect(explorerTbas.length).eq(1)
      let explorerAddress = explorerTbas[0].agentAddress
      await expectDeployed(explorerAddress)
      expect(explorerAddress).eq(staticRes.explorerAddress)
      let explorerBalances = await getBalances(explorerAddress, false, "explorer agent")
      expect(explorerBalances.eth).eq(0)
      expect(explorerBalances.weth).eq(0)
      expect(explorerBalances.usdb).eq(0)
      expect(explorerBalances.genesisAgents).eq(0)
      expect(explorerBalances.strategyAgents).eq(1)
      expect(explorerBalances.explorerAgents).eq(0)
      expect(explorerBalances.bladeswapPositions).eq(0)
      // created a new agent
      expect(await strategyAgentNft.totalSupply()).eq(4)
      expect(await strategyAgentNft.balanceOf(user1.address)).eq(0)
      expect(await strategyAgentNft.balanceOf(explorerAddress)).eq(1)
      let strategyTbas = await agentRegistry.getTbasOfNft(strategyAgentNft.address, strategyAgentID)
      expect(strategyTbas.length).eq(1)
      let strategyAddress = strategyTbas[0].agentAddress
      await expectDeployed(strategyAddress)
      expect(strategyAddress).eq(staticRes.strategyAddress)
      let strategyBalances = await getBalances(strategyAddress, false, "strategy agent")
      expect(strategyBalances.eth).eq(0)
      expect(strategyBalances.weth).gte(0)
      expect(strategyBalances.usdb).gte(0)
      expect(strategyBalances.weth.add(strategyBalances.usdb)).gt(0) // should keep dust amounts
      expect(strategyBalances.genesisAgents).eq(0)
      expect(strategyBalances.strategyAgents).eq(0)
      expect(strategyBalances.explorerAgents).eq(0)
      expect(strategyBalances.bladeswapPositions).eq(1)
      // agent has a v3 position
      let moduleContract = await ethers.getContractAt("ConcentratedLiquidityModuleE", strategyAddress) as ConcentratedLiquidityModuleE
      let moduleName = await moduleContract.moduleName()
      expect(moduleName).eq("ConcentratedLiquidityModuleE")
      let strategyType = await moduleContract.strategyType()
      expect(strategyType).eq("Concentrated Liquidity")
      let manager = await moduleContract.manager()
      expect(manager).eq(POSITION_MANAGER_ADDRESS)
      let pool = await moduleContract.pool()
      expect(pool).eq(POOL_ADDRESS)
      let tokenId = await moduleContract.tokenId()
      expect(tokenId).gt(0)
      expect(tokenId).eq(staticRes.nonfungiblePositionTokenId)
      //console.log(`tokenId ${tokenId.toString()}`)
      let state = await moduleContract.safelyGetStateOfAMM()
      //console.log(`state`, state)
      //expect().eq("")
      let position = await moduleContract.position()
      //console.log(`position`, position)
      expect(position.token0).eq(USDB_ADDRESS)
      expect(position.token1).eq(WETH_ADDRESS)
      expect(position.liquidity).gt(0)
    })
  });

  describe("createConcentratedLiquidityAgentForRootAndRefundExcess()", function () {
    const sqrtPriceX96 = BN.from("1392486909633467119786647344");
    let mintParams = {
      manager: POSITION_MANAGER_ADDRESS,
      pool: POOL_ADDRESS,
      slippageLiquidity: 1_000_000,
      tickLower: -82920,
      tickUpper: -76020,
      sqrtPriceX96: sqrtPriceX96,
    }
    let deposit0 = {
      token: WETH_ADDRESS,
      amount: WeiPerEther.div(10)
    }
    let deposit1 = {
      token: USDB_ADDRESS,
      amount: WeiPerEther.mul(300)
    }

    it("can create a v3 agent for a root agent you do own", async function () {
      let genesisAgentID = 5
      let strategyAgentID = 5
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, genesisAgentID))[0].agentAddress
      // create
      let staticRes = await clAgentFactory.connect(user1).callStatic.createConcentratedLiquidityAgentForRootAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )
      expect(staticRes.strategyAgentID).eq(strategyAgentID)
      let tx = await clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRootAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress
      )
      l1DataFeeAnalyzer.register("createConcentratedLiquidityAgentForRootAndRefundExcess", tx);
      await watchTxForEvents(tx)
      // created a new agent
      expect(await strategyAgentNft.totalSupply()).eq(strategyAgentID)
      expect(await strategyAgentNft.balanceOf(user1.address)).eq(0)
      expect(await strategyAgentNft.balanceOf(rootAgentAddress)).eq(1)
      let tbas = await agentRegistry.getTbasOfNft(strategyAgentNft.address, strategyAgentID)
      expect(tbas.length).eq(1)
      let agentAddress = tbas[0].agentAddress
      await expectDeployed(agentAddress)
      expect(agentAddress).eq(staticRes.strategyAddress)
      let balances = await getBalances(agentAddress, false, "strategy agent")
      expect(balances.eth).eq(0)
      expect(balances.weth).eq(0) // should not keep dust amounts
      expect(balances.usdb).eq(0)
      expect(balances.genesisAgents).eq(0)
      expect(balances.strategyAgents).eq(0)
      expect(balances.explorerAgents).eq(0)
      expect(balances.bladeswapPositions).eq(1)
      // agent has a v3 position
      let moduleContract = await ethers.getContractAt("ConcentratedLiquidityModuleE", agentAddress) as ConcentratedLiquidityModuleE
      let moduleName = await moduleContract.moduleName()
      expect(moduleName).eq("ConcentratedLiquidityModuleE")
      let strategyType = await moduleContract.strategyType()
      expect(strategyType).eq("Concentrated Liquidity")
      let manager = await moduleContract.manager()
      expect(manager).eq(POSITION_MANAGER_ADDRESS)
      let pool = await moduleContract.pool()
      expect(pool).eq(POOL_ADDRESS)
      let tokenId = await moduleContract.tokenId()
      expect(tokenId).gt(0)
      expect(tokenId).eq(staticRes.nonfungiblePositionTokenId)
      //console.log(`tokenId ${tokenId.toString()}`)
      let state = await moduleContract.safelyGetStateOfAMM()
      //console.log(`state`, state)
      //expect().eq("")
      let position = await moduleContract.position()
      //console.log(`position`, position)
      expect(position.token0).eq(USDB_ADDRESS)
      expect(position.token1).eq(WETH_ADDRESS)
      expect(position.liquidity).gt(0)
      // does not create an explorer agent
      expect(await explorerAgentNft.totalSupply()).eq(1)
    })
    it("can create a v3 agent using eth pt 1", async function () {
      let genesisAgentID = 5
      let strategyAgentID = 6
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, genesisAgentID))[0].agentAddress
      // create
      deposit0.token = AddressZero
      let staticRes = await clAgentFactory.connect(user1).callStatic.createConcentratedLiquidityAgentForRootAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress, {value: deposit0.amount}
      )
      expect(staticRes.strategyAgentID).eq(strategyAgentID)
      let tx = await clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRootAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress, {value: deposit0.amount}
      )
      l1DataFeeAnalyzer.register("createConcentratedLiquidityAgentForRootAndRefundExcess", tx);
      await watchTxForEvents(tx)
      // created a new agent
      expect(await strategyAgentNft.totalSupply()).eq(strategyAgentID)
      expect(await strategyAgentNft.balanceOf(user1.address)).eq(0)
      expect(await strategyAgentNft.balanceOf(rootAgentAddress)).eq(2)
      let tbas = await agentRegistry.getTbasOfNft(strategyAgentNft.address, strategyAgentID)
      expect(tbas.length).eq(1)
      let agentAddress = tbas[0].agentAddress
      await expectDeployed(agentAddress)
      expect(agentAddress).eq(staticRes.strategyAddress)
      let balances = await getBalances(agentAddress, false, "strategy agent")
      expect(balances.eth).eq(0)
      expect(balances.weth).eq(0) // should not keep dust amounts
      expect(balances.usdb).eq(0)
      expect(balances.genesisAgents).eq(0)
      expect(balances.strategyAgents).eq(0)
      expect(balances.explorerAgents).eq(0)
      expect(balances.bladeswapPositions).eq(1)
      // agent has a v3 position
      let moduleContract = await ethers.getContractAt("ConcentratedLiquidityModuleE", agentAddress) as ConcentratedLiquidityModuleE
      let moduleName = await moduleContract.moduleName()
      expect(moduleName).eq("ConcentratedLiquidityModuleE")
      let strategyType = await moduleContract.strategyType()
      expect(strategyType).eq("Concentrated Liquidity")
      let manager = await moduleContract.manager()
      expect(manager).eq(POSITION_MANAGER_ADDRESS)
      let pool = await moduleContract.pool()
      expect(pool).eq(POOL_ADDRESS)
      let tokenId = await moduleContract.tokenId()
      expect(tokenId).gt(0)
      expect(tokenId).eq(staticRes.nonfungiblePositionTokenId)
      //console.log(`tokenId ${tokenId.toString()}`)
      let state = await moduleContract.safelyGetStateOfAMM()
      //console.log(`state`, state)
      //expect().eq("")
      let position = await moduleContract.position()
      //console.log(`position`, position)
      expect(position.token0).eq(USDB_ADDRESS)
      expect(position.token1).eq(WETH_ADDRESS)
      expect(position.liquidity).gt(0)
      // does not create an explorer agent
      expect(await explorerAgentNft.totalSupply()).eq(1)
    })
    it("can create a v3 agent using eth pt 2", async function () {
      let genesisAgentID = 5
      let strategyAgentID = 7
      let rootAgentAddress = (await agentRegistry.getTbasOfNft(genesisAgentNft.address, genesisAgentID))[0].agentAddress
      // create
      deposit0 = {
        token: USDB_ADDRESS,
        amount: WeiPerEther.mul(300)
      }
      deposit1 = {
        token: AddressZero,
        amount: WeiPerEther.div(10)
      }
      let staticRes = await clAgentFactory.connect(user1).callStatic.createConcentratedLiquidityAgentForRootAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress, {value: deposit1.amount}
      )
      expect(staticRes.strategyAgentID).eq(strategyAgentID)
      let tx = await clAgentFactory.connect(user1).createConcentratedLiquidityAgentForRootAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1, rootAgentAddress, {value: deposit1.amount}
      )
      l1DataFeeAnalyzer.register("createConcentratedLiquidityAgentForRootAndRefundExcess", tx);
      await watchTxForEvents(tx)
      // created a new agent
      expect(await strategyAgentNft.totalSupply()).eq(strategyAgentID)
      expect(await strategyAgentNft.balanceOf(user1.address)).eq(0)
      expect(await strategyAgentNft.balanceOf(rootAgentAddress)).eq(3)
      let tbas = await agentRegistry.getTbasOfNft(strategyAgentNft.address, strategyAgentID)
      expect(tbas.length).eq(1)
      let agentAddress = tbas[0].agentAddress
      await expectDeployed(agentAddress)
      expect(agentAddress).eq(staticRes.strategyAddress)
      let balances = await getBalances(agentAddress, false, "strategy agent")
      expect(balances.eth).eq(0)
      expect(balances.weth).eq(0) // should not keep dust amounts
      expect(balances.usdb).eq(0)
      expect(balances.genesisAgents).eq(0)
      expect(balances.strategyAgents).eq(0)
      expect(balances.explorerAgents).eq(0)
      expect(balances.bladeswapPositions).eq(1)
      // agent has a v3 position
      let moduleContract = await ethers.getContractAt("ConcentratedLiquidityModuleE", agentAddress) as ConcentratedLiquidityModuleE
      let moduleName = await moduleContract.moduleName()
      expect(moduleName).eq("ConcentratedLiquidityModuleE")
      let strategyType = await moduleContract.strategyType()
      expect(strategyType).eq("Concentrated Liquidity")
      let manager = await moduleContract.manager()
      expect(manager).eq(POSITION_MANAGER_ADDRESS)
      let pool = await moduleContract.pool()
      expect(pool).eq(POOL_ADDRESS)
      let tokenId = await moduleContract.tokenId()
      expect(tokenId).gt(0)
      expect(tokenId).eq(staticRes.nonfungiblePositionTokenId)
      //console.log(`tokenId ${tokenId.toString()}`)
      let state = await moduleContract.safelyGetStateOfAMM()
      //console.log(`state`, state)
      //expect().eq("")
      let position = await moduleContract.position()
      //console.log(`position`, position)
      expect(position.token0).eq(USDB_ADDRESS)
      expect(position.token1).eq(WETH_ADDRESS)
      expect(position.liquidity).gt(0)
      // does not create an explorer agent
      expect(await explorerAgentNft.totalSupply()).eq(1)
    })
  });

  describe("createConcentratedLiquidityAgentAndExplorerAndRefundExcess()", function () {
    const sqrtPriceX96 = BN.from("1392486909633467119786647344");
    let mintParams = {
      manager: POSITION_MANAGER_ADDRESS,
      pool: POOL_ADDRESS,
      slippageLiquidity: 1_000_000,
      tickLower: -82920,
      tickUpper: -76020,
      sqrtPriceX96: sqrtPriceX96,
    }
    let deposit0 = {
      token: WETH_ADDRESS,
      amount: WeiPerEther.div(10)
    }
    let deposit1 = {
      token: USDB_ADDRESS,
      amount: WeiPerEther.mul(300)
    }

    it("can create a v3 agent and new explorer agent", async function () {
      // create
      let strategyAgentID = 8
      let explorerAgentID = 2
      let staticRes = await clAgentFactory.connect(user1).callStatic.createConcentratedLiquidityAgentAndExplorerAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1
      )
      expect(staticRes.strategyAgentID).eq(strategyAgentID)
      expect(staticRes.explorerAgentID).eq(explorerAgentID)
      let tx = await clAgentFactory.connect(user1).createConcentratedLiquidityAgentAndExplorerAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1
      )
      l1DataFeeAnalyzer.register("createConcentratedLiquidityAgentAndExplorerAndRefundExcess", tx);
      await watchTxForEvents(tx)
      // created a new explorer agent
      expect(await explorerAgentNft.totalSupply()).eq(explorerAgentID)
      expect(await explorerAgentNft.balanceOf(user1.address)).eq(explorerAgentID)
      let explorerTbas = await agentRegistry.getTbasOfNft(explorerAgentNft.address, explorerAgentID)
      expect(explorerTbas.length).eq(1)
      let explorerAddress = explorerTbas[0].agentAddress
      await expectDeployed(explorerAddress)
      expect(explorerAddress).eq(staticRes.explorerAddress)
      let explorerBalances = await getBalances(explorerAddress, false, "explorer agent")
      expect(explorerBalances.eth).eq(0)
      expect(explorerBalances.weth).eq(0)
      expect(explorerBalances.usdb).eq(0)
      expect(explorerBalances.genesisAgents).eq(0)
      expect(explorerBalances.strategyAgents).eq(1)
      expect(explorerBalances.explorerAgents).eq(0)
      expect(explorerBalances.bladeswapPositions).eq(0)
      // created a new agent
      expect(await strategyAgentNft.totalSupply()).eq(strategyAgentID)
      expect(await strategyAgentNft.balanceOf(user1.address)).eq(0)
      expect(await strategyAgentNft.balanceOf(explorerAddress)).eq(1)
      let strategyTbas = await agentRegistry.getTbasOfNft(strategyAgentNft.address, strategyAgentID)
      expect(strategyTbas.length).eq(1)
      let strategyAddress = strategyTbas[0].agentAddress
      await expectDeployed(strategyAddress)
      expect(strategyAddress).eq(staticRes.strategyAddress)
      let strategyBalances = await getBalances(strategyAddress, false, "strategy agent")
      expect(strategyBalances.eth).eq(0)
      expect(strategyBalances.weth).eq(0) // should not keep dust amounts
      expect(strategyBalances.usdb).eq(0)
      expect(strategyBalances.genesisAgents).eq(0)
      expect(strategyBalances.strategyAgents).eq(0)
      expect(strategyBalances.explorerAgents).eq(0)
      expect(strategyBalances.bladeswapPositions).eq(1)
      // agent has a v3 position
      let moduleContract = await ethers.getContractAt("ConcentratedLiquidityModuleE", strategyAddress) as ConcentratedLiquidityModuleE
      let moduleName = await moduleContract.moduleName()
      expect(moduleName).eq("ConcentratedLiquidityModuleE")
      let strategyType = await moduleContract.strategyType()
      expect(strategyType).eq("Concentrated Liquidity")
      let manager = await moduleContract.manager()
      expect(manager).eq(POSITION_MANAGER_ADDRESS)
      let pool = await moduleContract.pool()
      expect(pool).eq(POOL_ADDRESS)
      let tokenId = await moduleContract.tokenId()
      expect(tokenId).gt(0)
      expect(tokenId).eq(staticRes.nonfungiblePositionTokenId)
      //console.log(`tokenId ${tokenId.toString()}`)
      let state = await moduleContract.safelyGetStateOfAMM()
      //console.log(`state`, state)
      //expect().eq("")
      let position = await moduleContract.position()
      //console.log(`position`, position)
      expect(position.token0).eq(USDB_ADDRESS)
      expect(position.token1).eq(WETH_ADDRESS)
      expect(position.liquidity).gt(0)
    })
  });

  describe("farming", function () {
    let strategyAgent: any
    let tokenId: any
    let incentiveKey: any

    const sqrtPriceX96 = BN.from("1392486909633467119786647344");
    let mintParams = {
      manager: POSITION_MANAGER_ADDRESS,
      pool: POOL_ADDRESS,
      slippageLiquidity: 1_000_000,
      tickLower: -82920,
      tickUpper: -76020,
      sqrtPriceX96: sqrtPriceX96,
    }
    let deposit0 = {
      token: WETH_ADDRESS,
      amount: WeiPerEther.div(10)
    }
    let deposit1 = {
      token: USDB_ADDRESS,
      amount: WeiPerEther.mul(300)
    }

    it("the constants are set in the module", async function () {
      expect(await moduleE.weth()).eq(WETH_ADDRESS)
      expect(await moduleE.farmingCenter()).eq(FARMING_CENTER_ADDRESS)
      expect(await moduleE.eternalFarming()).eq(ETERNAL_FARMING_ADDRESS)
    })
    it("create a new agent with farming", async function () {
      // set to blade rewards
      farmParams.rewardToken = BLADE_ADDRESS

      // create
      let strategyAgentID = 9
      let explorerAgentID = 3
      let staticRes = await clAgentFactory.connect(user1).callStatic.createConcentratedLiquidityAgentAndExplorerAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1
      )
      expect(staticRes.strategyAgentID).eq(strategyAgentID)
      expect(staticRes.explorerAgentID).eq(explorerAgentID)
      let tx = await clAgentFactory.connect(user1).createConcentratedLiquidityAgentAndExplorerAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1
      )
      l1DataFeeAnalyzer.register("createConcentratedLiquidityAgentAndExplorerAndRefundExcess", tx);
      await watchTxForEvents(tx)
      // created a new explorer agent
      expect(await explorerAgentNft.totalSupply()).eq(explorerAgentID)
      expect(await explorerAgentNft.balanceOf(user1.address)).eq(explorerAgentID)
      let explorerTbas = await agentRegistry.getTbasOfNft(explorerAgentNft.address, explorerAgentID)
      expect(explorerTbas.length).eq(1)
      let explorerAddress = explorerTbas[0].agentAddress
      await expectDeployed(explorerAddress)
      expect(explorerAddress).eq(staticRes.explorerAddress)
      let explorerBalances = await getBalances(explorerAddress, false, "explorer agent")
      expect(explorerBalances.eth).eq(0)
      expect(explorerBalances.weth).eq(0)
      expect(explorerBalances.usdb).eq(0)
      expect(explorerBalances.genesisAgents).eq(0)
      expect(explorerBalances.strategyAgents).eq(1)
      expect(explorerBalances.explorerAgents).eq(0)
      expect(explorerBalances.bladeswapPositions).eq(0)
      // created a new agent
      expect(await strategyAgentNft.totalSupply()).eq(strategyAgentID)
      expect(await strategyAgentNft.balanceOf(user1.address)).eq(0)
      expect(await strategyAgentNft.balanceOf(explorerAddress)).eq(1)
      let strategyTbas = await agentRegistry.getTbasOfNft(strategyAgentNft.address, strategyAgentID)
      expect(strategyTbas.length).eq(1)
      let strategyAddress = strategyTbas[0].agentAddress
      await expectDeployed(strategyAddress)
      expect(strategyAddress).eq(staticRes.strategyAddress)
      let strategyBalances = await getBalances(strategyAddress, false, "strategy agent")
      expect(strategyBalances.eth).eq(0)
      expect(strategyBalances.weth).eq(0) // should not keep dust amounts
      expect(strategyBalances.usdb).eq(0)
      expect(strategyBalances.genesisAgents).eq(0)
      expect(strategyBalances.strategyAgents).eq(0)
      expect(strategyBalances.explorerAgents).eq(0)
      expect(strategyBalances.bladeswapPositions).eq(1)
      // agent has a v3 position
      let moduleContract = await ethers.getContractAt("ConcentratedLiquidityModuleE", strategyAddress) as ConcentratedLiquidityModuleE
      strategyAgent = moduleContract
      let moduleName = await moduleContract.moduleName()
      expect(moduleName).eq("ConcentratedLiquidityModuleE")
      let strategyType = await moduleContract.strategyType()
      expect(strategyType).eq("Concentrated Liquidity")
      let manager = await moduleContract.manager()
      expect(manager).eq(POSITION_MANAGER_ADDRESS)
      let pool = await moduleContract.pool()
      expect(pool).eq(POOL_ADDRESS)
      tokenId = await moduleContract.tokenId()
      expect(tokenId).gt(0)
      expect(tokenId).eq(staticRes.nonfungiblePositionTokenId)
      //console.log(`tokenId ${tokenId.toString()}`)
      let state = await moduleContract.safelyGetStateOfAMM()
      //console.log(`state`, state)
      //expect().eq("")
      let position = await moduleContract.position()
      //console.log(`position`, position)
      expect(position.token0).eq(USDB_ADDRESS)
      expect(position.token1).eq(WETH_ADDRESS)
      expect(position.liquidity).gt(0)

      incentiveKey = {
        rewardToken: BLADE_ADDRESS,
        bonusRewardToken: AddressZero,
        pool: POOL_ADDRESS,
        nonce: 0
      }
    })
    it("the constants can be fetched from the agent", async function () {
      expect(await strategyAgent.weth()).eq(WETH_ADDRESS)
      expect(await strategyAgent.farmingCenter()).eq(FARMING_CENTER_ADDRESS)
      expect(await strategyAgent.eternalFarming()).eq(ETERNAL_FARMING_ADDRESS)
    })
    it("the agent is farming", async function () {
      let rewardInfo1 = await farmingCenter.deposits(tokenId)
      let rewardInfo2 = await eternalFarming.callStatic.getRewardInfo(incentiveKey, tokenId)
      let rewardInfo3 = await strategyAgent.callStatic.moduleE_getRewardInfo()

      expect(rewardInfo1).eq("0x7f2d0b6bafa79d839bc1f3419b0cc0a000abf422a86cd5d745f8a1ed5ab059b0") // bytes32 hash of the key
      expect(rewardInfo2.reward).eq(0) // just deposited, no rewards yet
      expect(rewardInfo2.bonusReward).eq(0) // no bonus token
      expect(rewardInfo3.rewardToken).eq(BLADE_ADDRESS)
      expect(rewardInfo3.bonusRewardToken).eq(AddressZero) // no bonus token
      expect(rewardInfo3.nonce).eq(incentiveKey.nonce)
      expect(rewardInfo3.reward).eq(0) // just deposited, no rewards yet
      expect(rewardInfo3.bonusReward).eq(0) // no bonus token

    })
    it("can view rewards", async function () {
      // burn some blocks to earn rewards
      for(let i = 0; i < 3; i++) {
        await user1.sendTransaction({to:user1.address})
      }

      let rewardInfo1 = await farmingCenter.deposits(tokenId)
      let rewardInfo2 = await eternalFarming.callStatic.getRewardInfo(incentiveKey, tokenId)
      let rewardInfo3 = await strategyAgent.callStatic.moduleE_getRewardInfo()

      expect(rewardInfo1).eq("0x7f2d0b6bafa79d839bc1f3419b0cc0a000abf422a86cd5d745f8a1ed5ab059b0") // bytes32 hash of the key
      expect(rewardInfo2.reward).gt(0) // earned rewards
      expect(rewardInfo2.bonusReward).eq(0) // no bonus token
      expect(rewardInfo3.rewardToken).eq(BLADE_ADDRESS)
      expect(rewardInfo3.bonusRewardToken).eq(AddressZero) // no bonus token
      expect(rewardInfo3.nonce).eq(incentiveKey.nonce)
      expect(rewardInfo3.reward).gt(0) // earned rewards
      expect(rewardInfo3.bonusReward).eq(0) // no bonus token

      expect(rewardInfo2.reward).eq(rewardInfo3.reward) // same value
    })
    it("can claim rewards without withdrawing", async function () {
      let bal1 = await blade.balanceOf(user1.address);
      expect(bal1).eq(0)
      let rewardInfo0 = await strategyAgent.callStatic.moduleE_getRewardInfo()

      let tx = await strategyAgent.moduleE_claimRewardsTo(user1.address)

      let rewardInfo1 = await farmingCenter.deposits(tokenId)
      let rewardInfo2 = await eternalFarming.callStatic.getRewardInfo(incentiveKey, tokenId)
      let rewardInfo3 = await strategyAgent.callStatic.moduleE_getRewardInfo()

      expect(rewardInfo1).eq("0x7f2d0b6bafa79d839bc1f3419b0cc0a000abf422a86cd5d745f8a1ed5ab059b0") // bytes32 hash of the key
      expect(rewardInfo2.reward).eq(0) // reset
      expect(rewardInfo2.bonusReward).eq(0) // no bonus token
      expect(rewardInfo3.rewardToken).eq(BLADE_ADDRESS)
      expect(rewardInfo3.bonusRewardToken).eq(AddressZero) // no bonus token
      expect(rewardInfo3.nonce).eq(incentiveKey.nonce)
      expect(rewardInfo3.reward).eq(0)  // reset
      expect(rewardInfo3.bonusReward).eq(0) // no bonus token

      let bal2 = await blade.balanceOf(user1.address);
      expect(bal2).gte(rewardInfo0.reward) // gt for extra block
    })
    it("auto claims rewards during partialWithdrawTo", async function () {
      // burn some blocks to earn rewards
      for(let i = 0; i < 3; i++) {
        await user1.sendTransaction({to:user1.address})
      }

      let bal1 = await blade.balanceOf(user1.address);
      let rewardInfo0 = await strategyAgent.callStatic.moduleE_getRewardInfo()

      let state = await strategyAgent.safelyGetStateOfAMM()
      let position = await strategyAgent.position()
      expect(position.token0).eq(USDB_ADDRESS)
      expect(position.token1).eq(WETH_ADDRESS)
      expect(position.liquidity).gt(0)

      let tx = await strategyAgent.moduleE_partialWithdrawTo(user1.address, position.liquidity.div(4), state.sqrtPrice, 1_000_000)

      let rewardInfo1 = await farmingCenter.deposits(tokenId)
      let rewardInfo2 = await eternalFarming.callStatic.getRewardInfo(incentiveKey, tokenId)
      let rewardInfo3 = await strategyAgent.callStatic.moduleE_getRewardInfo()

      expect(rewardInfo1).eq("0x7f2d0b6bafa79d839bc1f3419b0cc0a000abf422a86cd5d745f8a1ed5ab059b0") // bytes32 hash of the key
      expect(rewardInfo2.reward).eq(0) // reset
      expect(rewardInfo2.bonusReward).eq(0) // no bonus token
      expect(rewardInfo3.rewardToken).eq(BLADE_ADDRESS)
      expect(rewardInfo3.bonusRewardToken).eq(AddressZero) // no bonus token
      expect(rewardInfo3.nonce).eq(incentiveKey.nonce)
      expect(rewardInfo3.reward).eq(0)  // reset
      expect(rewardInfo3.bonusReward).eq(0) // no bonus token

      let bal2 = await blade.balanceOf(user1.address);
      expect(bal2).gte(bal1.add(rewardInfo0.reward)) // gt for extra block
    })
    it("auto claims rewards during fullWithdrawTo", async function () {
      // burn some blocks to earn rewards
      for(let i = 0; i < 3; i++) {
        await user1.sendTransaction({to:user1.address})
      }

      let bal1 = await blade.balanceOf(user1.address);
      let rewardInfo0 = await strategyAgent.callStatic.moduleE_getRewardInfo()

      let state = await strategyAgent.safelyGetStateOfAMM()
      let position = await strategyAgent.position()

      let tx = await strategyAgent.moduleE_fullWithdrawTo(user1.address, state.sqrtPrice, 1_000_000)

      // this now fails since token burned
      await expect(eternalFarming.getRewardInfo(incentiveKey, tokenId)).to.be.reverted

      // these return zeros

      let rewardInfo1 = await farmingCenter.deposits(tokenId)
      let rewardInfo3 = await strategyAgent.callStatic.moduleE_getRewardInfo()

      expect(rewardInfo1).eq("0x0000000000000000000000000000000000000000000000000000000000000000") // no key
      expect(rewardInfo3.rewardToken).eq(AddressZero) // set to zero
      expect(rewardInfo3.bonusRewardToken).eq(AddressZero)
      expect(rewardInfo3.nonce).eq(0)
      expect(rewardInfo3.reward).eq(0)
      expect(rewardInfo3.bonusReward).eq(0)

      let bal2 = await blade.balanceOf(user1.address);
      expect(bal2).gte(bal1.add(rewardInfo0.reward)) // gt for extra block
    })
    it("create a new agent with farming", async function () {
      // create
      let strategyAgentID = 10
      let explorerAgentID = 4
      let staticRes = await clAgentFactory.connect(user1).callStatic.createConcentratedLiquidityAgentAndExplorerAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1
      )
      expect(staticRes.strategyAgentID).eq(strategyAgentID)
      expect(staticRes.explorerAgentID).eq(explorerAgentID)
      let tx = await clAgentFactory.connect(user1).createConcentratedLiquidityAgentAndExplorerAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1
      )
      l1DataFeeAnalyzer.register("createConcentratedLiquidityAgentAndExplorerAndRefundExcess", tx);
      await watchTxForEvents(tx)
      // created a new explorer agent
      expect(await explorerAgentNft.totalSupply()).eq(explorerAgentID)
      expect(await explorerAgentNft.balanceOf(user1.address)).eq(explorerAgentID)
      let explorerTbas = await agentRegistry.getTbasOfNft(explorerAgentNft.address, explorerAgentID)
      expect(explorerTbas.length).eq(1)
      let explorerAddress = explorerTbas[0].agentAddress
      await expectDeployed(explorerAddress)
      expect(explorerAddress).eq(staticRes.explorerAddress)
      let explorerBalances = await getBalances(explorerAddress, false, "explorer agent")
      expect(explorerBalances.eth).eq(0)
      expect(explorerBalances.weth).eq(0)
      expect(explorerBalances.usdb).eq(0)
      expect(explorerBalances.genesisAgents).eq(0)
      expect(explorerBalances.strategyAgents).eq(1)
      expect(explorerBalances.explorerAgents).eq(0)
      expect(explorerBalances.bladeswapPositions).eq(0)
      // created a new agent
      expect(await strategyAgentNft.totalSupply()).eq(strategyAgentID)
      expect(await strategyAgentNft.balanceOf(user1.address)).eq(0)
      expect(await strategyAgentNft.balanceOf(explorerAddress)).eq(1)
      let strategyTbas = await agentRegistry.getTbasOfNft(strategyAgentNft.address, strategyAgentID)
      expect(strategyTbas.length).eq(1)
      let strategyAddress = strategyTbas[0].agentAddress
      await expectDeployed(strategyAddress)
      expect(strategyAddress).eq(staticRes.strategyAddress)
      let strategyBalances = await getBalances(strategyAddress, false, "strategy agent")
      expect(strategyBalances.eth).eq(0)
      expect(strategyBalances.weth).eq(0) // should not keep dust amounts
      expect(strategyBalances.usdb).eq(0)
      expect(strategyBalances.genesisAgents).eq(0)
      expect(strategyBalances.strategyAgents).eq(0)
      expect(strategyBalances.explorerAgents).eq(0)
      expect(strategyBalances.bladeswapPositions).eq(1)
      // agent has a v3 position
      let moduleContract = await ethers.getContractAt("ConcentratedLiquidityModuleE", strategyAddress) as ConcentratedLiquidityModuleE
      strategyAgent = moduleContract
      let moduleName = await moduleContract.moduleName()
      expect(moduleName).eq("ConcentratedLiquidityModuleE")
      let strategyType = await moduleContract.strategyType()
      expect(strategyType).eq("Concentrated Liquidity")
      let manager = await moduleContract.manager()
      expect(manager).eq(POSITION_MANAGER_ADDRESS)
      let pool = await moduleContract.pool()
      expect(pool).eq(POOL_ADDRESS)
      tokenId = await moduleContract.tokenId()
      expect(tokenId).gt(0)
      expect(tokenId).eq(staticRes.nonfungiblePositionTokenId)
      //console.log(`tokenId ${tokenId.toString()}`)
      let state = await moduleContract.safelyGetStateOfAMM()
      //console.log(`state`, state)
      //expect().eq("")
      let position = await moduleContract.position()
      //console.log(`position`, position)
      expect(position.token0).eq(USDB_ADDRESS)
      expect(position.token1).eq(WETH_ADDRESS)
      expect(position.liquidity).gt(0)
    })
    it("the agent is farming", async function () {
      let rewardInfo1 = await farmingCenter.deposits(tokenId)
      let rewardInfo2 = await eternalFarming.callStatic.getRewardInfo(incentiveKey, tokenId)
      let rewardInfo3 = await strategyAgent.callStatic.moduleE_getRewardInfo()

      expect(rewardInfo1).eq("0x7f2d0b6bafa79d839bc1f3419b0cc0a000abf422a86cd5d745f8a1ed5ab059b0") // bytes32 hash of the key
      expect(rewardInfo2.reward).eq(0) // just deposited, no rewards yet
      expect(rewardInfo2.bonusReward).eq(0) // no bonus token
      expect(rewardInfo3.rewardToken).eq(BLADE_ADDRESS)
      expect(rewardInfo3.bonusRewardToken).eq(AddressZero) // no bonus token
      expect(rewardInfo3.nonce).eq(incentiveKey.nonce)
      expect(rewardInfo3.reward).eq(0) // just deposited, no rewards yet
      expect(rewardInfo3.bonusReward).eq(0) // no bonus token

    })
    it("can exit farming", async function () {
      // burn some blocks to earn rewards
      for(let i = 0; i < 3; i++) {
        await user1.sendTransaction({to:user1.address})
      }

      let bal1 = await blade.balanceOf(user1.address);
      let rewardInfo0 = await strategyAgent.callStatic.moduleE_getRewardInfo()

      let state = await strategyAgent.safelyGetStateOfAMM()
      let position = await strategyAgent.position()

      let tx = await strategyAgent.moduleE_exitFarming(user1.address)

      // this now fails since farm exited
      await expect(eternalFarming.getRewardInfo(incentiveKey, tokenId)).to.be.reverted

      // these return zeros

      let rewardInfo1 = await farmingCenter.deposits(tokenId)
      let rewardInfo3 = await strategyAgent.callStatic.moduleE_getRewardInfo()

      expect(rewardInfo1).eq("0x0000000000000000000000000000000000000000000000000000000000000000") // no key
      expect(rewardInfo3.rewardToken).eq(AddressZero) // set to zero
      expect(rewardInfo3.bonusRewardToken).eq(AddressZero)
      expect(rewardInfo3.nonce).eq(0)
      expect(rewardInfo3.reward).eq(0)
      expect(rewardInfo3.bonusReward).eq(0)

      let bal2 = await blade.balanceOf(user1.address);
      expect(bal2).gte(bal1.add(rewardInfo0.reward)) // gt for extra block
    })
    it("create a new agent with farming", async function () {
      // create
      let strategyAgentID = 11
      let explorerAgentID = 5
      let staticRes = await clAgentFactory.connect(user1).callStatic.createConcentratedLiquidityAgentAndExplorerAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1
      )
      expect(staticRes.strategyAgentID).eq(strategyAgentID)
      expect(staticRes.explorerAgentID).eq(explorerAgentID)
      let tx = await clAgentFactory.connect(user1).createConcentratedLiquidityAgentAndExplorerAndRefundExcess(
        mintParams, farmParams, deposit0, deposit1
      )
      l1DataFeeAnalyzer.register("createConcentratedLiquidityAgentAndExplorerAndRefundExcess", tx);
      await watchTxForEvents(tx)
      // created a new explorer agent
      expect(await explorerAgentNft.totalSupply()).eq(explorerAgentID)
      expect(await explorerAgentNft.balanceOf(user1.address)).eq(explorerAgentID)
      let explorerTbas = await agentRegistry.getTbasOfNft(explorerAgentNft.address, explorerAgentID)
      expect(explorerTbas.length).eq(1)
      let explorerAddress = explorerTbas[0].agentAddress
      await expectDeployed(explorerAddress)
      expect(explorerAddress).eq(staticRes.explorerAddress)
      let explorerBalances = await getBalances(explorerAddress, false, "explorer agent")
      expect(explorerBalances.eth).eq(0)
      expect(explorerBalances.weth).eq(0)
      expect(explorerBalances.usdb).eq(0)
      expect(explorerBalances.genesisAgents).eq(0)
      expect(explorerBalances.strategyAgents).eq(1)
      expect(explorerBalances.explorerAgents).eq(0)
      expect(explorerBalances.bladeswapPositions).eq(0)
      // created a new agent
      expect(await strategyAgentNft.totalSupply()).eq(strategyAgentID)
      expect(await strategyAgentNft.balanceOf(user1.address)).eq(0)
      expect(await strategyAgentNft.balanceOf(explorerAddress)).eq(1)
      let strategyTbas = await agentRegistry.getTbasOfNft(strategyAgentNft.address, strategyAgentID)
      expect(strategyTbas.length).eq(1)
      let strategyAddress = strategyTbas[0].agentAddress
      await expectDeployed(strategyAddress)
      expect(strategyAddress).eq(staticRes.strategyAddress)
      let strategyBalances = await getBalances(strategyAddress, false, "strategy agent")
      expect(strategyBalances.eth).eq(0)
      expect(strategyBalances.weth).eq(0) // should not keep dust amounts
      expect(strategyBalances.usdb).eq(0)
      expect(strategyBalances.genesisAgents).eq(0)
      expect(strategyBalances.strategyAgents).eq(0)
      expect(strategyBalances.explorerAgents).eq(0)
      expect(strategyBalances.bladeswapPositions).eq(1)
      // agent has a v3 position
      let moduleContract = await ethers.getContractAt("ConcentratedLiquidityModuleE", strategyAddress) as ConcentratedLiquidityModuleE
      strategyAgent = moduleContract
      let moduleName = await moduleContract.moduleName()
      expect(moduleName).eq("ConcentratedLiquidityModuleE")
      let strategyType = await moduleContract.strategyType()
      expect(strategyType).eq("Concentrated Liquidity")
      let manager = await moduleContract.manager()
      expect(manager).eq(POSITION_MANAGER_ADDRESS)
      let pool = await moduleContract.pool()
      expect(pool).eq(POOL_ADDRESS)
      tokenId = await moduleContract.tokenId()
      expect(tokenId).gt(0)
      expect(tokenId).eq(staticRes.nonfungiblePositionTokenId)
      //console.log(`tokenId ${tokenId.toString()}`)
      let state = await moduleContract.safelyGetStateOfAMM()
      //console.log(`state`, state)
      //expect().eq("")
      let position = await moduleContract.position()
      //console.log(`position`, position)
      expect(position.token0).eq(USDB_ADDRESS)
      expect(position.token1).eq(WETH_ADDRESS)
      expect(position.liquidity).gt(0)
    })
    it("stays farming across rebalance", async function () {
      // burn some blocks to earn rewards
      for(let i = 0; i < 3; i++) {
        await user1.sendTransaction({to:user1.address})
      }

      let rewardInfo1 = await farmingCenter.deposits(tokenId)
      let rewardInfo2 = await eternalFarming.callStatic.getRewardInfo(incentiveKey, tokenId)
      let rewardInfo3 = await strategyAgent.callStatic.moduleE_getRewardInfo()

      expect(rewardInfo1).eq("0x7f2d0b6bafa79d839bc1f3419b0cc0a000abf422a86cd5d745f8a1ed5ab059b0") // bytes32 hash of the key
      expect(rewardInfo2.reward).gt(0) // earned rewards
      expect(rewardInfo2.bonusReward).eq(0) // no bonus token
      expect(rewardInfo3.rewardToken).eq(BLADE_ADDRESS)
      expect(rewardInfo3.bonusRewardToken).eq(AddressZero) // no bonus token
      expect(rewardInfo3.nonce).eq(incentiveKey.nonce)
      expect(rewardInfo3.reward).gt(0) // earned rewards
      expect(rewardInfo3.bonusReward).eq(0) // no bonus token

      expect(rewardInfo2.reward).eq(rewardInfo3.reward) // same value

      const state = await bladeswapPool.safelyGetStateOfAMM()
      const tokenId1 = await strategyAgent.tokenId()

      let rebalanceParams = {
        router: SWAP_ROUTER_ADDRESS,
        slippageSwap: 1_000_000,
        slippageLiquidity: 1_000_000,
        tickLower: -83520,
        tickUpper: -75420,
        sqrtPriceX96: state.sqrtPrice,
      }

      let tx = await strategyAgent.moduleE_rebalance(rebalanceParams)
      await expect(tx).to.emit(bladeswapPool, "Swap")

      const tokenId2 = await strategyAgent.tokenId()
      expect(tokenId2).not.eq(tokenId1)

      const position2 = await strategyAgent.position()
      expect(position2.nonce).eq(0)
      expect(position2.operator).eq(AddressZero)
      expect(position2.token0).eq(USDB_ADDRESS)
      expect(position2.token1).eq(WETH_ADDRESS)
      expect(position2.tickLower).eq(rebalanceParams.tickLower)
      expect(position2.tickUpper).eq(rebalanceParams.tickUpper)
      almostEqual(BN.from(position2.liquidity), BN.from("15626207072790802686"))
      //expect(position2.feeGrowthInside0LastX128).eq(0)
      //expect(position2.feeGrowthInside1LastX128).eq(0)
      expect(position2.tokensOwed0).eq(0)
      expect(position2.tokensOwed1).eq(0)

      // Only leftover on one side
      let balances = await Promise.all([
        usdb.balanceOf(strategyAgent.address),
        weth.balanceOf(strategyAgent.address),
      ])
      almostEqual(balances[0], "9", 0.01)
      almostEqual(balances[1], "8548396759847712", 0.01)

      // agent claims blade
      let bladeBalance = await blade.balanceOf(strategyAgent.address)
      expect(bladeBalance).gte(rewardInfo2.reward)

      // burn some blocks to earn rewards
      for(let i = 0; i < 3; i++) {
        await user1.sendTransaction({to:user1.address})
      }

      let rewardInfo4 = await farmingCenter.deposits(tokenId2)
      let rewardInfo5 = await eternalFarming.callStatic.getRewardInfo(incentiveKey, tokenId2)
      let rewardInfo6 = await strategyAgent.callStatic.moduleE_getRewardInfo()

      expect(rewardInfo4).eq("0x7f2d0b6bafa79d839bc1f3419b0cc0a000abf422a86cd5d745f8a1ed5ab059b0") // bytes32 hash of the key
      expect(rewardInfo5.reward).gt(0) // earned rewards
      expect(rewardInfo5.bonusReward).eq(0) // no bonus token
      expect(rewardInfo6.rewardToken).eq(BLADE_ADDRESS)
      expect(rewardInfo6.bonusRewardToken).eq(AddressZero) // no bonus token
      expect(rewardInfo6.nonce).eq(incentiveKey.nonce)
      expect(rewardInfo6.reward).gt(0) // earned rewards
      expect(rewardInfo6.bonusReward).eq(0) // no bonus token

      expect(rewardInfo5.reward).eq(rewardInfo6.reward) // same value

    })
    it("claims withheld blade during withdraw", async function () {
      const tokenId2 = await strategyAgent.tokenId()
      let bladeBalance_a1 = await blade.balanceOf(strategyAgent.address)
      let bladeBalance_u1 = await blade.balanceOf(user1.address)
      expect(bladeBalance_a1).gt(0)
      let rewardInfo2 = await eternalFarming.callStatic.getRewardInfo(incentiveKey, tokenId2)

      let state = await strategyAgent.safelyGetStateOfAMM()
      let position = await strategyAgent.position()
      expect(position.liquidity).gt(0)

      let tx = await strategyAgent.moduleE_partialWithdrawTo(user1.address, position.liquidity.div(4), state.sqrtPrice, 1_000_000)

      let bladeBalance_a2 = await blade.balanceOf(strategyAgent.address)
      let bladeBalance_u2 = await blade.balanceOf(user1.address)
      expect(bladeBalance_a2).eq(0)
      let rewardInfo5 = await eternalFarming.callStatic.getRewardInfo(incentiveKey, tokenId2)
      expect(bladeBalance_u2).gte(bladeBalance_u1.add(bladeBalance_a1).add(rewardInfo2.reward))
    })
  })

  async function watchTxForEvents(tx:any, debug=false) {
    //console.log("tx:", tx);
    if(debug) console.log("tx:", tx.hash);
    let receipt = await tx.wait(networkSettings.confirmations);
    //let receipt = await tx.wait(0);
    //console.log(`gasUsed: ${receipt.gasUsed.toNumber().toLocaleString()}`)
    if(!receipt || !receipt.logs || receipt.logs.length == 0) {
      console.log(receipt)
      //throw new Error("events not found");
      console.log("No events found")
    }
    if(!debug) return
    /*
    console.log('logs:')
    for(let i = 0; i < receipt.logs.length; i++) {
      let log = receipt.logs[i]
      console.log(`event ${i}/${receipt.logs.length}`)
      console.log(log)
    }
    */
    // create genesis accounts
    //let agentList = receipt.logs.filter(log => log.address == ERC6551_REGISTRY_ADDRESS).map(log => BN.from(log.topics[3]).toString())
    //if(agentList.length > 0) console.log(`Created accounts for ${agentList.length} agents: ${agentList.join(', ')}`)
    console.log('logs:')
    for(let i = 0; i < receipt.logs.length; i++) {
      let log = receipt.logs[i]
      //console.log(`log ${i}/${receipt.logs.length}`)
      //console.log(log)
      let address = log.address

      if(address == genesisAgentNft.address) {
        console.log("Did something with a genesis agent")
      }
      else if(address == strategyAgentNft.address) {
        console.log("Did something with a strategy agent")
      }
      else if(address == explorerAgentNft.address) {
        console.log("Did something with an explorer agent")
      }
      else if(address == ERC6551_REGISTRY_ADDRESS) {
        console.log("Created TBA in ERC6551Registry")
      }
      else if(address == agentRegistry.address) {
        console.log("Registered TBA in AgentRegistry")
      }
      else if(address == weth.address) {
        console.log("Transferred WETH")
      }
      else if(address == usdb.address) {
        console.log("Transferred USDB")
      }
      else if(address == POSITION_MANAGER_ADDRESS) {
        console.log("Did something with a Bladeswap CL Position")
      }
      else if(address == POOL_ADDRESS) {
        console.log("Did something in the Bladeswap WETH/USDB v3 pool")
      }
      else if(address == BLAST_POINTS_ADDRESS) {
        console.log("Did something with Blast Points")
      }
      else {
        console.log(`Unknown address ${address}`)
      }
    }
  }

  async function getBalances(account:string, log=false, accountName="") {
    let res = {
      eth: await provider.getBalance(account),
      weth: await weth.balanceOf(account),
      usdb: await usdb.balanceOf(account),

      genesisAgents: await genesisAgentNft.balanceOf(account),
      strategyAgents: await strategyAgentNft.balanceOf(account),
      explorerAgents: await explorerAgentNft.balanceOf(account),

      bladeswapPositions: await algebraPositionManager.balanceOf(account),
    }
    if(log) {
      console.log(`Balances of ${accountName || account}`)
      console.log({
        eth: formatUnits(res.eth),
        weth: formatUnits(res.weth),
        usdb: formatUnits(res.usdb),
        genesisAgents: res.genesisAgents.toString(),
        strategyAgents: res.strategyAgents.toString(),
        explorerAgents: res.explorerAgents.toString(),
        bladeswapPositions: res.bladeswapPositions.toString(),
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
