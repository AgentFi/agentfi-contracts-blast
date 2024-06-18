import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();
const accounts = JSON.parse(process.env.ACCOUNTS || "{}");

const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const agentfideployer = new ethers.Wallet(accounts.agentfideployer.key, provider);

import { Agents, BlastooorAgentAccount, BlastooorAgentAccountRingProtocolC, BlastooorAgentAccountRingProtocolD, BlastooorAgentAccountThrusterA, BlastooorAgentAccountBasketA, AgentFactory01, AgentFactory02, AgentFactory03, BlastooorGenesisFactory, IBlast, ContractFactory, GasCollector, BalanceFetcher, MulticallForwarder, BlastooorGenesisAgents, BlastooorStrategyAgentAccount, BlastooorStrategyAgentAccountV2 } from "../../typechain-types";

import { delay } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/setStorage";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;

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
const DEX_BALANCER_FACTORY_ADDRESS    = "0xB52274826621B6886787eC29E4C25cd3493B4930"; // v1.0.3

const MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS  = "0x54D588243976F7fA4eaf68d77122Da4e6C811167"; // v1.0.1
const MULTIPLIOOOR_FACTORY_ADDRESS          = "0xE42ECCA759813Ceed368Ca08d8F0F6780D0c41E1"; // v1.0.3

const CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS   = "0x10C02a975a748Db5B749Dc420154dD945e2e8657"; // v1.0.2
const CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS      = "0x96E50f33079F749cb20f32C05DBb62B09620a817"; // v1.0.2

const LOOPOOOR_MODULE_D_ADDRESS                         = "0x8220512520db5D3295EA41308601FD0974405975"; // v1.0.3
const LOOPOOOR_AGENT_FACTORY_ADDRESS                    = "0xf6B6C15256de133cC722313bfFBb75280Bb2B228"; // v1.0.3

// tokens
const ETH_ADDRESS                = "0x0000000000000000000000000000000000000000";
const ALL_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000001";
const MAX_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000002";
const WETH_ADDRESS               = "0x4300000000000000000000000000000000000004";
const USDB_ADDRESS               = "0x4300000000000000000000000000000000000003";

let iblast: IBlast;

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
let strategyAccountImplV1: BlastooorStrategyAgentAccount;
let strategyAccountImplV2: BlastooorStrategyAgentAccountV2;

let dispatcher: Dispatcher;

let explorerCollection: ExplorerAgents;
let explorerAccountImpl: ExplorerAgentAccount;

let dexBalancerModuleA: DexBalancerModuleA;
let dexBalancerAgentFactory: DexBalancerAgentFactory;

let multiplierMaxxooorModuleB: MultiplierMaxxooorModuleB;
let multipliooorAgentFactory: MultipliooorAgentFactory;

let concentratedLiquidityGatewayModuleC: ConcentratedLiquidityGatewayModuleC;
let concentratedLiquidityAgentFactory: ConcentratedLiquidityAgentFactory;

let loopooorModuleD: LoopooorModuleD;
let loopooorAgentFactory: LoopooorAgentFactory;

let contractsToVerify = []

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${agentfideployer.address} as agentfideployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(81457, "blast")) throw("Only run this on Blast Mainnet or a local fork of Blast Mainnet");

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, boombotseth) as IBlast;

  //contractFactory = await ethers.getContractAt("ContractFactory", CONTRACT_FACTORY_ADDRESS, agentfideployer) as ContractFactory;
  //gasCollector = await ethers.getContractAt("GasCollector", GAS_COLLECTOR_ADDRESS, agentfideployer) as GasCollector;
  //balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, agentfideployer) as BalanceFetcher;
  //genesisCollection = await ethers.getContractAt("BlastooorGenesisAgents", GENESIS_COLLECTION_ADDRESS, agentfideployer) as BlastooorGenesisAgents;
  //genesisFactory = await ethers.getContractAt("BlastooorGenesisFactory", GENESIS_FACTORY_ADDRESS, agentfideployer) as BlastooorGenesisFactory;
  //genesisAccountImpl = await ethers.getContractAt("BlastooorGenesisAgentAccount", GENESIS_ACCOUNT_IMPL_ADDRESS, agentfideployer) as BlastooorGenesisAgentAccount;
  //genesisAccountFactory = await ethers.getContractAt("BlastooorAccountFactory", GENESIS_ACCOUNT_FACTORY_ADDRESS, agentfideployer) as BlastooorAccountFactory;
  //agentRegistry = await ethers.getContractAt("AgentRegistry", AGENT_REGISTRY_ADDRESS, agentfideployer) as AgentRegistry;
  //strategyCollection = await ethers.getContractAt("BlastooorStrategyAgents", STRATEGY_COLLECTION_ADDRESS, agentfideployer) as BlastooorStrategyAgents;
  //strategyFactory = await ethers.getContractAt("BlastooorStrategyFactory", STRATEGY_FACTORY_ADDRESS, agentfideployer) as BlastooorStrategyFactory;
  //strategyAccountImpl = await ethers.getContractAt("BlastooorStrategyAgentAccount", STRATEGY_ACCOUNT_IMPL_ADDRESS, agentfideployer) as BlastooorStrategyAgentAccount;
  //dispatcher = await ethers.getContractAt("Dispatcher", DISPATCHER_ADDRESS, agentfideployer) as Dispatcher;
  //multicallForwarder = await ethers.getContractAt("MulticallForwarder", MULTICALL_FORWARDER_ADDRESS, agentfideployer) as MulticallForwarder;
  //dexBalancerModuleA = await ethers.getContractAt("DexBalancerModuleA", DEX_BALANCER_MODULE_A_ADDRESS, agentfideployer) as DexBalancerModuleA;
  //multiplierMaxxooorModuleB = await ethers.getContractAt("MultiplierMaxxooorModuleB", MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS, agentfideployer) as MultiplierMaxxooorModuleB;
  //usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS, agentfideployer) as MockERC20;
  //explorerCollection = await ethers.getContractAt("ExplorerAgents", EXPLORER_COLLECTION_ADDRESS, agentfideployer) as ExplorerAgents;
  //explorerAccountImpl = await ethers.getContractAt("ExplorerAgentAccount", EXPLORER_ACCOUNT_IMPL_ADDRESS, agentfideployer) as ExplorerAgentAccount;

  await deployDexBalancerModuleA();
  await deployDexBalancerAgentFactory();

  await deployMultiplierMaxxooorModuleB();
  await deployMultipliooorAgentFactory();

  await deployLoopooorModuleD();
  await deployLoopooorAgentFactory();

  await verifyContracts();
  logAddresses()
}

async function deployDexBalancerModuleA() {
  if(await isDeployed(DEX_BALANCER_MODULE_A_ADDRESS)) {
    dexBalancerModuleA = await ethers.getContractAt("DexBalancerModuleA", DEX_BALANCER_MODULE_A_ADDRESS, agentfideployer) as DexBalancerModuleA;
  } else {
    console.log("Deploying DexBalancerModuleA");
    let args = [BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS];
    dexBalancerModuleA = await deployContractUsingContractFactory(agentfideployer, "DexBalancerModuleA", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as DexBalancerModuleA;
    console.log(`Deployed DexBalancerModuleA to ${dexBalancerModuleA.address}`);
    contractsToVerify.push({ address: dexBalancerModuleA.address, args, contractName: "contracts/modules/DexBalancerModuleA.sol:DexBalancerModuleA" })
    if(!!DEX_BALANCER_MODULE_A_ADDRESS && dexBalancerModuleA.address != DEX_BALANCER_MODULE_A_ADDRESS) throw new Error(`Deployed DexBalancerModuleA to ${dexBalancerModuleA.address}, expected ${DEX_BALANCER_MODULE_A_ADDRESS}`)
  }
}

async function deployDexBalancerAgentFactory() {
  if(await isDeployed(DEX_BALANCER_FACTORY_ADDRESS)) {
    dexBalancerAgentFactory = await ethers.getContractAt("DexBalancerAgentFactory", DEX_BALANCER_FACTORY_ADDRESS, agentfideployer) as DexBalancerAgentFactory;
  } else {
    console.log("Deploying DexBalancerAgentFactory");
    let args = [agentfideployer.address, BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, MULTICALL_FORWARDER_ADDRESS, GENESIS_COLLECTION_ADDRESS, STRATEGY_COLLECTION_ADDRESS, EXPLORER_COLLECTION_ADDRESS, ERC6551_REGISTRY_ADDRESS, AGENT_REGISTRY_ADDRESS, WETH_ADDRESS];
    dexBalancerAgentFactory = await deployContractUsingContractFactory(agentfideployer, "DexBalancerAgentFactory", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as DexBalancerAgentFactory;
    console.log(`Deployed DexBalancerAgentFactory to ${dexBalancerAgentFactory.address}`);
    contractsToVerify.push({ address: dexBalancerAgentFactory.address, args, contractName: "contracts/factory/DexBalancerAgentFactory.sol:DexBalancerAgentFactory" })
    if(!!DEX_BALANCER_FACTORY_ADDRESS && dexBalancerAgentFactory.address != DEX_BALANCER_FACTORY_ADDRESS) throw new Error(`Deployed DexBalancerAgentFactory to ${dexBalancerAgentFactory.address}, expected ${DEX_BALANCER_FACTORY_ADDRESS}`)
  }
}

async function deployMultiplierMaxxooorModuleB() {
  if(await isDeployed(MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS)) {
    multiplierMaxxooorModuleB = await ethers.getContractAt("MultiplierMaxxooorModuleB", MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS, agentfideployer) as MultiplierMaxxooorModuleB;
  } else {
    console.log("Deploying MultiplierMaxxooorModuleB");
    let args = [BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS];
    multiplierMaxxooorModuleB = await deployContractUsingContractFactory(agentfideployer, "MultiplierMaxxooorModuleB", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as MultiplierMaxxooorModuleB;
    console.log(`Deployed MultiplierMaxxooorModuleB to ${multiplierMaxxooorModuleB.address}`);
    contractsToVerify.push({ address: multiplierMaxxooorModuleB.address, args, contractName: "contracts/modules/MultiplierMaxxooorModuleB.sol:MultiplierMaxxooorModuleB" })
    if(!!MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS && multiplierMaxxooorModuleB.address != MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS) throw new Error(`Deployed MultiplierMaxxooorModuleB to ${multiplierMaxxooorModuleB.address}, expected ${MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS}`)
  }
}

async function deployMultipliooorAgentFactory() {
  if(await isDeployed(MULTIPLIOOOR_FACTORY_ADDRESS)) {
    multipliooorAgentFactory = await ethers.getContractAt("MultipliooorAgentFactory", MULTIPLIOOOR_FACTORY_ADDRESS, agentfideployer) as MultipliooorAgentFactory;
  } else {
    console.log("Deploying MultipliooorAgentFactory");
    let args = [agentfideployer.address, BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, MULTICALL_FORWARDER_ADDRESS, GENESIS_COLLECTION_ADDRESS, STRATEGY_COLLECTION_ADDRESS, EXPLORER_COLLECTION_ADDRESS, ERC6551_REGISTRY_ADDRESS, AGENT_REGISTRY_ADDRESS, WETH_ADDRESS];
    multipliooorAgentFactory = await deployContractUsingContractFactory(agentfideployer, "MultipliooorAgentFactory", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as MultipliooorAgentFactory;
    console.log(`Deployed MultipliooorAgentFactory to ${multipliooorAgentFactory.address}`);
    contractsToVerify.push({ address: multipliooorAgentFactory.address, args, contractName: "contracts/factory/MultipliooorAgentFactory.sol:MultipliooorAgentFactory" })
    if(!!MULTIPLIOOOR_FACTORY_ADDRESS && multipliooorAgentFactory.address != MULTIPLIOOOR_FACTORY_ADDRESS) throw new Error(`Deployed MultipliooorAgentFactory to ${multipliooorAgentFactory.address}, expected ${MULTIPLIOOOR_FACTORY_ADDRESS}`)
  }
}

async function deployLoopooorModuleD() {
  if(await isDeployed(LOOPOOOR_MODULE_D_ADDRESS)) {
    loopooorModuleD = await ethers.getContractAt("LoopooorModuleD", LOOPOOOR_MODULE_D_ADDRESS, agentfideployer) as LoopooorModuleD;
  } else {
    console.log("Deploying LoopooorModuleD");
    let args = [BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS];
    loopooorModuleD = await deployContractUsingContractFactory(agentfideployer, "LoopooorModuleD", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as LoopooorModuleD;
    console.log(`Deployed LoopooorModuleD to ${loopooorModuleD.address}`);
    contractsToVerify.push({ address: loopooorModuleD.address, args, contractName: "contracts/modules/LoopooorModuleD.sol:LoopooorModuleD" })
    if(!!LOOPOOOR_MODULE_D_ADDRESS && loopooorModuleD.address != LOOPOOOR_MODULE_D_ADDRESS) throw new Error(`Deployed LoopooorModuleD to ${loopooorModuleD.address}, expected ${LOOPOOOR_MODULE_D_ADDRESS}`)
  }
}

async function deployLoopooorAgentFactory() {
  if(await isDeployed(LOOPOOOR_AGENT_FACTORY_ADDRESS)) {
    loopooorAgentFactory = await ethers.getContractAt("LoopooorAgentFactory", LOOPOOOR_AGENT_FACTORY_ADDRESS, agentfideployer) as LoopooorAgentFactory;
  } else {
    console.log("Deploying LoopooorAgentFactory");
    let args = [agentfideployer.address, BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, MULTICALL_FORWARDER_ADDRESS, GENESIS_COLLECTION_ADDRESS, STRATEGY_COLLECTION_ADDRESS, EXPLORER_COLLECTION_ADDRESS, ERC6551_REGISTRY_ADDRESS, AGENT_REGISTRY_ADDRESS, WETH_ADDRESS];
    loopooorAgentFactory = await deployContractUsingContractFactory(agentfideployer, "LoopooorAgentFactory", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as LoopooorAgentFactory;
    console.log(`Deployed LoopooorAgentFactory to ${loopooorAgentFactory.address}`);
    contractsToVerify.push({ address: loopooorAgentFactory.address, args, contractName: "contracts/factory/LoopooorAgentFactory.sol:LoopooorAgentFactory" })
    if(!!LOOPOOOR_AGENT_FACTORY_ADDRESS && loopooorAgentFactory.address != LOOPOOOR_AGENT_FACTORY_ADDRESS) throw new Error(`Deployed LoopooorAgentFactory to ${loopooorAgentFactory.address}, expected ${LOOPOOOR_AGENT_FACTORY_ADDRESS}`)
  }
}

async function verifyContracts() {
  if(chainID == 31337) return
  if(contractsToVerify.length == 0) return
  console.log(`verifying ${contractsToVerify.length} contracts`)
  await delay(30_000); // likely just deployed a contract, let etherscan index it
  for(let i = 0; i < contractsToVerify.length; i++) {
    let { address, args, contractName } = contractsToVerify[i]
    await verifyContract(address, args, contractName);
  }
}

function logAddresses() {
  console.log("");
  console.log("| Contract Name                        | Address                                      |");
  console.log("|--------------------------------------|----------------------------------------------|");
  logContractAddress("DexBalancerModuleA", dexBalancerModuleA.address);
  logContractAddress("DexBalancerAgentFactory", dexBalancerAgentFactory.address);
  logContractAddress("MultiplierMaxxooorModuleB", multiplierMaxxooorModuleB.address);
  logContractAddress("MultipliooorAgentFactory", multipliooorAgentFactory.address);
  logContractAddress("LoopooorModuleD", loopooorModuleD.address);
  logContractAddress("LoopooorAgentFactory", loopooorAgentFactory.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
