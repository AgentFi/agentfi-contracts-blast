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

const DEX_BALANCER_MODULE_A_ADDRESS   = "0x35a4B9B95bc1D93Bf8e3CA9c030fc15726b83E6F"; // v1.0.1
const MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS  = "0x54D588243976F7fA4eaf68d77122Da4e6C811167";

const EXPLORER_COLLECTION_ADDRESS                       = "0xFB0B3C31eAf58743603e8Ee1e122547EC053Bf18"; // v1.0.2
const EXPLORER_ACCOUNT_IMPL_ADDRESS                     = "0xC429897531D8F70093C862C81a7B3F18b6F46426"; // v1.0.2
const CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS   = "0xa11D4dcD5a9ad75c609E1786cf1FD88b53C83A5E"; // v1.0.2
const CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS      = "0x4331bc871435D8242cf5852DBbe34bE46B6DBeDc"; // v1.0.2

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

  await deployExplorerCollection();
  await deployExplorerAgentAccount();
  await deployConcentratedLiquidityGatewayModuleC();
  await deployConcentratedLiquidityAgentFactory();

  await verifyContracts();
  logAddresses()
}

async function deployExplorerCollection() {
  if(await isDeployed(EXPLORER_COLLECTION_ADDRESS)) {
    explorerCollection = await ethers.getContractAt("ExplorerAgents", EXPLORER_COLLECTION_ADDRESS, agentfideployer) as ExplorerAgents;
  } else {
    console.log("Deploying ExplorerAgents");
    let args = [agentfideployer.address, BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS];
    explorerCollection = await deployContractUsingContractFactory(agentfideployer, "ExplorerAgents", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as ExplorerAgents;
    console.log(`Deployed ExplorerAgents to ${explorerCollection.address}`);
    contractsToVerify.push({ address: explorerCollection.address, args, contractName: "contracts/tokens/ExplorerAgents.sol:ExplorerAgents" })
    if(!!EXPLORER_COLLECTION_ADDRESS && EXPLORER_COLLECTION_ADDRESS != EXPLORER_COLLECTION_ADDRESS) throw new Error(`Deployed ExplorerAgents to ${EXPLORER_COLLECTION_ADDRESS}, expected ${EXPLORER_COLLECTION_ADDRESS}`)
  }
  let args = [agentfideployer.address, BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS];
  contractsToVerify.push({ address: explorerCollection.address, args, contractName: "contracts/tokens/ExplorerAgents.sol:ExplorerAgents" })
}

async function deployExplorerAgentAccount() {
  if(await isDeployed(EXPLORER_ACCOUNT_IMPL_ADDRESS)) {
    explorerAccountImpl = await ethers.getContractAt("ExplorerAgentAccount", EXPLORER_ACCOUNT_IMPL_ADDRESS, agentfideployer) as ExplorerAgentAccount;
  } else {
    console.log("Deploying ExplorerAgentAccount");
    let args = [BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, MULTICALL_FORWARDER_ADDRESS, ERC6551_REGISTRY_ADDRESS, AddressZero];
    explorerAccountImpl = await deployContractUsingContractFactory(agentfideployer, "ExplorerAgentAccount", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as ExplorerAgentAccount;
    console.log(`Deployed ExplorerAgentAccount to ${explorerAccountImpl.address}`);
    contractsToVerify.push({ address: explorerAccountImpl.address, args, contractName: "contracts/accounts/ExplorerAgentAccount.sol:ExplorerAgentAccount" })
    if(!!EXPLORER_ACCOUNT_IMPL_ADDRESS && explorerAccountImpl.address != EXPLORER_ACCOUNT_IMPL_ADDRESS) throw new Error(`Deployed ExplorerAgentAccount to ${explorerAccountImpl.address}, expected ${EXPLORER_ACCOUNT_IMPL_ADDRESS}`)
  }
  let args = [BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, MULTICALL_FORWARDER_ADDRESS, ERC6551_REGISTRY_ADDRESS, AddressZero];
  contractsToVerify.push({ address: explorerAccountImpl.address, args, contractName: "contracts/accounts/ExplorerAgentAccount.sol:ExplorerAgentAccount" })
}

async function deployConcentratedLiquidityGatewayModuleC() {
  if(await isDeployed(CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS)) {
    concentratedLiquidityGatewayModuleC = await ethers.getContractAt("ConcentratedLiquidityGatewayModuleC", CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS, agentfideployer) as ConcentratedLiquidityGatewayModuleC;
  } else {
    console.log("Deploying ConcentratedLiquidityGatewayModuleC");
    let args = [BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS];
    concentratedLiquidityGatewayModuleC = await deployContractUsingContractFactory(agentfideployer, "ConcentratedLiquidityGatewayModuleC", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as ConcentratedLiquidityGatewayModuleC;
    console.log(`Deployed ConcentratedLiquidityGatewayModuleC to ${concentratedLiquidityGatewayModuleC.address}`);
    contractsToVerify.push({ address: concentratedLiquidityGatewayModuleC.address, args, contractName: "contracts/modules/ConcentratedLiquidityGatewayModuleC.sol:ConcentratedLiquidityGatewayModuleC" })
    if(!!CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS && concentratedLiquidityGatewayModuleC.address != CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS) throw new Error(`Deployed ConcentratedLiquidityGatewayModuleC to ${concentratedLiquidityGatewayModuleC.address}, expected ${CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS}`)
  }
  let args = [BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS];
  contractsToVerify.push({ address: concentratedLiquidityGatewayModuleC.address, args, contractName: "contracts/modules/ConcentratedLiquidityGatewayModuleC.sol:ConcentratedLiquidityGatewayModuleC" })
}

async function deployConcentratedLiquidityAgentFactory() {
  if(await isDeployed(CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS)) {
    concentratedLiquidityAgentFactory = await ethers.getContractAt("ConcentratedLiquidityAgentFactory", CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS, agentfideployer) as ConcentratedLiquidityAgentFactory;
  } else {
    console.log("Deploying ConcentratedLiquidityAgentFactory");
    let args = [agentfideployer.address, BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, MULTICALL_FORWARDER_ADDRESS, GENESIS_COLLECTION_ADDRESS, STRATEGY_COLLECTION_ADDRESS, explorerCollection.address, ERC6551_REGISTRY_ADDRESS, AGENT_REGISTRY_ADDRESS, WETH_ADDRESS];
    concentratedLiquidityAgentFactory = await deployContractUsingContractFactory(agentfideployer, "ConcentratedLiquidityAgentFactory", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as ConcentratedLiquidityAgentFactory;
    console.log(`Deployed ConcentratedLiquidityAgentFactory to ${concentratedLiquidityAgentFactory.address}`);
    contractsToVerify.push({ address: concentratedLiquidityAgentFactory.address, args, contractName: "contracts/factory/ConcentratedLiquidityAgentFactory.sol:ConcentratedLiquidityAgentFactory" })
    if(!!CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS && concentratedLiquidityAgentFactory.address != CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS) throw new Error(`Deployed ConcentratedLiquidityAgentFactory to ${concentratedLiquidityAgentFactory.address}, expected ${CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS}`)
  }
  let args = [agentfideployer.address, BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, MULTICALL_FORWARDER_ADDRESS, GENESIS_COLLECTION_ADDRESS, STRATEGY_COLLECTION_ADDRESS, explorerCollection.address, ERC6551_REGISTRY_ADDRESS, AGENT_REGISTRY_ADDRESS, WETH_ADDRESS];
  contractsToVerify.push({ address: concentratedLiquidityAgentFactory.address, args, contractName: "contracts/factory/ConcentratedLiquidityAgentFactory.sol:ConcentratedLiquidityAgentFactory" })
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
  logContractAddress("ExplorerAgents", explorerCollection.address);
  logContractAddress("ExplorerAgentAccount", explorerAccountImpl.address);
  logContractAddress("ConcentratedLiquidityGatewayModuleC", concentratedLiquidityGatewayModuleC.address);
  logContractAddress("ConcentratedLiquidityAgentFactory", concentratedLiquidityAgentFactory.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
