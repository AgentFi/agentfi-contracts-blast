import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const agentfideployer = new ethers.Wallet(accounts.agentfideployer.key, provider);

import { Agents, BlastAgentAccount, ModulePack100, AgentFactory01, AgentFactory02 } from "../../typechain-types";

import { delay } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/setStorage";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../utils/diamond"
import { MulticallProvider, MulticallContract } from "./../utils/multicall";
import { multicallChunked } from "./../utils/network";

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;

let networkSettings: any;
let chainID: number;

const fs = require("fs")
const ABI_AGENTS_NFT = JSON.parse(fs.readFileSync("abi/contracts/tokens/Agents.sol/Agents.json").toString()).filter(x=>!!x&&x.type=="function")
let mcProvider = new MulticallProvider(provider, 168587773);

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";
const ENTRY_POINT_ADDRESS             = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const MULTICALL_FORWARDER_ADDRESS     = "0x1740c3552c5f1Bd304fab433C977375357B5Bd7c";
const CONTRACT_FACTORY_ADDRESS        = "0xA74500382CAb2EBFe9A08dc2c01430821A4A8E15"; // v0.1.3

const GAS_COLLECTOR_ADDRESS           = "0x0311b9696907AdC2093448678cf080adA1368d00"; // V0.1.3
const BALANCE_FETCHER_ADDRESS         = "0xb646F462A89799d910b1dc330BA1DA9dE763c931"; // v0.1.3

const AGENT_NFT_ADDRESS               = "0xA1E88Ac5DBA42116eDd02987aed8880AbA38d112"; // v0.1.3
const ACCOUNT_IMPL_BASE_ADDRESS       = "0xB51A0d4ea00AAf80B5A1d7bCf3e361BDe68EF7c8"; // v0.1.3

const AGENT_FACTORY01_ADDRESS         = "0x9EDa22a1F7Df00A502D164986743933cF787d6Ae"; // v0.1.3
const AGENT_FACTORY02_ADDRESS         = "0x3D6B33A07629D3E120c06419c11b8A1F8714ec40"; // v0.1.3

let agentNft: Agents;
let agentNftMC: any;
let accountImplDiamond: BoomBotDiamondAccount; // the base implementation for agentfi accounts
let modulePack100: ModulePack100;
let dataStore: DataStore;
let factory01: AgentFactory01;
let factory02: AgentFactory02;

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${agentfideployer.address} as agentfideployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID == chainid)/* || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName))*/);
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia. Cannot use a local fork");

  agentNft = await ethers.getContractAt("Agents", AGENT_NFT_ADDRESS, boombotseth) as Agents;
  agentNftMC = new MulticallContract(AGENT_NFT_ADDRESS, ABI_AGENTS_NFT)
  factory01 = await ethers.getContractAt("AgentFactory01", AGENT_FACTORY01_ADDRESS, boombotseth) as AgentFactory01;
  factory02 = await ethers.getContractAt("AgentFactory02", AGENT_FACTORY02_ADDRESS, boombotseth) as AgentFactory02;

  await listAgents();
  await createAgents();
  await listAgents();
}

async function listAgents() {
  let ts = (await agentNft.totalSupply()).toNumber();
  console.log(`Number agents created: ${ts}`);
  if(ts == 0) return;
  console.log("Info:")
  let calls = [] as any[]
  for(let agentID = 1; agentID <= ts; agentID++) {
    calls.push(agentNftMC.getAgentInfo(agentID))
    calls.push(agentNftMC.ownerOf(agentID))
  }
  const results = await multicallChunked(mcProvider, calls, "latest", 200)
  for(let agentID = 1; agentID <= ts; agentID++) {
    console.log(`Agent ID ${agentID}`)
    let agentInfo = results[agentID*2-2]
    let agentAddress = agentInfo.agentAddress
    let implementationAddress = agentInfo.implementationAddress
    let owner = results[agentID*2-1]
    console.log(`  Agent Address  ${agentAddress}`)
    console.log(`  TBA Impl       ${implementationAddress}`)
    console.log(`  Owner          ${owner}`)
  }
}

async function createAgents() {
  //await createAgent(agentfideployer, 2);
  //await createAgent(agentfideployer, 4);
  //await createAgent(agentfideployer, 5);
  //await createAgent(agentfideployer, 6);
  await createAgent(agentfideployer, 7);
  //await createAgent(boombotseth, 4);
  //await createAgent(agentfideployer, 2);
  /*
  await createAgent(agentfideployer);
  await createAgent(boombotseth);
  await createAgent(agentfideployer);
  await createAgent(boombotseth);
  await createAgent(agentfideployer);
  await createAgent(boombotseth);
  await createAgent(agentfideployer);
  await createAgent(boombotseth);
  */
  //await createAgentsMulticall(boombotseth, 5);
  //await createAgentsMulticall(agentfideployer, 5);
}

async function createAgent(creator=boombotseth, createSettingsID=1) {
  console.log(`Creating new agent`)
  //let tx = await factory01.connect(creator)['createAgent(uint256)'](createSettingsID, {...networkSettings.overrides, gasLimit: 2_000_000})
  let tx = await factory02.connect(creator)['createAgent(uint256)'](createSettingsID, {...networkSettings.overrides, gasLimit: 2_000_000})
  await watchTxForCreatedAgentID(tx)
}

async function createAgentsMulticall(creator=boombotseth, numAgents=5, createSettingsID=1) {
  console.log(`Creating ${numAgents} new agents`)
  let txdata = factory01.interface.encodeFunctionData('createAgent(uint256)', [createSettingsID])
  let txdatas = [] as any[]
  for(let i = 0; i < numAgents; i++) txdatas.push(txdata)
  //let tx = await factory01.connect(creator).multicall(txdatas, {...networkSettings.overrides, gasLimit: 2_000_000*numAgents})
  let tx = await factory02.connect(creator).multicall(txdatas, {...networkSettings.overrides, gasLimit: 2_000_000*numAgents})
  await watchTxForCreatedAgentID(tx)
}

async function watchTxForCreatedAgentID(tx:any) {
  console.log("tx:", tx);
  let receipt = await tx.wait(networkSettings.confirmations);
  if(!receipt || !receipt.events || receipt.events.length == 0) {
    console.log(receipt)
    throw new Error("events not found");
  }
  let createEvents = (receipt.events as any).filter((event:any) => {
    if(event.address != AGENT_NFT_ADDRESS) return false
    if(event.topics.length != 4) return false;
    if(event.topics[0] != "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") return false // transfer topic
    if(event.topics[1] != "0x0000000000000000000000000000000000000000000000000000000000000000") return false // from address zero
    return true
  });
  if(createEvents.length == 0) {
    throw new Error("Create event not detected")
  }
  if(createEvents.length == 1) {
    let createEvent = createEvents[0]
    let agentID = BN.from(createEvent.topics[3]).toNumber()
    console.log(`Created 1 agent. agentID ${agentID}`)
    return agentID
  }
  if(createEvents.length > 1) {
    let agentIDs = createEvents.map((createEvent:any) => BN.from(createEvent.topics[3]).toNumber())
    console.log(`Created ${agentIDs.length} agents. Agent IDs ${agentIDs.join(', ')}`)
    return agentIDs
  }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
