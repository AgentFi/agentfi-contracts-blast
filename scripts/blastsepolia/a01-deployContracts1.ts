import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();
const accounts = JSON.parse(process.env.ACCOUNTS || "{}");

const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const agentfideployer = new ethers.Wallet(accounts.agentfideployer.key, provider);

import { Agents, BlastAgentAccount, BlastAgentAccountRingProtocolC, BlastAgentAccountRingProtocolD, AgentFactory01, AgentFactory02, AgentFactory03, IBlast, ContractFactory, GasCollector, BalanceFetcher, Multicall3Blastable } from "../../typechain-types";

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
const ENTRY_POINT_ADDRESS             = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const MULTICALL_FORWARDER_ADDRESS     = "0x1740c3552c5f1Bd304fab433C977375357B5Bd7c";
const CONTRACT_FACTORY_ADDRESS        = "0xA74500382CAb2EBFe9A08dc2c01430821A4A8E15"; // v0.1.3

const GAS_COLLECTOR_ADDRESS           = "0x0311b9696907AdC2093448678cf080adA1368d00"; // V0.1.3
const BALANCE_FETCHER_ADDRESS         = "0xb646F462A89799d910b1dc330BA1DA9dE763c931"; // v0.1.3

const AGENT_NFT_ADDRESS               = "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b"; // v0.1.3

const AGENT_FACTORY01_ADDRESS         = "0x66458d8cE1238C7C7818e7988974F0bd5B373c95"; // v0.1.3
const AGENT_FACTORY02_ADDRESS         = "0x59c11B12a2D11810d1ca4afDc21a9Fc837193f41"; // v0.1.3
const AGENT_FACTORY03_ADDRESS         = "0x3c12E9F1FC3C3211B598aD176385939Ea01deA89"; // v0.1.3

const ACCOUNT_IMPL_BASE_ADDRESS       = "0x25a9aD7766D2857E4EB320a9557F637Bd748b97c"; // v0.1.3
const ACCOUNT_IMPL_RING_C_ADDRESS     = "0xeb61E6600f87c07EB40C735B0DF0aedf899C24F6"; // v0.1.3
const ACCOUNT_IMPL_RING_D_ADDRESS     = "0xD9F32ab36bCB6dD3005038DeB53f9ed742947b64"; // v0.1.3

let iblast: IBlast;

let multicall3: Multicall3Blastable;
let contractFactory: ContractFactory;
let gasCollector: GasCollector;
let balanceFetcher: BalanceFetcher;

let agentNft: Agents;
let factory01: AgentFactory01;
let factory02: AgentFactory02;
let factory03: AgentFactory03;
let accountImplBase: BlastAgentAccount; // the base implementation for agentfi accounts
let accountImplRingC: BlastAgentAccountRingProtocolC;
let accountImplRingD: BlastAgentAccountRingProtocolD;

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

  await deployAgentsNft();

  await deployAgentFactory01();
  await deployAgentFactory02();
  await deployAgentFactory03();
  await deployBlastAgentAccount();
  await deployBlastAgentAccountRingProtocolC();
  await deployBlastAgentAccountRingProtocolD();

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
    let args = [agentfideployer.address, BLAST_ADDRESS, gasCollector.address];
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

async function deployAgentsNft() {
  if(await isDeployed(AGENT_NFT_ADDRESS)) {
    agentNft = await ethers.getContractAt("Agents", AGENT_NFT_ADDRESS, agentfideployer) as Agents;
  } else {
    console.log("Deploying Agents NFT");
    let args = [agentfideployer.address, BLAST_ADDRESS, gasCollector.address, ERC6551_REGISTRY_ADDRESS];
    agentNft = await deployContractUsingContractFactory(agentfideployer, "Agents", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as Agents;
    console.log(`Deployed Agents NFT to ${agentNft.address}`);
    if(chainID != 31337) await verifyContract(agentNft.address, args);
    if(!!AGENT_NFT_ADDRESS && agentNft.address != AGENT_NFT_ADDRESS) throw new Error(`Deployed Agents NFT to ${agentNft.address}, expected ${AGENT_NFT_ADDRESS}`)
  }
}

async function deployAgentFactory01() {
  if(await isDeployed(AGENT_FACTORY01_ADDRESS)) {
    factory01 = await ethers.getContractAt("AgentFactory01", AGENT_FACTORY01_ADDRESS, agentfideployer) as AgentFactory01;
  } else {
    console.log("Deploying AgentFactory01");
    let args = [agentfideployer.address, BLAST_ADDRESS, gasCollector.address, agentNft.address];
    factory01 = await deployContractUsingContractFactory(agentfideployer, "AgentFactory01", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as AgentFactory01;
    console.log(`Deployed AgentFactory01 to ${factory01.address}`);
    if(chainID != 31337) await verifyContract(factory01.address, args);
    if(!!AGENT_FACTORY01_ADDRESS && factory01.address != AGENT_FACTORY01_ADDRESS) throw new Error(`Deployed AgentFactory01 to ${factory01.address}, expected ${AGENT_FACTORY01_ADDRESS}`)
  }
}

async function deployAgentFactory02() {
  if(await isDeployed(AGENT_FACTORY02_ADDRESS)) {
    factory02 = await ethers.getContractAt("AgentFactory02", AGENT_FACTORY02_ADDRESS, agentfideployer) as AgentFactory02;
  } else {
    console.log("Deploying AgentFactory02");
    let args = [agentfideployer.address, BLAST_ADDRESS, gasCollector.address, agentNft.address];
    factory02 = await deployContractUsingContractFactory(agentfideployer, "AgentFactory02", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as AgentFactory02;
    console.log(`Deployed AgentFactory02 to ${factory02.address}`);
    if(chainID != 31337) await verifyContract(factory02.address, args);
    if(!!AGENT_FACTORY02_ADDRESS && factory02.address != AGENT_FACTORY02_ADDRESS) throw new Error(`Deployed AgentFactory02 to ${factory02.address}, expected ${AGENT_FACTORY02_ADDRESS}`)
  }
}

async function deployAgentFactory03() {
  if(await isDeployed(AGENT_FACTORY03_ADDRESS)) {
    factory03 = await ethers.getContractAt("AgentFactory03", AGENT_FACTORY03_ADDRESS, agentfideployer) as AgentFactory03;
  } else {
    console.log("Deploying AgentFactory03");
    let args = [agentfideployer.address, BLAST_ADDRESS, gasCollector.address, agentNft.address];
    factory03 = await deployContractUsingContractFactory(agentfideployer, "AgentFactory03", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as AgentFactory03;
    console.log(`Deployed AgentFactory03 to ${factory03.address}`);
    if(chainID != 31337) await verifyContract(factory03.address, args);
    if(!!AGENT_FACTORY03_ADDRESS && factory03.address != AGENT_FACTORY03_ADDRESS) throw new Error(`Deployed AgentFactory03 to ${factory03.address}, expected ${AGENT_FACTORY03_ADDRESS}`)
  }
}

async function deployBlastAgentAccount() {
  if(await isDeployed(ACCOUNT_IMPL_BASE_ADDRESS)) {
    accountImplBase = await ethers.getContractAt("BlastAgentAccount", ACCOUNT_IMPL_BASE_ADDRESS, agentfideployer) as BlastAgentAccount;
  } else {
    console.log("Deploying BlastAgentAccount");
    let args = [BLAST_ADDRESS, gasCollector.address, ENTRY_POINT_ADDRESS, MULTICALL_FORWARDER_ADDRESS, ERC6551_REGISTRY_ADDRESS, AddressZero];
    accountImplBase = await deployContractUsingContractFactory(agentfideployer, "BlastAgentAccount", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BlastAgentAccount;
    console.log(`Deployed BlastAgentAccount to ${accountImplBase.address}`);
    if(chainID != 31337) await verifyContract(accountImplBase.address, args);
    if(!!ACCOUNT_IMPL_BASE_ADDRESS && accountImplBase.address != ACCOUNT_IMPL_BASE_ADDRESS) throw new Error(`Deployed BlastAgentAccount to ${accountImplBase.address}, expected ${ACCOUNT_IMPL_BASE_ADDRESS}`)
  }
}

async function deployBlastAgentAccountRingProtocolC() {
  if(await isDeployed(ACCOUNT_IMPL_RING_C_ADDRESS)) {
    accountImplRingC = await ethers.getContractAt("BlastAgentAccountRingProtocolC", ACCOUNT_IMPL_RING_C_ADDRESS, agentfideployer) as BlastAgentAccountRingProtocolC;
  } else {
    console.log("Deploying BlastAgentAccountRingProtocolC");
    let args = [BLAST_ADDRESS, gasCollector.address, ENTRY_POINT_ADDRESS, MULTICALL_FORWARDER_ADDRESS, ERC6551_REGISTRY_ADDRESS, AddressZero];
    accountImplRingC = await deployContractUsingContractFactory(agentfideployer, "BlastAgentAccountRingProtocolC", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BlastAgentAccountRingProtocolC;
    console.log(`Deployed BlastAgentAccountRingProtocolC to ${accountImplRingC.address}`);
    if(chainID != 31337) await verifyContract(accountImplRingC.address, args);
    if(!!ACCOUNT_IMPL_RING_C_ADDRESS && accountImplRingC.address != ACCOUNT_IMPL_RING_C_ADDRESS) throw new Error(`Deployed BlastAgentAccountRingProtocolC to ${accountImplRingC.address}, expected ${ACCOUNT_IMPL_RING_C_ADDRESS}`)
  }
}

async function deployBlastAgentAccountRingProtocolD() {
  if(await isDeployed(ACCOUNT_IMPL_RING_D_ADDRESS)) {
    accountImplRingD = await ethers.getContractAt("BlastAgentAccountRingProtocolD", ACCOUNT_IMPL_RING_D_ADDRESS, agentfideployer) as BlastAgentAccountRingProtocolD;
  } else {
    console.log("Deploying BlastAgentAccountRingProtocolD");
    let args = [BLAST_ADDRESS, gasCollector.address, ENTRY_POINT_ADDRESS, MULTICALL_FORWARDER_ADDRESS, ERC6551_REGISTRY_ADDRESS, AddressZero];
    accountImplRingD = await deployContractUsingContractFactory(agentfideployer, "BlastAgentAccountRingProtocolD", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BlastAgentAccountRingProtocolD;
    console.log(`Deployed BlastAgentAccountRingProtocolD to ${accountImplRingD.address}`);
    if(chainID != 31337) await verifyContract(accountImplRingD.address, args);
    if(!!ACCOUNT_IMPL_RING_D_ADDRESS && accountImplRingD.address != ACCOUNT_IMPL_RING_D_ADDRESS) throw new Error(`Deployed BlastAgentAccountRingProtocolD to ${accountImplRingD.address}, expected ${ACCOUNT_IMPL_RING_D_ADDRESS}`)
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
  logContractAddress("AgentsNFT", agentNft.address);
  logContractAddress("Factory01", factory01.address);
  logContractAddress("Factory02", factory02.address);
  logContractAddress("Factory03", factory03.address);
  logContractAddress("BlastAgentAccount", accountImplBase.address);
  logContractAddress("BlastAgentAccountRingProtocolC", accountImplRingC.address);
  logContractAddress("BlastAgentAccountRingProtocolD", accountImplRingD.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
