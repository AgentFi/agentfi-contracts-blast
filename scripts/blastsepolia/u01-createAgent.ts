import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const lmaodeployer = new ethers.Wallet(accounts.lmaodeployer.key, provider);

import { LmaoAgentAccount, LmaoAgentFactory, LmaoAgentNft } from "../../typechain-types";

import { delay } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { getNetworkSettings } from "./../utils/getNetworkSettings";

let networkSettings: any;
let chainID: number;

const fs = require("fs")
const ABI_MULTICALL = JSON.parse(fs.readFileSync("data/abi/other/Multicall3.json").toString())
const ABI_AGENT_NFT = JSON.parse(fs.readFileSync("abi/contracts/agents/LmaoAgentNft.sol/LmaoAgentNft.json").toString())

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";

const AGENT_NFT_ADDRESS               = "0x6Ce4Aa68eeAe0abeC6C3027C51223562B4aC1eE9";
const AGENT_ACCOUNT_IMPL_ADDRESS      = "0x3c8cD1A00C55655b01d30C87F400A570F1Da8f8E";
const AGENT_FACTORY_ADDRESS           = "0x2f1eCf50FAc2329e9C88D80b71f755A731AA6957";

let agentNft: LmaoAgentNft;
let agentAccountImplementation: LmaoAgentAccount;
let agentFactory: LmaoAgentFactory;

async function main() {
  console.log(`Using ${lmaodeployer.address} as lmaodeployer`);
  console.log(`Using ${boombotseth.address} as boombotseth`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID == chainid) || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia or a local fork of Blast Sepolia");
  //await expectDeployed(ERC6551_REGISTRY_ADDRESS)

  agentNft = await ethers.getContractAt("LmaoAgentNft", AGENT_NFT_ADDRESS, lmaodeployer) as LmaoAgentNft;
  agentFactory = await ethers.getContractAt("LmaoAgentFactory", AGENT_FACTORY_ADDRESS, lmaodeployer) as LmaoAgentFactory;

  await listAgents();
  await createAgents();
  await listAgents();
}

async function listAgents() {
  let ts = await agentNft.totalSupply();
  console.log(`Number agents created: ${ts}`);
  if(ts == 0) return;
  console.log("Info:")
  let calls = [] as any[]
  for(let agentID = 1; agentID <= ts; agentID++) {
    calls.push(agentNft.getAgentInfo(agentID))
    calls.push(agentNft.ownerOf(agentID))
  }
  const results = await Promise.all(calls)
  for(let agentID = 1; agentID <= ts; agentID++) {
    console.log(`Agent ID ${agentID}`)
    let agentInfo = results[agentID*2-2]
    let agentAddress = agentInfo.agentAddress
    let implementationAddress = agentInfo.implementationAddress
    let owner = results[agentID*2-1]
    console.log(`  Agent Address      ${agentAddress}`)
    console.log(`  TBA Impl           ${implementationAddress}`)
    console.log(`  Owner              ${owner}`)
  }
}

async function createAgents() {
  await createAgent(lmaodeployer);
  /*
  await createAgent(lmaodeployer);
  await createAgent(boombotseth);
  await createAgent(lmaodeployer);
  await createAgent(boombotseth);
  await createAgent(lmaodeployer);
  await createAgent(boombotseth);
  await createAgent(lmaodeployer);
  await createAgent(boombotseth);
  */
  //await createAgentsMulticall(boombotseth, 3);
  //await createAgentsMulticall(lmaodeployer, 5);
}

async function createAgent(creator=boombotseth) {
  console.log(`Creating new agent`)
  let tx = await agentFactory.connect(creator)['createAgent()']({...networkSettings.overrides, gasLimit: 1_500_000})
  await watchTxForCreatedAgentID(tx)
}

async function createAgentsMulticall(creator=boombotseth, numAgents=5) {
  console.log(`Creating ${numAgents} new agents`)
  let txdata = agentFactory.interface.encodeFunctionData('createAgent()', [])
  let txdatas = [] as any[]
  for(let i = 0; i < numAgents; i++) txdatas.push(txdata)
  let tx = await agentFactory.connect(creator).multicall(txdatas, {...networkSettings.overrides, gasLimit: 1_500_000*numAgents})
  await watchTxForCreatedAgentID(tx)
}

async function watchTxForCreatedAgentID(tx:any) {
  //console.log("tx:", tx);
  let receipt = await tx.wait(networkSettings.confirmations);
  if(!receipt || !receipt.logs || receipt.logs.length == 0) {
    console.log(receipt)
    throw new Error("logs not found");
  }
  let createEvents = (receipt.logs as any).filter((event:any) => {
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
    let agentID = parseInt(createEvent.topics[3])
    console.log(`Created 1 agent. agentID ${agentID}`)
    return agentID
  }
  if(createEvents.length > 1) {
    let agentIDs = createEvents.map((createEvent:any) => parseInt(createEvent.topics[3]))
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
