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
import { moduleAFunctionParams } from "./../configuration/DexBalancerModuleA";
import { moduleGFunctionParams } from "./../configuration/DexBalancerModuleG";
import { moduleDFunctionParams } from "./../configuration/LoopooorModuleD";
import { moduleFFunctionParams } from "./../configuration/LoopooorModuleF";

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;
const { formatUnits } = ethers.utils;

let networkSettings: any;
let chainID: number;

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";
const BLAST_POINTS_ADDRESS            = "0x2536FE9ab3F511540F2f9e2eC2A805005C3Dd800";
const BLAST_POINTS_OPERATOR_ADDRESS   = "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";

const ENTRY_POINT_ADDRESS             = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const MULTICALL_FORWARDER_ADDRESS     = "0xAD55F8b65d5738C6f63b54E651A09cC5d873e4d8"; // v1.0.1
const CONTRACT_FACTORY_ADDRESS        = "0x9D735e7926729cAB93b10cb5814FF8487Fb6D5e8"; // v1.0.0

const GAS_COLLECTOR_ADDRESS           = "0xf237c20584DaCA970498917470864f4d027de4ca"; // v1.0.0
const BALANCE_FETCHER_ADDRESS         = "0x3f8Dc480BEAeF711ecE5110926Ea2780a1db85C5"; // v1.0.1
const DISPATCHER_ADDRESS              = "0x59c0269f4120058bA195220ba02dd0330d92c36D"; // v1.0.1

const GENESIS_COLLECTION_ADDRESS      = "0x5066A1975BE96B777ddDf57b496397efFdDcB4A9"; // v1.0.0
const GENESIS_FACTORY_ADDRESS         = "0x700b6f8B315247DD41C42A6Cfca1dAE6B4567f3B"; // v1.0.0
const GENESIS_ACCOUNT_IMPL_ADDRESS    = "0xb9b7FFBaBEC52DFC0589f7b331E4B8Cb78E06301"; // v1.0.1
const GENESIS_ACCOUNT_FACTORY_ADDRESS = "0x101E03D71e756Da260dC5cCd19B6CdEEcbB4397F"; // v1.0.1

const AGENT_REGISTRY_ADDRESS          = "0x12F0A3453F63516815fe41c89fAe84d218Af0FAF"; // v1.0.1

const STRATEGY_COLLECTION_ADDRESS     = "0x73E75E837e4F3884ED474988c304dE8A437aCbEf"; // v1.0.1
const STRATEGY_FACTORY_ADDRESS        = "0x09906C1eaC081AC4aF24D6F7e05f7566440b4601"; // v1.0.1
const STRATEGY_ACCOUNT_IMPL_V1_ADDRESS   = "0x4b1e8C60E4a45FD64f5fBf6c497d17Ab12fba213"; // v1.0.1
const STRATEGY_ACCOUNT_IMPL_V2_ADDRESS   = "0x376Ba5cF93908D78a3d98c05C8e0B39C0207568d"; // v1.0.2

const EXPLORER_COLLECTION_ADDRESS                       = "0xFB0B3C31eAf58743603e8Ee1e122547EC053Bf18"; // v1.0.2
const EXPLORER_ACCOUNT_IMPL_ADDRESS                     = "0xC429897531D8F70093C862C81a7B3F18b6F46426"; // v1.0.2

const DEX_BALANCER_MODULE_A_ADDRESS   = "0x7e8280f5Ee5137f89d09FA61B356fa322a93415a"; // v1.0.3
const DEX_BALANCER_MODULE_G_ADDRESS   = "0x9Ff3725ad84694D066704B4130f15bC2D2dac331"; // v1.0.?
const DEX_BALANCER_FACTORY_ADDRESS    = "0xB52274826621B6886787eC29E4C25cd3493B4930"; // v1.0.3

const MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS  = "0x54D588243976F7fA4eaf68d77122Da4e6C811167"; // v1.0.1
const MULTIPLIOOOR_FACTORY_ADDRESS          = "0xE42ECCA759813Ceed368Ca08d8F0F6780D0c41E1"; // v1.0.3

const CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS   = "0x36246FF90d44fA6f171e392796d0872E138c34a7"; // v1.0.4
const CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS      = "0x5eAda3477F15A0636D1eDCa309ECcd0A6e8Ab77F"; // v1.0.4

const LOOPOOOR_MODULE_D_ADDRESS                         = "0x34fe09aF4f91AB2B37451E4680Fb528DFe12eF85"; // v1.0.3
const LOOPOOOR_AGENT_FACTORY_ADDRESS                    = "0xf6B6C15256de133cC722313bfFBb75280Bb2B228"; // v1.0.3

const LOOPOOOR_MODULE_F_ADDRESS                         = "0x4FD3e9e59F339145e157766d4d916b8C697b0A63"; // v1.0.5
const PAC_LOOPOOOR_AGENT_FACTORY_ADDRESS                = "0x423b7688Ef986835590612b6578293d2Ee895e1b"; // v1.0.5

const STRATEGY_MANAGER_ROLE = "0x4170d100a3a3728ae51207936ee755ecaa64a7f6e9383c642ab204a136f90b1b";

// tokens
const ETH_ADDRESS                = "0x0000000000000000000000000000000000000000";
const ALL_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000001";
const MAX_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000002";
const WETH_ADDRESS               = "0x4300000000000000000000000000000000000004";
const USDB_ADDRESS               = "0x4300000000000000000000000000000000000003";

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

let dispatcher: Dispatcher;

let explorerCollection: ExplorerAgents;
let explorerAccountImpl: ExplorerAgentAccount;

let dexBalancerModuleA: DexBalancerModuleA;
let dexBalancerModuleG: DexBalancerModuleG;
let dexBalancerAgentFactory: DexBalancerAgentFactory;

let multiplierMaxxooorModuleB: MultiplierMaxxooorModuleB;
let multipliooorAgentFactory: MultipliooorAgentFactory;

let concentratedLiquidityGatewayModuleC: ConcentratedLiquidityGatewayModuleC;
let concentratedLiquidityAgentFactory: ConcentratedLiquidityAgentFactory;

let loopooorModuleD: LoopooorModuleD;
let loopooorAgentFactory: LoopooorAgentFactory;

let loopooorModuleF: LoopooorModuleF;
let pacLoopooorAgentFactory: PacLoopooorAgentFactory;

let usdb: MockERC20;

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${agentfideployer.address} as agentfideployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(81457, "blast")) throw("Only run this on Blast Mainnet or a local fork of Blast Mainnet");

  await expectDeployed(ERC6551_REGISTRY_ADDRESS)
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
  await expectDeployed(STRATEGY_ACCOUNT_IMPL_V1_ADDRESS)
  await expectDeployed(STRATEGY_ACCOUNT_IMPL_V2_ADDRESS)
  await expectDeployed(DISPATCHER_ADDRESS)
  await expectDeployed(EXPLORER_COLLECTION_ADDRESS)
  await expectDeployed(EXPLORER_ACCOUNT_IMPL_ADDRESS)
  await expectDeployed(CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS)
  await expectDeployed(CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS)

  await expectDeployed(LOOPOOOR_MODULE_D_ADDRESS)
  await expectDeployed(LOOPOOOR_AGENT_FACTORY_ADDRESS)

  await expectDeployed(LOOPOOOR_MODULE_F_ADDRESS)
  await expectDeployed(PAC_LOOPOOOR_AGENT_FACTORY_ADDRESS)

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, agentfideployer) as IBlast;
  iblastpoints = await ethers.getContractAt("IBlastPoints", BLAST_POINTS_ADDRESS, agentfideployer) as IBlastPoints;

  genesisAccountFactory = await ethers.getContractAt("BlastooorAccountFactory", GENESIS_ACCOUNT_FACTORY_ADDRESS, agentfideployer) as BlastooorAccountFactory;
  agentRegistry = await ethers.getContractAt("AgentRegistry", AGENT_REGISTRY_ADDRESS, agentfideployer) as AgentRegistry;
  strategyCollection = await ethers.getContractAt("BlastooorStrategyAgents", STRATEGY_COLLECTION_ADDRESS, agentfideployer) as BlastooorStrategyAgents;
  strategyFactory = await ethers.getContractAt("BlastooorStrategyFactory", STRATEGY_FACTORY_ADDRESS, agentfideployer) as BlastooorStrategyFactory;
  strategyAccountImpl = await ethers.getContractAt("BlastooorStrategyAgentAccountV2", STRATEGY_ACCOUNT_IMPL_V2_ADDRESS, agentfideployer) as BlastooorStrategyAgentAccount;
  /*
  gasCollector = await ethers.getContractAt("GasCollector", GAS_COLLECTOR_ADDRESS, agentfideployer) as GasCollector;
  balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, agentfideployer) as BalanceFetcher;
  genesisCollection = await ethers.getContractAt("BlastooorGenesisAgents", GENESIS_COLLECTION_ADDRESS, agentfideployer) as BlastooorGenesisAgents;
  genesisFactory = await ethers.getContractAt("BlastooorGenesisFactory", GENESIS_FACTORY_ADDRESS, agentfideployer) as BlastooorGenesisFactory;
  genesisAccountImpl = await ethers.getContractAt("BlastooorGenesisAgentAccount", GENESIS_ACCOUNT_IMPL_ADDRESS, agentfideployer) as BlastooorGenesisAgentAccount;
  //strategyAccountImplV1 = await ethers.getContractAt("BlastooorStrategyAgentAccount", STRATEGY_ACCOUNT_IMPL_V1_ADDRESS, agentfideployer) as BlastooorStrategyAgentAccount;
  //strategyAccountImplV2 = await ethers.getContractAt("BlastooorStrategyAgentAccount", STRATEGY_ACCOUNT_IMPL_V2_ADDRESS, agentfideployer) as BlastooorStrategyAgentAccount;
  dispatcher = await ethers.getContractAt("Dispatcher", DISPATCHER_ADDRESS, agentfideployer) as Dispatcher;
  multicallForwarder = await ethers.getContractAt("MulticallForwarder", MULTICALL_FORWARDER_ADDRESS, agentfideployer) as MulticallForwarder;
  multiplierMaxxooorModuleB = await ethers.getContractAt("MultiplierMaxxooorModuleB", MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS, agentfideployer) as MultiplierMaxxooorModuleB;
  usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS, agentfideployer) as MockERC20;
  */

  explorerCollection = await ethers.getContractAt("ExplorerAgents", EXPLORER_COLLECTION_ADDRESS, agentfideployer) as ExplorerAgents;
  explorerAccountImpl = await ethers.getContractAt("ExplorerAgentAccount", EXPLORER_ACCOUNT_IMPL_ADDRESS, agentfideployer) as ExplorerAgentAccount;

  dexBalancerModuleA = await ethers.getContractAt("DexBalancerModuleA", DEX_BALANCER_MODULE_A_ADDRESS, agentfideployer) as DexBalancerModuleA;
  dexBalancerModuleG = await ethers.getContractAt("DexBalancerModuleG", DEX_BALANCER_MODULE_A_ADDRESS, agentfideployer) as DexBalancerModuleG;
  dexBalancerAgentFactory = await ethers.getContractAt("DexBalancerAgentFactory", DEX_BALANCER_FACTORY_ADDRESS, agentfideployer) as DexBalancerAgentFactory;

  multiplierMaxxooorModuleB = await ethers.getContractAt("MultiplierMaxxooorModuleB", MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS, agentfideployer) as MultiplierMaxxooorModuleB;
  multipliooorAgentFactory = await ethers.getContractAt("MultipliooorAgentFactory", MULTIPLIOOOR_FACTORY_ADDRESS, agentfideployer) as MultipliooorAgentFactory;

  concentratedLiquidityGatewayModuleC = await ethers.getContractAt("ConcentratedLiquidityGatewayModuleC", CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS, agentfideployer) as ConcentratedLiquidityGatewayModuleC;
  concentratedLiquidityAgentFactory = await ethers.getContractAt("ConcentratedLiquidityAgentFactory", CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS, agentfideployer) as ConcentratedLiquidityAgentFactory;

  loopooorModuleD = await ethers.getContractAt("LoopooorModuleD", LOOPOOOR_MODULE_D_ADDRESS, agentfideployer) as LoopooorModuleD;
  loopooorAgentFactory = await ethers.getContractAt("LoopooorAgentFactory", LOOPOOOR_AGENT_FACTORY_ADDRESS, agentfideployer) as LoopooorAgentFactory;

  loopooorModuleF = await ethers.getContractAt("LoopooorModuleF", LOOPOOOR_MODULE_F_ADDRESS, agentfideployer) as LoopooorModuleF;
  pacLoopooorAgentFactory = await ethers.getContractAt("PacLoopooorAgentFactory", PAC_LOOPOOOR_AGENT_FACTORY_ADDRESS, agentfideployer) as PacLoopooorAgentFactory;

  await whitelistStrategyFactories();
  await whitelistExplorerFactories();

  await agentRegistrySetOperators();

  await postDexBalancerAccountCreationSettings();
  await postMultipliooorAccountCreationSettings();
  await postOrbitLoopooorAccountCreationSettings();
  await postPacLoopooorAccountCreationSettings();
}

async function whitelistStrategyFactories() {
  let expectedSettings = [
    {
      factory: DEX_BALANCER_FACTORY_ADDRESS,
      shouldWhitelist: true,
    },
    {
      factory: MULTIPLIOOOR_FACTORY_ADDRESS,
      shouldWhitelist: true,
    },
    {
      factory: CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS,
      shouldWhitelist: true,
    },
    {
      factory: LOOPOOOR_AGENT_FACTORY_ADDRESS,
      shouldWhitelist: true,
    },
    {
      factory: PAC_LOOPOOOR_AGENT_FACTORY_ADDRESS,
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
      factory: DEX_BALANCER_FACTORY_ADDRESS,
      shouldWhitelist: true,
    },
    {
      factory: MULTIPLIOOOR_FACTORY_ADDRESS,
      shouldWhitelist: true,
    },
    {
      factory: CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS,
      shouldWhitelist: true,
    },
    {
      factory: LOOPOOOR_AGENT_FACTORY_ADDRESS,
      shouldWhitelist: true,
    },
    {
      factory: PAC_LOOPOOOR_AGENT_FACTORY_ADDRESS,
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
      account: dexBalancerAgentFactory.address,
      isAuthorized: true,
    },
    {
      account: multipliooorAgentFactory.address,
      isAuthorized: true,
    },
    {
      account: concentratedLiquidityAgentFactory.address,
      isAuthorized: true,
    },
    {
      account: loopooorAgentFactory.address,
      isAuthorized: true,
    },
    {
      account: pacLoopooorAgentFactory.address,
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

// dexBalancerAgentFactory

async function postDexBalancerAccountCreationSettings() {
  // assemble expected settings
  let blastConfigureCalldata = strategyAccountImpl.interface.encodeFunctionData("blastConfigure()")
  let overrides = [
    {
      implementation: DEX_BALANCER_MODULE_A_ADDRESS,
      functionParams: moduleAFunctionParams
    },
    {
      implementation: DEX_BALANCER_MODULE_G_ADDRESS,
      functionParams: moduleGFunctionParams
    },
  ]
  let setOverridesCalldata = strategyAccountImpl.interface.encodeFunctionData("setOverrides", [overrides])
  let txdatas = [blastConfigureCalldata, setOverridesCalldata]
  let multicallCalldata = strategyAccountImpl.interface.encodeFunctionData("multicall", [txdatas])
  let expectedSettings = {
    strategyAccountImpl: strategyAccountImpl.address,
    explorerAccountImpl: explorerAccountImpl.address,
    strategyInitializationCall: multicallCalldata,
    explorerInitializationCall: blastConfigureCalldata,
    isActive: true,
  }
  // fetch current settings
  let currentSettings = await dexBalancerAgentFactory.getAgentCreationSettings()
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
    console.log(`Calling dexBalancerAgentFactory.postAgentCreationSettings()`)

    let tx = await dexBalancerAgentFactory.connect(agentfideployer).postAgentCreationSettings(expectedSettings, networkSettings.overrides)
    let receipt = await tx.wait(networkSettings.confirmations)

    console.log(`Called dexBalancerAgentFactory.postAgentCreationSettings()`)
  }
  else {
    //console.log(`No diff detected, skip calling dexBalancerAgentFactory.postAgentCreationSettings()`)
  }
}

// multipliooorAgentFactory

async function postMultipliooorAccountCreationSettings() {
  // assemble expected settings
  /*
  let blastConfigureCalldata = strategyAccountImpl.interface.encodeFunctionData("blastConfigure()")
  let functionParamsB = [
    { selector: "0x82ccd330", requiredRole: "0x0000000000000000000000000000000000000000000000000000000000000000" }, // strategyType()
  ]
  let functionParamsA = [
    { selector: "0xd36bfc2e", requiredRole: "0x0000000000000000000000000000000000000000000000000000000000000001" }, // moduleA_withdrawBalance()
    { selector: "0xc4fb5289", requiredRole: "0x0000000000000000000000000000000000000000000000000000000000000001" }, // moduleA_withdrawBalanceTo(address)
  ]

  let overrides = [
    {
      implementation: MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS,
      functionParams: functionParamsB
    },
    {
      implementation: DEX_BALANCER_MODULE_A_ADDRESS,
      functionParams: functionParamsA
    },
  ]
  let roles = [
    {
      role: STRATEGY_MANAGER_ROLE,
      account: DISPATCHER_ADDRESS,
      grantAccess: true,
    },
  ]
  let setOverridesCalldata = strategyAccountImpl.interface.encodeFunctionData("setOverrides", [overrides])
  let setRolesCalldata = strategyAccountImpl.interface.encodeFunctionData("setRoles", [roles])
  let txdatas = [blastConfigureCalldata, setOverridesCalldata, setRolesCalldata]
  let multicallCalldata = strategyAccountImpl.interface.encodeFunctionData("multicall", [txdatas])
  */
  let expectedSettings = {
    strategyAccountImpl: strategyAccountImpl.address,
    explorerAccountImpl: explorerAccountImpl.address,
    //strategyInitializationCall: multicallCalldata,
    //explorerInitializationCall: blastConfigureCalldata,
    //isActive: true,
    strategyInitializationCall: "0x",
    explorerInitializationCall: "0x",
    isActive: false,
  }
  // fetch current settings
  let currentSettings = await multipliooorAgentFactory.getAgentCreationSettings()
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
    console.log(`Calling multipliooorAgentFactory.postAgentCreationSettings()`)

    let tx = await multipliooorAgentFactory.connect(agentfideployer).postAgentCreationSettings(expectedSettings, networkSettings.overrides)
    let receipt = await tx.wait(networkSettings.confirmations)

    console.log(`Called multipliooorAgentFactory.postAgentCreationSettings()`)
  }
  else {
    //console.log(`No diff detected, skip calling multipliooorAgentFactory.postAgentCreationSettings()`)
  }
}

// orbit loopooorAgentFactory

async function postOrbitLoopooorAccountCreationSettings() {
  // assemble expected settings
  let blastConfigureCalldata = strategyAccountImpl.interface.encodeFunctionData("blastConfigure()")
  let overrides = [
    {
      implementation: LOOPOOOR_MODULE_D_ADDRESS,
      functionParams: moduleDFunctionParams
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
  let currentSettings = await loopooorAgentFactory.getAgentCreationSettings()
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
    console.log(`Calling loopooorAgentFactory.postAgentCreationSettings()`)

    let tx = await loopooorAgentFactory.connect(agentfideployer).postAgentCreationSettings(expectedSettings, networkSettings.overrides)
    let receipt = await tx.wait(networkSettings.confirmations)

    console.log(`Called loopooorAgentFactory.postAgentCreationSettings()`)
  }
  else {
    //console.log(`No diff detected, skip calling loopooorAgentFactory.postAgentCreationSettings()`)
  }
}

// PacLoopooorAgentFactory

async function postPacLoopooorAccountCreationSettings() {
  // assemble expected settings
  let blastConfigureCalldata = strategyAccountImpl.interface.encodeFunctionData("blastConfigure()")
  let overrides = [
    {
      implementation: LOOPOOOR_MODULE_F_ADDRESS,
      functionParams: moduleFFunctionParams
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
  let currentSettings = await pacLoopooorAgentFactory.getAgentCreationSettings()
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
    console.log(`Calling pacLoopooorAgentFactory.postAgentCreationSettings()`)

    let tx = await pacLoopooorAgentFactory.connect(agentfideployer).postAgentCreationSettings(expectedSettings, networkSettings.overrides)
    let receipt = await tx.wait(networkSettings.confirmations)

    console.log(`Called pacLoopooorAgentFactory.postAgentCreationSettings()`)
  }
  else {
    //console.log(`No diff detected, skip calling pacLoopooorAgentFactory.postAgentCreationSettings()`)
  }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
