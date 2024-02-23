import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const agentfideployer = new ethers.Wallet(accounts.agentfideployer.key, provider);

import { Agents, BlastAgentAccount, AgentFactory01, AgentFactory02, AgentFactory03 } from "../../typechain-types";

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

const AGENT_NFT_ADDRESS               = "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b"; // v0.1.3

const AGENT_FACTORY01_ADDRESS         = "0x66458d8cE1238C7C7818e7988974F0bd5B373c95"; // v0.1.3
const AGENT_FACTORY02_ADDRESS         = "0x59c11B12a2D11810d1ca4afDc21a9Fc837193f41"; // v0.1.3
const AGENT_FACTORY03_ADDRESS         = "0x3c12E9F1FC3C3211B598aD176385939Ea01deA89"; // v0.1.3

const ACCOUNT_IMPL_BASE_ADDRESS       = "0x25a9aD7766D2857E4EB320a9557F637Bd748b97c"; // v0.1.3
const ACCOUNT_IMPL_RING_C_ADDRESS     = "0xeb61E6600f87c07EB40C735B0DF0aedf899C24F6"; // v0.1.3
const ACCOUNT_IMPL_RING_D_ADDRESS     = "0xD9F32ab36bCB6dD3005038DeB53f9ed742947b64"; // v0.1.3

// tokens
const ETH_ADDRESS                = "0x0000000000000000000000000000000000000000";
const ALL_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000001";
const MAX_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000002";
const WETH_ADDRESS               = "0x4200000000000000000000000000000000000023";

// ring protocol
const UNIVERSAL_ROUTER_ADDRESS   = "0x334e3F7f5A9740627fA47Fa9Aa51cE0ccbD765cF";
const FEW_ROUTER_ADDRESS         = "0x02F1e7A518e3E286C8E305E39cA7D4f25e0a44Aa";
const STAKING_REWARDS_ADDRESS    = "0x366Ac78214aFE145Ca35d4A6513F4eD9e8909Fe8";
const USDB_ADDRESS               = "0x4200000000000000000000000000000000000022";
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

let agentNft: Agents;
let agentNftMC: any;
let factory01: AgentFactory01;
let factory02: AgentFactory02;
let factory03: AgentFactory02;
let accountImplBase: BlastAgentAccount; // the base implementation for agentfi accounts
let accountImplRingC: BlastAgentAccountRingProtocolC;

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
  factory03 = await ethers.getContractAt("AgentFactory03", AGENT_FACTORY03_ADDRESS, boombotseth) as AgentFactory03;
  accountImplBase = await ethers.getContractAt("BlastAgentAccount", ACCOUNT_IMPL_BASE_ADDRESS, agentfideployer) as BlastAgentAccount;
  accountImplRingC = await ethers.getContractAt("BlastAgentAccountRingProtocolC", ACCOUNT_IMPL_RING_C_ADDRESS, agentfideployer) as BlastAgentAccountRingProtocolC;

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
  //await createAgent(agentfideployer, 1);
  //await createAgent(agentfideployer, 2);
  //await createAgent(agentfideployer, 3);
  //await createAgent(agentfideployer, 4);

  //await createCustomAgent2(agentfideployer);
  await createCustomAgent4(agentfideployer);

  //await createAgent(agentfideployer, 5);
  //await createAgent(agentfideployer, 6);
  //await createAgent(agentfideployer, 7);
  //await createAgent(agentfideployer, 8);
  //await createAgent(agentfideployer, 9);
  //await createCustomAgent1(agentfideployer, 9);
}

async function createAgent(creator=boombotseth, createSettingsID=1) {
  console.log(`Creating new agent`)
  //let tx = await factory01.connect(creator)['createAgent(uint256)'](createSettingsID, {...networkSettings.overrides, gasLimit: 2_000_000})
  let tx = await factory03.connect(creator)['createAgent(uint256)'](createSettingsID, {...networkSettings.overrides, gasLimit: 2_000_000})
  await watchTxForCreatedAgentID(tx)
}

async function createAgentsMulticall(creator=boombotseth, numAgents=5, createSettingsID=1) {
  console.log(`Creating ${numAgents} new agents`)
  let txdata = factory01.interface.encodeFunctionData('createAgent(uint256)', [createSettingsID])
  let txdatas = [] as any[]
  for(let i = 0; i < numAgents; i++) txdatas.push(txdata)
  //let tx = await factory01.connect(creator).multicall(txdatas, {...networkSettings.overrides, gasLimit: 2_000_000*numAgents})
  let tx = await factory03.connect(creator).multicall(txdatas, {...networkSettings.overrides, gasLimit: 2_000_000*numAgents})
  await watchTxForCreatedAgentID(tx)
}

async function createCustomAgent1(creator=boombotseth, createSettingsID=1) {
  console.log(`Creating new agent`)
  //let tx = await factory01.connect(creator)['createAgent(uint256)'](createSettingsID, {...networkSettings.overrides, gasLimit: 2_000_000})
  let tx = await factory03.connect(creator)['createAgent(uint256)'](createSettingsID, {...networkSettings.overrides, gasLimit: 2_000_000,value:WeiPerEther.div(1000)})
  await watchTxForCreatedAgentID(tx)
}

async function createCustomAgent2(creator=boombotseth) {
  console.log(`Creating new agent`)
  //let tx = await factory01.connect(creator)['createAgent(uint256)'](createSettingsID, {...networkSettings.overrides, gasLimit: 2_000_000})
  let createSettingsIDRoot = 1
  let createSettingsIDChild = 4
  let calldata0 = factory03.interface.encodeFunctionData('createAgent(uint256)', [createSettingsIDChild])
  let calldata1 = accountImplBase.interface.encodeFunctionData('execute', [factory03.address, 0, calldata0, 0])
  let calldatas = [calldata1]
  let tx = await factory03.connect(creator)['createAgent(uint256,bytes[])'](createSettingsIDRoot, calldatas, {...networkSettings.overrides, gasLimit: 2_000_000})
  await watchTxForCreatedAgentID(tx)
}

async function createCustomAgent4(creator=boombotseth) {
  console.log(`Creating new agent`)
  let createSettingsIDRoot = 1
  let createSettingsIDChild = 4
  let ethAmount = WeiPerEther.div(100)
  let deposits = [
    {
      token: AddressZero,
      amount: ethAmount
    }
  ]
  let calldata0 = factory03.interface.encodeFunctionData('createAgent(uint256,(address,uint256)[])', [createSettingsIDChild, deposits])
  let calldata1 = accountImplBase.interface.encodeFunctionData('execute', [factory03.address, ethAmount, calldata0, 0])
  let calldatasOuter = [calldata1]
  let tx = await factory03.connect(creator)['createAgent(uint256,bytes[],(address,uint256)[])'](createSettingsIDRoot, calldatasOuter, deposits, {...networkSettings.overrides, gasLimit: 3_000_000, value:ethAmount})
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
