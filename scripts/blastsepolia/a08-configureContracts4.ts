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

import { delay, deduplicateArray, readAbi, readAbiForMC } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/setStorage";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../utils/diamond"
import { moduleEFunctionParams } from "./../configuration/ConcentratedLiquidityModuleE";
import { MulticallProvider, MulticallContract } from "./../utils/multicall";
import { multicallChunked } from "./../utils/network";

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;
const { formatUnits } = ethers.utils;

let networkSettings: any;
let chainID: number;

const ABI_BALANCE_FETCHER = readAbiForMC("abi/contracts/utils/BalanceFetcher.sol/BalanceFetcher.json")
const ABI_DISPATCHER = readAbiForMC("abi/contracts/utils/Dispatcher.sol/Dispatcher.json")
const ABI_MULTICALL_FORWARDER = readAbiForMC("abi/contracts/utils/MulticallForwarder.sol/MulticallForwarder.json")
let mcProvider = new MulticallProvider(provider, 168587773);

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
const STRATEGY_ACCOUNT_IMPL_V1_ADDRESS   = "0xb64763516040409536D85451E423e444528d66ff"; // v1.0.1
const STRATEGY_ACCOUNT_IMPL_V2_ADDRESS   = "0x22ff0d4B6b634A8Fa58B415E13bafa51FC0c80B8"; // v1.0.2

const DISPATCHER_ADDRESS              = "0x1523e29DbfDb7655A8358429F127cF4ea9c601Fd"; // v1.0.1

const MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS  = "0xB52f71b3a8bB630F0F08Ca4f85EeF0d29212cEC0";

const STRATEGY_MANAGER_ROLE = "0x4170d100a3a3728ae51207936ee755ecaa64a7f6e9383c642ab204a136f90b1b";

const EXPLORER_COLLECTION_ADDRESS                       = "0x1eE50B39EB877F7053dC18816C3f7121Fc7340De"; // v1.0.2
const EXPLORER_ACCOUNT_IMPL_ADDRESS                     = "0x37edeCaaa04e3bCD652B8ac35d928d57b66b212D"; // v1.0.2
const CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS   = "0x42Bd5c64C5a6d49F4969D7Cd5Cd7e7286d5AF0fE"; // v1.0.2
const CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS      = "0x06ACC535E997bcc338927586802797A37be81A34"; // v1.0.2

const CONCENTRATED_LIQUIDITY_MODULE_E_ADDRESS           = "0x0961666fC994009221C2f5fd9eA540190490200D"; // v1.0.4
const ALGEBRA_CL_AGENT_FACTORY_ADDRESS                  = "0x2713dAB352ad8aDd85743051451E0831439E10B2"; // v1.0.4

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
let multicallForwarderMC: any;
let contractFactory: ContractFactory;
let gasCollector: GasCollector;
let balanceFetcher: BalanceFetcher;
let balanceFetcherMC: any;

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
let dispatcherMC: any;

let explorerCollection: ExplorerAgents;
let explorerAccountImpl: ExplorerAgentAccount;
let concentratedLiquidityGatewayModuleC: ConcentratedLiquidityGatewayModuleC;
let concentratedLiquidityAgentFactory: ConcentratedLiquidityAgentFactory;

let concentratedLiquidityModuleE: ConcentratedLiquidityModuleE;
let algebraCLAgentFactory: AlgebraCLAgentFactory;

let usdb: MockERC20;

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
  await expectDeployed(CONCENTRATED_LIQUIDITY_MODULE_E_ADDRESS)
  await expectDeployed(ALGEBRA_CL_AGENT_FACTORY_ADDRESS)

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, agentfideployer) as IBlast;
  iblastpoints = await ethers.getContractAt("IBlastPoints", BLAST_POINTS_ADDRESS, agentfideployer) as IBlastPoints;

  gasCollector = await ethers.getContractAt("GasCollector", GAS_COLLECTOR_ADDRESS, agentfideployer) as GasCollector;
  balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, agentfideployer) as BalanceFetcher;
  balanceFetcherMC = new MulticallContract(BALANCE_FETCHER_ADDRESS, ABI_BALANCE_FETCHER)
  dispatcher = await ethers.getContractAt("Dispatcher", DISPATCHER_ADDRESS, agentfideployer) as Dispatcher;
  dispatcherMC = new MulticallContract(DISPATCHER_ADDRESS, ABI_DISPATCHER)
  multicallForwarderMC = new MulticallContract(MULTICALL_FORWARDER_ADDRESS, ABI_MULTICALL_FORWARDER)
  genesisCollection = await ethers.getContractAt("BlastooorGenesisAgents", GENESIS_COLLECTION_ADDRESS, agentfideployer) as BlastooorGenesisAgents;
  genesisFactory = await ethers.getContractAt("BlastooorGenesisFactory", GENESIS_FACTORY_ADDRESS, agentfideployer) as BlastooorGenesisFactory;
  genesisAccountImpl = await ethers.getContractAt("BlastooorGenesisAgentAccount", GENESIS_ACCOUNT_IMPL_ADDRESS, agentfideployer) as BlastooorGenesisAgentAccount;
  genesisAccountFactory = await ethers.getContractAt("BlastooorAccountFactory", GENESIS_ACCOUNT_FACTORY_ADDRESS, agentfideployer) as BlastooorAccountFactory;
  agentRegistry = await ethers.getContractAt("AgentRegistry", AGENT_REGISTRY_ADDRESS, agentfideployer) as AgentRegistry;
  strategyCollection = await ethers.getContractAt("BlastooorStrategyAgents", STRATEGY_COLLECTION_ADDRESS, agentfideployer) as BlastooorStrategyAgents;
  strategyFactory = await ethers.getContractAt("BlastooorStrategyFactory", STRATEGY_FACTORY_ADDRESS, agentfideployer) as BlastooorStrategyFactory;
  strategyAccountImpl = await ethers.getContractAt("BlastooorStrategyAgentAccount", STRATEGY_ACCOUNT_IMPL_V1_ADDRESS, agentfideployer) as BlastooorStrategyAgentAccount;
  multicallForwarder = await ethers.getContractAt("MulticallForwarder", MULTICALL_FORWARDER_ADDRESS, agentfideployer) as MulticallForwarder;
  multiplierMaxxooorModuleB = await ethers.getContractAt("MultiplierMaxxooorModuleB", MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS, agentfideployer) as MultiplierMaxxooorModuleB;
  usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS, agentfideployer) as MockERC20;

  explorerCollection = await ethers.getContractAt("ExplorerAgents", EXPLORER_COLLECTION_ADDRESS, agentfideployer) as ExplorerAgents;
  explorerAccountImpl = await ethers.getContractAt("ExplorerAgentAccount", EXPLORER_ACCOUNT_IMPL_ADDRESS, agentfideployer) as ExplorerAgentAccount;
  concentratedLiquidityGatewayModuleC = await ethers.getContractAt("ConcentratedLiquidityGatewayModuleC", CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS, agentfideployer) as ConcentratedLiquidityGatewayModuleC;
  concentratedLiquidityAgentFactory = await ethers.getContractAt("ConcentratedLiquidityAgentFactory", CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS, agentfideployer) as ConcentratedLiquidityAgentFactory;

  concentratedLiquidityModuleE = await ethers.getContractAt("ConcentratedLiquidityModuleE", CONCENTRATED_LIQUIDITY_MODULE_E_ADDRESS, agentfideployer) as ConcentratedLiquidityModuleE;
  algebraCLAgentFactory = await ethers.getContractAt("AlgebraCLAgentFactory", ALGEBRA_CL_AGENT_FACTORY_ADDRESS, agentfideployer) as AlgebraCLAgentFactory;

  await whitelistStrategyFactories();
  await whitelistExplorerFactories();

  await agentRegistrySetOperators();

  await postConcentratedLiquidityAccountCreationSettings();
}

async function whitelistStrategyFactories() {
  let expectedSettings = [
    {
      factory: ALGEBRA_CL_AGENT_FACTORY_ADDRESS,
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
      factory: ALGEBRA_CL_AGENT_FACTORY_ADDRESS,
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

// agent registry

async function agentRegistrySetOperators() {
  console.log("Calculating AgentRegistry operators diff")
  let expectedSettings = [
    {
      account: ALGEBRA_CL_AGENT_FACTORY_ADDRESS,
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
  else {
    console.log("AgentRegistry operators already set")
  }
}

// AlgebraCLAgentFactory

async function postConcentratedLiquidityAccountCreationSettings() {
  // assemble expected settings
  let blastConfigureCalldata = strategyAccountImpl.interface.encodeFunctionData("blastConfigure()")
  let overrides = [
    {
      implementation: CONCENTRATED_LIQUIDITY_MODULE_E_ADDRESS,
      functionParams: moduleEFunctionParams
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
  let expectedSettings = {
    strategyAccountImpl: strategyAccountImpl.address,
    explorerAccountImpl: explorerAccountImpl.address,
    strategyInitializationCall: multicallCalldata,
    explorerInitializationCall: blastConfigureCalldata,
    isActive: true,
  }
  // fetch current settings
  let currentSettings = await concentratedLiquidityAgentFactory.getAgentCreationSettings()
  // compare
  let isDiff = (
    expectedSettings.strategyAccountImpl != currentSettings.strategyAccountImpl_ ||
    expectedSettings.explorerAccountImpl != currentSettings.explorerAccountImpl_ ||
    expectedSettings.strategyInitializationCall != currentSettings.strategyInitializationCall_ ||
    expectedSettings.explorerInitializationCall != currentSettings.explorerInitializationCall_ ||
    expectedSettings.isActive != currentSettings.isActive_
  )
  // only post if necessary
  if(isDiff) {
    console.log(`Calling concentratedLiquidityAgentFactory.postAgentCreationSettings()`)

    let tx = await concentratedLiquidityAgentFactory.connect(agentfideployer).postAgentCreationSettings(expectedSettings, networkSettings.overrides)
    let receipt = await tx.wait(networkSettings.confirmations)

    console.log(`Called concentratedLiquidityAgentFactory.postAgentCreationSettings()`)
  }
  else {
    //console.log(`No diff detected, skip calling concentratedLiquidityAgentFactory.postAgentCreationSettings()`)
  }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
