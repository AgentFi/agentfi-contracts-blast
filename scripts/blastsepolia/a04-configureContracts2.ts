import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const agentfideployer = new ethers.Wallet(accounts.agentfideployer.key, provider);
const blasttestnetuser1 = new ethers.Wallet(accounts.blasttestnetuser1.key, provider);
const allowlistSignerKey = accounts.allowlistSigner.key
const allowlistSignerAddress = accounts.allowlistSigner.address

import { Agents, BlastooorAgentAccount, AgentFactory01, AgentFactory02, AgentFactory03, IBlast, ContractFactory, GasCollector, BalanceFetcher, BlastooorStrategyAgents, BlastooorStrategyFactory, BlastooorStrategyAgentAccount, Dispatcher, IBlastPoints } from "../../typechain-types";

import { delay, deduplicateArray } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/setStorage";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;
const { formatUnits } = ethers.utils;

let networkSettings: any;
let chainID: number;

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";
const BLAST_POINTS_ADDRESS            = "0x2fc95838c71e76ec69ff817983BFf17c710F34E0";
const BLAST_POINTS_OPERATOR_ADDRESS   = "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";

const ENTRY_POINT_ADDRESS             = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const MULTICALL_FORWARDER_ADDRESS     = "0x91074d0AB2e5E4b61c4ff03A40E6491103bEB14a"; // v1.0.1
const CONTRACT_FACTORY_ADDRESS        = "0x9D735e7926729cAB93b10cb5814FF8487Fb6D5e8"; // v1.0.0

const GAS_COLLECTOR_ADDRESS           = "0xf237c20584DaCA970498917470864f4d027de4ca"; // v1.0.0
const BALANCE_FETCHER_ADDRESS         = "0x68b1a5d10FeCD6246299913a553CBb99Ac88913E"; // v1.0.1

const GENESIS_COLLECTION_ADDRESS      = "0x5066A1975BE96B777ddDf57b496397efFdDcB4A9"; // v1.0.0
const GENESIS_FACTORY_ADDRESS         = "0x700b6f8B315247DD41C42A6Cfca1dAE6B4567f3B"; // v1.0.0
const GENESIS_ACCOUNT_IMPL_ADDRESS    = "0x9DE8d1AfA3eF64AcC41Cd84533EE09A0Cd87fefF"; // v1.0.1
const GENESIS_ACCOUNT_FACTORY_ADDRESS = "0xed545485E59C4Dec4156340871CEA8242674b6a2"; // v1.0.1

const AGENT_REGISTRY_ADDRESS          = "0x40473B0D0cDa8DF6F73bFa0b5D35c2f701eCfe23"; // v1.0.1

const STRATEGY_COLLECTION_ADDRESS     = "0xD6eC1A987A276c266D17eF8673BA4F05055991C7"; // v1.0.1
const STRATEGY_FACTORY_ADDRESS        = "0x9578850dEeC9223Ba1F05aae1c998DD819c7520B"; // v1.0.1
const STRATEGY_ACCOUNT_IMPL_ADDRESS   = "0xb64763516040409536D85451E423e444528d66ff"; // v1.0.1

const DISPATCHER_ADDRESS              = "0x1523e29DbfDb7655A8358429F127cF4ea9c601Fd"; // v1.0.1

const MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS  = "0xB52f71b3a8bB630F0F08Ca4f85EeF0d29212cEC0";

const STRATEGY_MANAGER_ROLE = "0x4170d100a3a3728ae51207936ee755ecaa64a7f6e9383c642ab204a136f90b1b";

const EXPLORER_COLLECTION_ADDRESS                       = "0x1eE50B39EB877F7053dC18816C3f7121Fc7340De"; // v1.0.2
const EXPLORER_ACCOUNT_IMPL_ADDRESS                     = "0x37edeCaaa04e3bCD652B8ac35d928d57b66b212D"; // v1.0.2
const CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS   = "0x93b5c2C6a5c8e7E51e0145979f37799d7040d545"; // v1.0.2
const CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS      = "0xa8A3da313094C8DA378A81B5922a04049bDaAf79"; // v1.0.2

// tokens
const ETH_ADDRESS                = "0x0000000000000000000000000000000000000000";
const ALL_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000001";
const MAX_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000002";
const WETH_ADDRESS               = "0x4200000000000000000000000000000000000023";
const USDB_ADDRESS               = "0x4200000000000000000000000000000000000022";

// ring protocol
const UNIVERSAL_ROUTER_ADDRESS   = "0x334e3F7f5A9740627fA47Fa9Aa51cE0ccbD765cF";
const FEW_ROUTER_ADDRESS         = "0x02F1e7A518e3E286C8E305E39cA7D4f25e0a44Aa";
const STAKING_REWARDS_ADDRESS    = "0x366Ac78214aFE145Ca35d4A6513F4eD9e8909Fe8";
const USDC_ADDRESS               = "0xF19A5b56b419170Aa2ee49E5c9195F5902D39BF1";
const USDT_ADDRESS               = "0xD8F542D710346DF26F28D6502A48F49fB2cFD19B";
const DAI_ADDRESS                = "0x9C6Fc5bF860A4a012C9De812002dB304AD04F581";
const BOLT_ADDRESS               = "0x1B0cC80F4E2A7d205518A1Bf36de5bED686662FE";
const RGB_ADDRESS                = "0x7647a41596c1Ca0127BaCaa25205b310A0436B4C";

const FWWETH_ADDRESS             = "0x798dE0520497E28E8eBfF0DF1d791c2E942eA881";
const FWUSDC_ADDRESS             = "0xa7870cf9143084ED04f4C2311f48CB24a2b4A097";
const LP_TOKEN_ADDRESS           = "0x024Dd95113137f04E715B2fC8F637FBe678e9512";
const RING_ADDRESS               = "0x0BD5539E33a1236bA69228271e60f3bFf8fDB7DB";
const STAKING_REWARDS_INDEX      = 2;

let iblast: IBlast;
let iblastpoints: IBlastPoints;

let multicallForwarder: MulticallForwarder;
let contractFactory: ContractFactory;
let gasCollector: GasCollector;
let balanceFetcher: BalanceFetcher;

let genesisCollection: BlastooorGenesisAgents;
let genesisFactory: BlastooorGenesisFactory;
let genesisAccountImpl: BlastooorGenesisAgentAccount;
let genesisAccountFactory: BlastooorAccountFactory;

let agentRegistry: AgentRegistry;

let strategyCollection: BlastooorStrategyAgents;
let strategyFactory: BlastooorStrategyFactory;
let strategyAccountImpl: BlastooorStrategyAgentAccount;

let multiplierMaxxooorModuleB: MultiplierMaxooorModuleB;

let dispatcher: Dispatcher;

let explorerCollection: ExplorerAgents;
let explorerAccountImpl: ExplorerAgentAccount;
let concentratedLiquidityGatewayModuleC: ConcentratedLiquidityGatewayModuleC;
let concentratedLiquidityAgentFactory: ConcentratedLiquidityAgentFactory;

let usdb: MockERC20;

const functionParams = [
  {
    selector: "0x481c6a75",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    selector: "0x93f0899a",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    selector: "0x16f0115b",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    selector: "0x09218e91",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    selector: "0x3850c7bd",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    selector: "0x82ccd330",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    selector: "0x17d70f7c",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    selector: "0x7004cd10",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000009",
  },
  {
    selector: "0x23a1c099",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000009",
  },
  {
    selector: "0x76223cbe",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000009",
  },
  {
    selector: "0x089b0539",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000009",
  },
  {
    selector: "0x91b8dcf4",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000009",
  },
  {
    selector: "0xe0ad98b9",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000009",
  },
  {
    selector: "0x18ac4325",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000009",
  },
  {
    selector: "0xdc307439",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000009",
  },
  {
    selector: "0x52d1c175",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000009",
  },
  {
    selector: "0xbdb7336b",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000009",
  },
  {
    selector: "0xaeb0ea21",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000009",
  },
  {
    selector: "0x4921fc42",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000009",
  },
  {
    selector: "0x66f0beb2",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000009",
  },
  {
    selector: "0x9a569684",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000009",
  },
  {
    selector: "0x13bf4fdb",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000001",
  },
  {
    selector: "0x6807b478",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000001",
  },
  {
    selector: "0x96cbb0db",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000001",
  },
  {
    selector: "0x7e551aee",
    requiredRole:
      "0x0000000000000000000000000000000000000000000000000000000000000001",
  },
];

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${agentfideployer.address} as agentfideployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia or a local fork of Blast Sepolia");
  //await expectDeployed(ERC6551_REGISTRY_ADDRESS)
  /*
  await expectDeployed(ENTRY_POINT_ADDRESS)
  await expectDeployed(MULTICALL_FORWARDER_ADDRESS)
  await expectDeployed(CONTRACT_FACTORY_ADDRESS)
  await expectDeployed(GAS_COLLECTOR_ADDRESS)
  await expectDeployed(BALANCE_FETCHER_ADDRESS)
  await expectDeployed(GENESIS_COLLECTION_ADDRESS)
  await expectDeployed(GENESIS_FACTORY_ADDRESS)
  await expectDeployed(GENESIS_ACCOUNT_IMPL_ADDRESS)
  await expectDeployed(GENESIS_ACCOUNT_FACTORY_ADDRESS)
  await expectDeployed(AGENT_REGISTRY_ADDRESS)
  await expectDeployed(STRATEGY_COLLECTION_ADDRESS)
  await expectDeployed(STRATEGY_FACTORY_ADDRESS)
  await expectDeployed(STRATEGY_ACCOUNT_IMPL_ADDRESS)
  await expectDeployed(DISPATCHER_ADDRESS)
  */
  await expectDeployed(EXPLORER_COLLECTION_ADDRESS)
  await expectDeployed(EXPLORER_ACCOUNT_IMPL_ADDRESS)
  await expectDeployed(CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS)
  await expectDeployed(CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS)

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, agentfideployer) as IBlast;
  iblastpoints = await ethers.getContractAt("IBlastPoints", BLAST_POINTS_ADDRESS, agentfideployer) as IBlastPoints;

  gasCollector = await ethers.getContractAt("GasCollector", GAS_COLLECTOR_ADDRESS, agentfideployer) as GasCollector;
  balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, agentfideployer) as BalanceFetcher;
  genesisCollection = await ethers.getContractAt("BlastooorGenesisAgents", GENESIS_COLLECTION_ADDRESS, agentfideployer) as BlastooorGenesisAgents;
  genesisFactory = await ethers.getContractAt("BlastooorGenesisFactory", GENESIS_FACTORY_ADDRESS, agentfideployer) as BlastooorGenesisFactory;
  genesisAccountImpl = await ethers.getContractAt("BlastooorGenesisAgentAccount", GENESIS_ACCOUNT_IMPL_ADDRESS, agentfideployer) as BlastooorGenesisAgentAccount;
  genesisAccountFactory = await ethers.getContractAt("BlastooorAccountFactory", GENESIS_ACCOUNT_FACTORY_ADDRESS, agentfideployer) as BlastooorAccountFactory;
  agentRegistry = await ethers.getContractAt("AgentRegistry", AGENT_REGISTRY_ADDRESS, agentfideployer) as AgentRegistry;
  strategyCollection = await ethers.getContractAt("BlastooorStrategyAgents", STRATEGY_COLLECTION_ADDRESS, agentfideployer) as BlastooorStrategyAgents;
  strategyFactory = await ethers.getContractAt("BlastooorStrategyFactory", STRATEGY_FACTORY_ADDRESS, agentfideployer) as BlastooorStrategyFactory;
  strategyAccountImpl = await ethers.getContractAt("BlastooorStrategyAgentAccount", STRATEGY_ACCOUNT_IMPL_ADDRESS, agentfideployer) as BlastooorStrategyAgentAccount;
  dispatcher = await ethers.getContractAt("Dispatcher", DISPATCHER_ADDRESS, agentfideployer) as Dispatcher;
  multicallForwarder = await ethers.getContractAt("MulticallForwarder", MULTICALL_FORWARDER_ADDRESS, agentfideployer) as MulticallForwarder;
  multiplierMaxxooorModuleB = await ethers.getContractAt("MultiplierMaxxooorModuleB", MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS, agentfideployer) as MultiplierMaxxooorModuleB;
  usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS, agentfideployer) as MockERC20;

  explorerCollection = await ethers.getContractAt("ExplorerAgents", EXPLORER_COLLECTION_ADDRESS, agentfideployer) as ExplorerAgents;
  explorerAccountImpl = await ethers.getContractAt("ExplorerAgentAccount", EXPLORER_ACCOUNT_IMPL_ADDRESS, agentfideployer) as ExplorerAgentAccount;
  concentratedLiquidityGatewayModuleC = await ethers.getContractAt("ConcentratedLiquidityGatewayModuleC", CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS, agentfideployer) as ConcentratedLiquidityGatewayModuleC;
  concentratedLiquidityAgentFactory = await ethers.getContractAt("ConcentratedLiquidityAgentFactory", CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS, agentfideployer) as ConcentratedLiquidityAgentFactory;


  await whitelistStrategyFactories();
  await whitelistExplorerFactories();
  await setExplorerNftMetadata();

  await agentRegistrySetOperators();

  await postConcentratedLiquidityAccountCreationSettings();
}

async function whitelistStrategyFactories() {
  let expectedSettings = [
    {
      factory: CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS,
      shouldWhitelist: true,
    },
  ]
  let diffs = [] as any[]
  for(let i = 0; i < expectedSettings.length; i++) {
    let { factory , shouldWhitelist } = expectedSettings[i]
    let isWhitelisted = await strategyCollection.connect(agentfideployer).factoryIsWhitelisted(factory)
    if(isWhitelisted != shouldWhitelist) diffs.push(expectedSettings[i])
  }
  if(diffs.length > 0) {
    console.log("Whitelisting strategy factories")
    let tx = await strategyCollection.connect(agentfideployer).setWhitelist(diffs, networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log("Whitelisted strategy factories")
  }
}

async function whitelistExplorerFactories() {
  let expectedSettings = [
    {
      factory: CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS,
      shouldWhitelist: true,
    },
  ]
  let diffs = [] as any[]
  for(let i = 0; i < expectedSettings.length; i++) {
    let { factory , shouldWhitelist } = expectedSettings[i]
    let isWhitelisted = await explorerCollection.connect(agentfideployer).factoryIsWhitelisted(factory)
    if(isWhitelisted != shouldWhitelist) diffs.push(expectedSettings[i])
  }
  if(diffs.length > 0) {
    console.log("Whitelisting explorer factories")
    let tx = await explorerCollection.connect(agentfideployer).setWhitelist(diffs, networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log("Whitelisted explorer factories")
  }
}

async function setExplorerNftMetadata() {
  let txdatas = [] as any[]
  let desiredContractURI = "https://stats-cdn.agentfi.io/contractURI-explorers.json"
  let desiredBaseURI = "https://stats.agentfi.io/agents/metadata/?chainID=168587773&collection=explorers&agentID="
  let currentContractURI = await explorerCollection.contractURI()
  let currentBaseURI = await explorerCollection.baseURI()
  if(currentContractURI != desiredContractURI) {
    txdatas.push(explorerCollection.interface.encodeFunctionData("setContractURI", [desiredContractURI]))
  }
  if(currentBaseURI != desiredBaseURI) {
    txdatas.push(explorerCollection.interface.encodeFunctionData("setBaseURI", [desiredBaseURI]))
  }
  if(txdatas.length == 0) return
  var tx
  console.log("Setting Explorer NFT metadata");
  if(txdatas.length == 1) {
    tx = await agentfideployer.sendTransaction({
      to: explorerCollection.address,
      data: txdatas[0],
      ...networkSettings.overrides,
      gasLimit: 1_000_000
    })
  } else { // length > 1
    tx = await explorerCollection.connect(agentfideployer).multicall(txdatas, {...networkSettings.overrides, gasLimit: 1_000_000});
  }
  //console.log("tx:", tx);
  await tx.wait(networkSettings.confirmations);
  console.log("Set Explorer NFT metadata");
}

// agent registry

async function agentRegistrySetOperators() {
  let expectedSettings = [
    {
      account: genesisAccountFactory.address,
      isAuthorized: true,
    },
    {
      account: strategyFactory.address,
      isAuthorized: true,
    },
    {
      account: concentratedLiquidityAgentFactory.address,
      isAuthorized: true,
    },
  ]
  let diffs = [] as any[]
  for(let i = 0; i < expectedSettings.length; i++) {
    let { account , isAuthorized } = expectedSettings[i]
    let isOperator = await agentRegistry.connect(agentfideployer).isOperator(account)
    if(isOperator != isAuthorized) diffs.push(expectedSettings[i])
  }
  if(diffs.length > 0) {
    console.log("AgentRegistry setting operators")
    let tx = await agentRegistry.connect(agentfideployer).setOperators(diffs, networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log("AgentRegistry set operators")
  }
}

// concentratedLiquidityAgentFactory

async function postConcentratedLiquidityAccountCreationSettings() {
  console.log(`Calling concentratedLiquidityAgentFactory.postAgentCreationSettings()`)

  let blastConfigureCalldata = strategyAccountImpl.interface.encodeFunctionData("blastConfigure()")
  let overrides = [
    {
      implementation: CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS,
      functionParams: functionParams
    }
  ]
  let roles = [
    {
      role: toBytes32(9),
      account: DISPATCHER_ADDRESS,
      grantAccess: true,
    },
  ]
  let setOverridesCalldata = strategyAccountImpl.interface.encodeFunctionData("setOverrides", [overrides])
  let setRolesCalldata = strategyAccountImpl.interface.encodeFunctionData("setRoles", [roles])
  let txdatas = [blastConfigureCalldata, setOverridesCalldata, setRolesCalldata]
  let multicallCalldata = strategyAccountImpl.interface.encodeFunctionData("multicall", [txdatas])

  let settings1 = {
    strategyAccountImpl: strategyAccountImpl.address,
    explorerAccountImpl: explorerAccountImpl.address,
    strategyInitializationCall: multicallCalldata,
    explorerInitializationCall: blastConfigureCalldata,
    isActive: true,
  }
  let tx = await concentratedLiquidityAgentFactory.connect(agentfideployer).postAgentCreationSettings(settings1, networkSettings.overrides)
  let receipt = await tx.wait(networkSettings.confirmations)

  console.log(`Called concentratedLiquidityAgentFactory.postAgentCreationSettings()`)
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
