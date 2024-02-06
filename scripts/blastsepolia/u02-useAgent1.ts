import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const lmaodeployer = new ethers.Wallet(accounts.lmaodeployer.key, provider);
const blasttestnetuser2 = new ethers.Wallet(accounts.blasttestnetuser2.key, provider);

import { LmaoAgentAccount, LmaoAgentFactory, LmaoAgentNft } from "../../typechain-types";

import { delay } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { getNetworkSettings } from "./../utils/getNetworkSettings";

const { WeiPerEther } = ethers;

let networkSettings: any;
let chainID: number;

const fs = require("fs")
const ABI_MULTICALL = JSON.parse(fs.readFileSync("data/abi/other/Multicall3.json").toString())
const ABI_AGENT_NFT = JSON.parse(fs.readFileSync("abi/contracts/agents/LmaoAgentNft.sol/LmaoAgentNft.json").toString())
const ABI_AGENT_TBA = JSON.parse(fs.readFileSync("abi/contracts/agents/LmaoAgentAccount.sol/LmaoAgentAccount.json").toString())

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
  console.log(`Using ${blasttestnetuser2.address} as blasttestnetuser2`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID == chainid)/* || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName))*/);
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia. Cannot use a local fork");

  //await useAgent1_1();
  await useAgent1_2();
}

async function useAgent1_1() {
  console.log("Using agent 1_1")
  let agentAddress1 = "0x67f0DC0A76e20B3b059b85465f48CA15dc9947DF"
  let agentAddress2 = "0x09C94cd94b99D3251cBA67e5eA728e4C6275B13A"
  let agent1Account = await ethers.getContractAt(ABI_AGENT_TBA, agentAddress1, lmaodeployer);
  let tx = await agent1Account.execute(agentAddress2, WeiPerEther / 1000n, "0x", 0, {...networkSettings.overrides, gasLimit:1_000_000, value: WeiPerEther * 3n / 1000n})
  console.log('tx')
  console.log(tx)
  await tx.wait(networkSettings.confirmations)
  console.log("Used agent 1_1")
}

// create a new agent, nested within the first agent
async function useAgent1_2() {
  console.log("Using agent 1_2")
  let agentAddress1 = "0x67f0DC0A76e20B3b059b85465f48CA15dc9947DF"
  let agent1Account = await ethers.getContractAt(ABI_AGENT_TBA, agentAddress1, lmaodeployer);
  let calldata = "0x457e8e1e"
  let tx = await agent1Account.execute(AGENT_FACTORY_ADDRESS, 0, calldata, 0, {...networkSettings.overrides, gasLimit:1_000_000})
  console.log('tx')
  console.log(tx)
  await tx.wait(networkSettings.confirmations)
  console.log("Used agent 1_2")
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
