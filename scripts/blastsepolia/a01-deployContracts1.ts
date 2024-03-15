import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();
const accounts = JSON.parse(process.env.ACCOUNTS || "{}");

const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const agentfideployer = new ethers.Wallet(accounts.agentfideployer.key, provider);

import { Agents, BlastooorAgentAccount, BlastooorAgentAccountRingProtocolC, BlastooorAgentAccountRingProtocolD, BlastooorAgentAccountThrusterA, BlastooorAgentAccountBasketA, AgentFactory01, AgentFactory02, AgentFactory03, BlastooorGenesisFactory, IBlast, ContractFactory, GasCollector, BalanceFetcher, Multicall3Blastable, BlastooorGenesisAgents, BlastooorStrategyAgents, BlastooorStrategyFactory, BlastooorStrategyAgentAccount, Dispatcher } from "../../typechain-types";

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
const MULTICALL_FORWARDER_ADDRESS     = "0x26aDd0cB3eA65ADBb063739A5C5735055029B6BD"; // v1.0.0
const CONTRACT_FACTORY_ADDRESS        = "0x9D735e7926729cAB93b10cb5814FF8487Fb6D5e8"; // v1.0.0

const GAS_COLLECTOR_ADDRESS           = "0xf237c20584DaCA970498917470864f4d027de4ca"; // v1.0.0
const BALANCE_FETCHER_ADDRESS         = "0xecBa5144eeFEebceC60e0Bfb0D19e6F86048690A"; // v1.0.1

const GENESIS_COLLECTION_ADDRESS      = "0x5066A1975BE96B777ddDf57b496397efFdDcB4A9"; // v1.0.0
const GENESIS_FACTORY_ADDRESS         = "0x700b6f8B315247DD41C42A6Cfca1dAE6B4567f3B"; // v1.0.0
const ACCOUNT_IMPL_BASE_ADDRESS       = "0x8836060137a20E41d599565F644D9EB0807A5353"; // v1.0.0

const STRATEGY_COLLECTION_ADDRESS     = "0x07A10106e8cA35D3ca976A63B93aCECF56Ef10dF"; // v1.0.1
const STRATEGY_FACTORY_ADDRESS        = "0x91e82c028C1b7015225a7bCFa7a430E46C8DCFb6"; // v1.0.1
const STRATEGY_ACCOUNT_IMPL_ADDRESS   = "0xF62f98e2aF80BB65e544D38783254bE294a4526d"; // v1.0.1

const DISPATCHER_ADDRESS              = "0xC9EB588498e911bdeB081A927c8059FaC4480260"; // v1.0.1

let iblast: IBlast;

let multicall3: Multicall3Blastable;
let contractFactory: ContractFactory;
let gasCollector: GasCollector;
let balanceFetcher: BalanceFetcher;

let genesisCollection: BlastooorGenesisAgents;
let genesisFactory: BlastooorGenesisFactory;
let accountImplBase: BlastooorAgentAccount; // the base implementation for genesis agent accounts

let strategyCollection: BlastooorStrategyAgents;
let strategyFactory: BlastooorStrategyFactory;
let strategyAccountImpl: BlastooorStrategyAgentAccount;

let dispatcher: Dispatcher;

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
  await deployBalanceFetcher();
  await deployMulticall3();

  await deployGenesisCollection();
  await deployBlastooorGenesisFactory();
  await deployBlastooorAgentAccount();

  await deployStrategyCollection();
  await deployBlastooorStrategyFactory();
  await deployBlastooorStrategyAgentAccount();

  await deployDispatcher();

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
    if(chainID != 31337) await verifyContract(contractFactory.address, args);
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
    if(chainID != 31337) await verifyContract(gasCollector.address, args);
    if(!!GAS_COLLECTOR_ADDRESS && gasCollector.address != GAS_COLLECTOR_ADDRESS) throw new Error(`Deployed GasCollector to ${gasCollector.address}, expected ${GAS_COLLECTOR_ADDRESS}`)
  }
}

async function deployBalanceFetcher() {
  if(await isDeployed(BALANCE_FETCHER_ADDRESS)) {
    balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, agentfideployer) as BalanceFetcher;
  } else {
    console.log("Deploying BalanceFetcher");
    let args = [agentfideployer.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS];
    balanceFetcher = await deployContractUsingContractFactory(agentfideployer, "BalanceFetcher", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BalanceFetcher;
    console.log(`Deployed BalanceFetcher to ${balanceFetcher.address}`);
    if(chainID != 31337) await verifyContract(balanceFetcher.address, args);
    if(!!BALANCE_FETCHER_ADDRESS && balanceFetcher.address != BALANCE_FETCHER_ADDRESS) throw new Error(`Deployed ModulePack100 to ${balanceFetcher.address}, expected ${BALANCE_FETCHER_ADDRESS}`)
  }
}

async function deployMulticall3() {
  if(await isDeployed(MULTICALL_FORWARDER_ADDRESS)) {
    multicall3 = await ethers.getContractAt("Multicall3Blastable", MULTICALL_FORWARDER_ADDRESS, agentfideployer) as Multicall3Blastable;
  } else {
    console.log("Deploying Multicall3Blastable");
    let args = [BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS];
    multicall3 = await deployContractUsingContractFactory(agentfideployer, "Multicall3Blastable", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as Multicall3Blastable;
    console.log(`Deployed Multicall3Blastable to ${multicall3.address}`);
    if(chainID != 31337) await verifyContract(multicall3.address, args);
    if(!!MULTICALL_FORWARDER_ADDRESS && multicall3.address != MULTICALL_FORWARDER_ADDRESS) throw new Error(`Deployed ModulePack100 to ${multicall3.address}, expected ${MULTICALL_FORWARDER_ADDRESS}`)
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
    if(chainID != 31337) await verifyContract(genesisCollection.address, args, "contracts/tokens/BlastooorGenesisAgents.sol:BlastooorGenesisAgents");
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
    if(chainID != 31337) await verifyContract(genesisFactory.address, args);
    if(!!GENESIS_FACTORY_ADDRESS && genesisFactory.address != GENESIS_FACTORY_ADDRESS) throw new Error(`Deployed BlastooorGenesisFactory to ${genesisFactory.address}, expected ${GENESIS_FACTORY_ADDRESS}`)
  }
}

async function deployBlastooorAgentAccount() {
  if(await isDeployed(ACCOUNT_IMPL_BASE_ADDRESS)) {
    accountImplBase = await ethers.getContractAt("BlastooorAgentAccount", ACCOUNT_IMPL_BASE_ADDRESS, agentfideployer) as BlastooorAgentAccount;
  } else {
    console.log("Deploying BlastooorAgentAccount");
    let args = [BLAST_ADDRESS, gasCollector.address, ENTRY_POINT_ADDRESS, MULTICALL_FORWARDER_ADDRESS, ERC6551_REGISTRY_ADDRESS, AddressZero];
    accountImplBase = await deployContractUsingContractFactory(agentfideployer, "BlastooorAgentAccount", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BlastooorAgentAccount;
    console.log(`Deployed BlastooorAgentAccount to ${accountImplBase.address}`);
    if(chainID != 31337) await verifyContract(accountImplBase.address, args);
    if(!!ACCOUNT_IMPL_BASE_ADDRESS && accountImplBase.address != ACCOUNT_IMPL_BASE_ADDRESS) throw new Error(`Deployed BlastooorAgentAccount to ${accountImplBase.address}, expected ${ACCOUNT_IMPL_BASE_ADDRESS}`)
  }
}

async function deployStrategyCollection() {
  if(await isDeployed(STRATEGY_COLLECTION_ADDRESS)) {
    strategyCollection = await ethers.getContractAt("BlastooorStrategyAgents", STRATEGY_COLLECTION_ADDRESS, agentfideployer) as BlastooorStrategyAgents;
  } else {
    console.log("Deploying BlastooorStrategyAgents");
    let args = [agentfideployer.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ERC6551_REGISTRY_ADDRESS];
    strategyCollection = await deployContractUsingContractFactory(agentfideployer, "BlastooorStrategyAgents", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BlastooorStrategyAgents;
    console.log(`Deployed BlastooorStrategyAgents to ${strategyCollection.address}`);
    if(chainID != 31337) await verifyContract(strategyCollection.address, args, "contracts/tokens/BlastooorStrategyAgents.sol:BlastooorStrategyAgents");
    if(!!STRATEGY_COLLECTION_ADDRESS && strategyCollection.address != STRATEGY_COLLECTION_ADDRESS) throw new Error(`Deployed BlastooorStrategyAgents to ${strategyCollection.address}, expected ${STRATEGY_COLLECTION_ADDRESS}`)
  }
}

async function deployBlastooorStrategyFactory() {
  if(await isDeployed(STRATEGY_FACTORY_ADDRESS)) {
    strategyFactory = await ethers.getContractAt("BlastooorStrategyFactory", STRATEGY_FACTORY_ADDRESS, agentfideployer) as BlastooorStrategyFactory;
  } else {
    console.log("Deploying BlastooorStrategyFactory");
    let args = [agentfideployer.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, genesisCollection.address, strategyCollection.address];
    strategyFactory = await deployContractUsingContractFactory(agentfideployer, "BlastooorStrategyFactory", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BlastooorStrategyFactory;
    console.log(`Deployed BlastooorStrategyFactory to ${strategyFactory.address}`);
    if(chainID != 31337) await verifyContract(strategyFactory.address, args);
    if(!!STRATEGY_FACTORY_ADDRESS && strategyFactory.address != STRATEGY_FACTORY_ADDRESS) throw new Error(`Deployed BlastooorStrategyFactory to ${strategyFactory.address}, expected ${STRATEGY_FACTORY_ADDRESS}`)
  }
}

async function deployBlastooorStrategyAgentAccount() {
  if(await isDeployed(STRATEGY_ACCOUNT_IMPL_ADDRESS)) {
    strategyAccountImpl = await ethers.getContractAt("BlastooorStrategyAgentAccount", STRATEGY_ACCOUNT_IMPL_ADDRESS, agentfideployer) as BlastooorStrategyAgentAccount;
  } else {
    console.log("Deploying BlastooorStrategyAgentAccount");
    let args = [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, MULTICALL_FORWARDER_ADDRESS, ERC6551_REGISTRY_ADDRESS, AddressZero];
    strategyAccountImpl = await deployContractUsingContractFactory(agentfideployer, "BlastooorStrategyAgentAccount", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BlastooorStrategyAgentAccount;
    console.log(`Deployed BlastooorStrategyAgentAccount to ${strategyAccountImpl.address}`);
    if(chainID != 31337) await verifyContract(strategyAccountImpl.address, args);
    if(!!STRATEGY_ACCOUNT_IMPL_ADDRESS && strategyAccountImpl.address != STRATEGY_ACCOUNT_IMPL_ADDRESS) throw new Error(`Deployed BlastooorStrategyAgentAccount to ${strategyAccountImpl.address}, expected ${STRATEGY_ACCOUNT_IMPL_ADDRESS}`)
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
    if(chainID != 31337) await verifyContract(dispatcher.address, args);
    if(!!DISPATCHER_ADDRESS && dispatcher.address != DISPATCHER_ADDRESS) throw new Error(`Deployed Dispatcher to ${dispatcher.address}, expected ${DISPATCHER_ADDRESS}`)
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
  logContractAddress("Multicall3", multicall3.address);
  logContractAddress("BlastooorGenesisAgents", genesisCollection.address);
  logContractAddress("BlastooorGenesisFactory", genesisFactory.address);
  logContractAddress("BlastooorAgentAccount", accountImplBase.address);
  logContractAddress("BlastooorStrategyAgents", strategyCollection.address);
  logContractAddress("BlastooorStrategyFactory", strategyFactory.address);
  logContractAddress("BlastooorStrategyAgentAccount", strategyAccountImpl.address);
  logContractAddress("Dispatcher", dispatcher.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
