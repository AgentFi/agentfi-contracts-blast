import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();
const accounts = JSON.parse(process.env.ACCOUNTS || "{}");

const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const agentfideployer = new ethers.Wallet(accounts.agentfideployer.key, provider);

import { BlastooorGenesisAgentAccount, BlastooorGenesisFactory, IBlast, ContractFactory, GasCollector, BalanceFetcher, MulticallForwarder, BlastooorGenesisAgents, BlastooorStrategyAgents, BlastooorStrategyFactory, BlastooorStrategyAgentAccount, BlastooorStrategyAgentAccountV2, Dispatcher, AgentRegistry } from "../../typechain-types";

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
const STRATEGY_ACCOUNT_IMPL_V2_ADDRESS   = "0x220668Aa522074E93A64a74f40Aff5fce198720f"; // v1.0.2

const DISPATCHER_ADDRESS              = "0x1523e29DbfDb7655A8358429F127cF4ea9c601Fd"; // v1.0.1

const MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS  = "0xB52f71b3a8bB630F0F08Ca4f85EeF0d29212cEC0";

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

//let dexBalancerModuleA: DexBalancerModuleA;
let multiplierMaxxooorModuleB: MultiplierMaxooorModuleB;

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
  //await expectDeployed(ERC6551_REGISTRY_ADDRESS)

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, boombotseth) as IBlast;

  await deployContractFactory();
  await deployGasCollector();
  await deployMulticallForwarder();

  await deployGenesisCollection();
  await deployBlastooorGenesisFactory();
  await deployBlastooorGenesisAgentAccount();

  await deployAgentRegistry();
  await deployGenesisAccountFactory();

  await deployStrategyCollection();
  await deployBlastooorStrategyFactory();
  await deployBlastooorStrategyAgentAccountV1();
  await deployBlastooorStrategyAgentAccountV2();

  await deployDispatcher();
  await deployBalanceFetcher();

  await deployMultiplierMaxxooorModuleB();

  await verifyContracts();
  logAddresses()
}

async function deployContractFactory() {
  if(await isDeployed(CONTRACT_FACTORY_ADDRESS)) {
    contractFactory = await ethers.getContractAt("ContractFactory", CONTRACT_FACTORY_ADDRESS, agentfideployer) as ContractFactory;
  } else {
    console.log("Deploying ContractFactory");
    let args = [agentfideployer.address, BLAST_ADDRESS, agentfideployer.address];
    contractFactory = await deployContractUsingContractFactory(agentfideployer, "ContractFactory", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as ContractFactory;
    console.log(`Deployed ContractFactory to ${contractFactory.address}`);
    contractsToVerify.push({ address: contractFactory.address, args })
    if(!!CONTRACT_FACTORY_ADDRESS && contractFactory.address != CONTRACT_FACTORY_ADDRESS) throw new Error(`Deployed ContractFactoryto ${contractFactory.address}, expected ${CONTRACT_FACTORY_ADDRESS}`)
  }
}

async function deployGasCollector() {
  if(await isDeployed(GAS_COLLECTOR_ADDRESS)) {
    gasCollector = await ethers.getContractAt("GasCollector", GAS_COLLECTOR_ADDRESS, agentfideployer) as GasCollector;
  } else {
    console.log("Deploying GasCollector");
    let args = [agentfideployer.address, BLAST_ADDRESS];
    gasCollector = await deployContractUsingContractFactory(agentfideployer, "GasCollector", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as GasCollector;
    console.log(`Deployed GasCollector to ${gasCollector.address}`);
    contractsToVerify.push({ address: gasCollector.address, args })
    if(!!GAS_COLLECTOR_ADDRESS && gasCollector.address != GAS_COLLECTOR_ADDRESS) throw new Error(`Deployed GasCollector to ${gasCollector.address}, expected ${GAS_COLLECTOR_ADDRESS}`)
  }
}

async function deployBalanceFetcher() {
  if(await isDeployed(BALANCE_FETCHER_ADDRESS)) {
    balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, agentfideployer) as BalanceFetcher;
  } else {
    console.log("Deploying BalanceFetcher");
    let args = [agentfideployer.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, agentRegistry.address];
    balanceFetcher = await deployContractUsingContractFactory(agentfideployer, "BalanceFetcher", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BalanceFetcher;
    console.log(`Deployed BalanceFetcher to ${balanceFetcher.address}`);
    contractsToVerify.push({ address: balanceFetcher.address, args })
    if(!!BALANCE_FETCHER_ADDRESS && balanceFetcher.address != BALANCE_FETCHER_ADDRESS) throw new Error(`Deployed BalanceFetcher to ${balanceFetcher.address}, expected ${BALANCE_FETCHER_ADDRESS}`)
  }
}

async function deployMulticallForwarder() {
  if(await isDeployed(MULTICALL_FORWARDER_ADDRESS)) {
    multicallForwarder = await ethers.getContractAt("MulticallForwarder", MULTICALL_FORWARDER_ADDRESS, agentfideployer) as MulticallForwarder;
  } else {
    console.log("Deploying MulticallForwarder");
    let args = [BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS];
    multicallForwarder = await deployContractUsingContractFactory(agentfideployer, "MulticallForwarder", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as MulticallForwarder;
    console.log(`Deployed MulticallForwarder to ${multicallForwarder.address}`);
    contractsToVerify.push({ address: multicallForwarder.address, args })
    if(!!MULTICALL_FORWARDER_ADDRESS && multicallForwarder.address != MULTICALL_FORWARDER_ADDRESS) throw new Error(`Deployed MulticallForwarder to ${multicallForwarder.address}, expected ${MULTICALL_FORWARDER_ADDRESS}`)
  }
}

async function deployGenesisCollection() {
  if(await isDeployed(GENESIS_COLLECTION_ADDRESS)) {
    genesisCollection = await ethers.getContractAt("BlastooorGenesisAgents", GENESIS_COLLECTION_ADDRESS, agentfideployer) as BlastooorGenesisAgents;
  } else {
    console.log("Deploying BlastooorGenesisAgents");
    let args = [agentfideployer.address, BLAST_ADDRESS, gasCollector.address, ERC6551_REGISTRY_ADDRESS];
    genesisCollection = await deployContractUsingContractFactory(agentfideployer, "BlastooorGenesisAgents", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BlastooorGenesisAgents;
    console.log(`Deployed BlastooorGenesisAgents to ${genesisCollection.address}`);
    contractsToVerify.push({ address: genesisCollection.address, args, contractName: "contracts/tokens/BlastooorGenesisAgents.sol:BlastooorGenesisAgents" })
    if(!!GENESIS_COLLECTION_ADDRESS && genesisCollection.address != GENESIS_COLLECTION_ADDRESS) throw new Error(`Deployed BlastooorGenesisAgents to ${genesisCollection.address}, expected ${GENESIS_COLLECTION_ADDRESS}`)
  }
}

async function deployBlastooorGenesisFactory() {
  if(await isDeployed(GENESIS_FACTORY_ADDRESS)) {
    genesisFactory = await ethers.getContractAt("BlastooorGenesisFactory", GENESIS_FACTORY_ADDRESS, agentfideployer) as BlastooorGenesisFactory;
  } else {
    console.log("Deploying BlastooorGenesisFactory");
    let args = [agentfideployer.address, BLAST_ADDRESS, gasCollector.address, genesisCollection.address];
    genesisFactory = await deployContractUsingContractFactory(agentfideployer, "BlastooorGenesisFactory", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BlastooorGenesisFactory;
    console.log(`Deployed BlastooorGenesisFactory to ${genesisFactory.address}`);
    contractsToVerify.push({ address: genesisFactory.address, args })
    if(!!GENESIS_FACTORY_ADDRESS && genesisFactory.address != GENESIS_FACTORY_ADDRESS) throw new Error(`Deployed BlastooorGenesisFactory to ${genesisFactory.address}, expected ${GENESIS_FACTORY_ADDRESS}`)
  }
}

async function deployBlastooorGenesisAgentAccount() {
  if(await isDeployed(GENESIS_ACCOUNT_IMPL_ADDRESS)) {
    genesisAccountImpl = await ethers.getContractAt("BlastooorGenesisAgentAccount", GENESIS_ACCOUNT_IMPL_ADDRESS, agentfideployer) as BlastooorGenesisAgentAccount;
  } else {
    console.log("Deploying BlastooorGenesisAgentAccount");
    let args = [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero];
    genesisAccountImpl = await deployContractUsingContractFactory(agentfideployer, "BlastooorGenesisAgentAccount", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BlastooorGenesisAgentAccount;
    console.log(`Deployed BlastooorGenesisAgentAccount to ${genesisAccountImpl.address}`);
    contractsToVerify.push({ address: genesisAccountImpl.address, args })
    if(!!GENESIS_ACCOUNT_IMPL_ADDRESS && genesisAccountImpl.address != GENESIS_ACCOUNT_IMPL_ADDRESS) throw new Error(`Deployed BlastooorGenesisAgentAccount to ${genesisAccountImpl.address}, expected ${GENESIS_ACCOUNT_IMPL_ADDRESS}`)
  }
}

async function deployAgentRegistry() {
  if(await isDeployed(AGENT_REGISTRY_ADDRESS)) {
    agentRegistry = await ethers.getContractAt("AgentRegistry", AGENT_REGISTRY_ADDRESS, agentfideployer) as AgentRegistry;
  } else {
    console.log("Deploying AgentRegistry");
    let args = [agentfideployer.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS];
    agentRegistry = await deployContractUsingContractFactory(agentfideployer, "AgentRegistry", args, toBytes32(1), undefined, {...networkSettings.overrides, gasLimit: 10_000_000}, networkSettings.confirmations) as AgentRegistry;
    console.log(`Deployed AgentRegistry to ${agentRegistry.address}`);
    contractsToVerify.push({ address: agentRegistry.address, args })
    if(!!AGENT_REGISTRY_ADDRESS && agentRegistry.address != AGENT_REGISTRY_ADDRESS) throw new Error(`Deployed AgentRegistry to ${agentRegistry.address}, expected ${AGENT_REGISTRY_ADDRESS}`)
  }
}

async function deployGenesisAccountFactory() {
  if(await isDeployed(GENESIS_ACCOUNT_FACTORY_ADDRESS)) {
    genesisAccountFactory = await ethers.getContractAt("BlastooorAccountFactory", GENESIS_ACCOUNT_FACTORY_ADDRESS, agentfideployer) as BlastooorAccountFactory;
  } else {
    console.log("Deploying BlastooorAccountFactory");
    let args = [agentfideployer.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, multicallForwarder.address, genesisCollection.address, agentRegistry.address, ERC6551_REGISTRY_ADDRESS];
    genesisAccountFactory = await deployContractUsingContractFactory(agentfideployer, "BlastooorAccountFactory", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BlastooorAccountFactory;
    console.log(`Deployed BlastooorAccountFactory to ${genesisAccountFactory.address}`);
    contractsToVerify.push({ address: genesisAccountFactory.address, args })
    if(!!GENESIS_ACCOUNT_FACTORY_ADDRESS && genesisAccountFactory.address != GENESIS_ACCOUNT_FACTORY_ADDRESS) throw new Error(`Deployed BlastooorAccountFactory to ${genesisAccountFactory.address}, expected ${GENESIS_ACCOUNT_FACTORY_ADDRESS}`)
  }
}

async function deployStrategyCollection() {
  if(await isDeployed(STRATEGY_COLLECTION_ADDRESS)) {
    strategyCollection = await ethers.getContractAt("BlastooorStrategyAgents", STRATEGY_COLLECTION_ADDRESS, agentfideployer) as BlastooorStrategyAgents;
  } else {
    console.log("Deploying BlastooorStrategyAgents");
    let args = [agentfideployer.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS];
    strategyCollection = await deployContractUsingContractFactory(agentfideployer, "BlastooorStrategyAgents", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BlastooorStrategyAgents;
    console.log(`Deployed BlastooorStrategyAgents to ${strategyCollection.address}`);
    contractsToVerify.push({ address: strategyCollection.address, args, contractName: "contracts/tokens/BlastooorStrategyAgents.sol:BlastooorStrategyAgents" })
    if(!!STRATEGY_COLLECTION_ADDRESS && strategyCollection.address != STRATEGY_COLLECTION_ADDRESS) throw new Error(`Deployed BlastooorStrategyAgents to ${strategyCollection.address}, expected ${STRATEGY_COLLECTION_ADDRESS}`)
  }
}

async function deployBlastooorStrategyFactory() {
  if(await isDeployed(STRATEGY_FACTORY_ADDRESS)) {
    strategyFactory = await ethers.getContractAt("BlastooorStrategyFactory", STRATEGY_FACTORY_ADDRESS, agentfideployer) as BlastooorStrategyFactory;
  } else {
    console.log("Deploying BlastooorStrategyFactory");
    let args = [agentfideployer.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, genesisCollection.address, strategyCollection.address, ERC6551_REGISTRY_ADDRESS, agentRegistry.address];
    strategyFactory = await deployContractUsingContractFactory(agentfideployer, "BlastooorStrategyFactory", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BlastooorStrategyFactory;
    console.log(`Deployed BlastooorStrategyFactory to ${strategyFactory.address}`);
    contractsToVerify.push({ address: strategyFactory.address, args })
    if(!!STRATEGY_FACTORY_ADDRESS && strategyFactory.address != STRATEGY_FACTORY_ADDRESS) throw new Error(`Deployed BlastooorStrategyFactory to ${strategyFactory.address}, expected ${STRATEGY_FACTORY_ADDRESS}`)
  }
}

async function deployBlastooorStrategyAgentAccountV1() {
  if(await isDeployed(STRATEGY_ACCOUNT_IMPL_V1_ADDRESS)) {
    strategyAccountImplV1 = await ethers.getContractAt("BlastooorStrategyAgentAccount", STRATEGY_ACCOUNT_IMPL_V1_ADDRESS, agentfideployer) as BlastooorStrategyAgentAccount;
  } else {
    console.log("Deploying BlastooorStrategyAgentAccount");
    let args = [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero];
    strategyAccountImplV1 = await deployContractUsingContractFactory(agentfideployer, "BlastooorStrategyAgentAccount", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BlastooorStrategyAgentAccount;
    console.log(`Deployed BlastooorStrategyAgentAccount to ${strategyAccountImplV1.address}`);
    contractsToVerify.push({ address: strategyAccountImplV1.address, args })
    if(!!STRATEGY_ACCOUNT_IMPL_V1_ADDRESS && strategyAccountImplV1.address != STRATEGY_ACCOUNT_IMPL_V1_ADDRESS) throw new Error(`Deployed BlastooorStrategyAgentAccount to ${strategyAccountImplV1.address}, expected ${STRATEGY_ACCOUNT_IMPL_V1_ADDRESS}`)
  }
}
async function deployBlastooorStrategyAgentAccountV2() {
  if(await isDeployed(STRATEGY_ACCOUNT_IMPL_V2_ADDRESS)) {
    strategyAccountImplV2 = await ethers.getContractAt("BlastooorStrategyAgentAccountV2", STRATEGY_ACCOUNT_IMPL_V2_ADDRESS, agentfideployer) as BlastooorStrategyAgentAccountV2;
  } else {
    console.log("Deploying BlastooorStrategyAgentAccountV2");
    let args = [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero];
    strategyAccountImplV2 = await deployContractUsingContractFactory(agentfideployer, "BlastooorStrategyAgentAccountV2", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BlastooorStrategyAgentAccountV2;
    console.log(`Deployed BlastooorStrategyAgentAccountV2 to ${strategyAccountImplV2.address}`);
    contractsToVerify.push({ address: strategyAccountImplV2.address, args })
    if(!!STRATEGY_ACCOUNT_IMPL_V2_ADDRESS && strategyAccountImplV2.address != STRATEGY_ACCOUNT_IMPL_V2_ADDRESS) throw new Error(`Deployed BlastooorStrategyAgentAccountV2 to ${strategyAccountImplV2.address}, expected ${STRATEGY_ACCOUNT_IMPL_V2_ADDRESS}`)
  }
}

async function deployDispatcher() {
  if(await isDeployed(DISPATCHER_ADDRESS)) {
    dispatcher = await ethers.getContractAt("Dispatcher", DISPATCHER_ADDRESS, agentfideployer) as Dispatcher;
  } else {
    console.log("Deploying Dispatcher");
    let args = [agentfideployer.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS];
    dispatcher = await deployContractUsingContractFactory(agentfideployer, "Dispatcher", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as Dispatcher;
    console.log(`Deployed Dispatcher to ${dispatcher.address}`);
    contractsToVerify.push({ address: dispatcher.address, args })
    if(!!DISPATCHER_ADDRESS && dispatcher.address != DISPATCHER_ADDRESS) throw new Error(`Deployed Dispatcher to ${dispatcher.address}, expected ${DISPATCHER_ADDRESS}`)
  }
}

async function deployMultiplierMaxxooorModuleB() {
  if(await isDeployed(MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS)) {
    multiplierMaxxooorModuleB = await ethers.getContractAt("MultiplierMaxxooorModuleB", MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS, agentfideployer) as MultiplierMaxxooorModuleB;
  } else {
    console.log("Deploying MultiplierMaxxooorModuleB");
    let args = [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS];
    multiplierMaxxooorModuleB = await deployContractUsingContractFactory(agentfideployer, "MultiplierMaxxooorModuleB", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as MultiplierMaxxooorModuleB;
    console.log(`Deployed MultiplierMaxxooorModuleB to ${multiplierMaxxooorModuleB.address}`);
    contractsToVerify.push({ address: multiplierMaxxooorModuleB.address, args })
    if(!!MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS && multiplierMaxxooorModuleB.address != MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS) throw new Error(`Deployed MultiplierMaxxooorModuleB to ${multiplierMaxxooorModuleB.address}, expected ${MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS}`)
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
  console.log("| Contract Name                    | Address                                      |");
  console.log("|----------------------------------|----------------------------------------------|");
  logContractAddress("ERC6551Registry", ERC6551_REGISTRY_ADDRESS);
  logContractAddress("ContractFactory", contractFactory.address);
  logContractAddress("GasCollector", gasCollector.address);
  logContractAddress("BalanceFetcher", balanceFetcher.address);
  logContractAddress("MulticallForwarder", multicallForwarder.address);
  logContractAddress("BlastooorGenesisAgents", genesisCollection.address);
  logContractAddress("BlastooorGenesisFactory", genesisFactory.address);
  logContractAddress("BlastooorGenesisAgentAccount", genesisAccountImpl.address);
  logContractAddress("BlastooorGenesisAccountFactory", genesisAccountFactory.address);
  logContractAddress("BlastooorStrategyAgents", strategyCollection.address);
  logContractAddress("BlastooorStrategyFactory", strategyFactory.address);
  logContractAddress("BlastooorStrategyAgentAccount", strategyAccountImplV1.address);
  logContractAddress("BlastooorStrategyAgentAccountV2", strategyAccountImplV2.address);
  logContractAddress("AgentRegistry", agentRegistry.address);
  logContractAddress("Dispatcher", dispatcher.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
