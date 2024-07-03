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

const MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS  = "0xB52f71b3a8bB630F0F08Ca4f85EeF0d29212cEC0"; // v1.0.1

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

let dexBalancerModuleA: DexBalancerModuleA;
let multiplierMaxxooorModuleB: MultiplierMaxooorModuleB;

let explorerCollection: ExplorerAgents;
let explorerAccountImpl: ExplorerAgentAccount;
let concentratedLiquidityGatewayModuleC: ConcentratedLiquidityGatewayModuleC;
let concentratedLiquidityAgentFactory: ConcentratedLiquidityAgentFactory;

let concentratedLiquidityModuleE: ConcentratedLiquidityModuleE;
let algebraCLAgentFactory: AlgebraCLAgentFactory;

let contractsToVerify = []

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${agentfideployer.address} as agentfideployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia or a local fork of Blast Sepolia");

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

  await deployConcentratedLiquidityModuleE();
  await deployAlgebraCLAgentFactory();

  await verifyContracts();
  logAddresses()
}

async function deployConcentratedLiquidityModuleE() {
  if(await isDeployed(CONCENTRATED_LIQUIDITY_MODULE_E_ADDRESS)) {
    concentratedLiquidityModuleE = await ethers.getContractAt("ConcentratedLiquidityModuleE", CONCENTRATED_LIQUIDITY_MODULE_E_ADDRESS, agentfideployer) as ConcentratedLiquidityModuleE;
  } else {
    console.log("Deploying ConcentratedLiquidityModuleE");
    let args = [BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, WETH_ADDRESS];
    concentratedLiquidityModuleE = await deployContractUsingContractFactory(agentfideployer, "ConcentratedLiquidityModuleE", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as ConcentratedLiquidityModuleE;
    console.log(`Deployed ConcentratedLiquidityModuleE to ${concentratedLiquidityModuleE.address}`);
    contractsToVerify.push({ address: concentratedLiquidityModuleE.address, args, contractName: "contracts/modules/ConcentratedLiquidityModuleE.sol:ConcentratedLiquidityModuleE" })
    if(!!CONCENTRATED_LIQUIDITY_MODULE_E_ADDRESS && concentratedLiquidityModuleE.address != CONCENTRATED_LIQUIDITY_MODULE_E_ADDRESS) throw new Error(`Deployed ConcentratedLiquidityModuleE to ${concentratedLiquidityModuleE.address}, expected ${CONCENTRATED_LIQUIDITY_MODULE_E_ADDRESS}`)
  }
}

async function deployAlgebraCLAgentFactory() {
  if(await isDeployed(ALGEBRA_CL_AGENT_FACTORY_ADDRESS)) {
    algebraCLAgentFactory = await ethers.getContractAt("AlgebraCLAgentFactory", ALGEBRA_CL_AGENT_FACTORY_ADDRESS, agentfideployer) as AlgebraCLAgentFactory;
  } else {
    console.log("Deploying AlgebraCLAgentFactory");
    let args = [agentfideployer.address, BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, MULTICALL_FORWARDER_ADDRESS, GENESIS_COLLECTION_ADDRESS, STRATEGY_COLLECTION_ADDRESS, EXPLORER_COLLECTION_ADDRESS, ERC6551_REGISTRY_ADDRESS, AGENT_REGISTRY_ADDRESS, WETH_ADDRESS];
    algebraCLAgentFactory = await deployContractUsingContractFactory(agentfideployer, "AlgebraCLAgentFactory", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as AlgebraCLAgentFactory;
    console.log(`Deployed AlgebraCLAgentFactory to ${algebraCLAgentFactory.address}`);
    contractsToVerify.push({ address: algebraCLAgentFactory.address, args, contractName: "contracts/factory/AlgebraCLAgentFactory.sol:AlgebraCLAgentFactory" })
    if(!!ALGEBRA_CL_AGENT_FACTORY_ADDRESS && algebraCLAgentFactory.address != ALGEBRA_CL_AGENT_FACTORY_ADDRESS) throw new Error(`Deployed AlgebraCLAgentFactory to ${algebraCLAgentFactory.address}, expected ${ALGEBRA_CL_AGENT_FACTORY_ADDRESS}`)
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
  logContractAddress("ConcentratedLiquidityModuleE", concentratedLiquidityModuleE.address);
  logContractAddress("AlgebraCLAgentFactory", algebraCLAgentFactory.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
