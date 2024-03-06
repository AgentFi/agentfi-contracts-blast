import "dotenv/config"
import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;

import { isDeployed } from "./../utils/expectDeployed";
import { deployContract, verifyContract } from "./../utils/deployContract";

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const agentfideployer = new ethers.Wallet(accounts.agentfideployer.key, provider);

import { getNetworkSettings } from "../utils/getNetworkSettings";
import { AgentFetcher } from "../../typechain-types";


let networkSettings: any;
let chainID: number;

const AGENT_FETCHER_ADDRESS           = "0x777d88f2161E5D7Ece4e21cc125B2E35c237ddaA";

async function main() {
  console.log(`Using ${agentfideployer.address} as agentfideployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia or a local fork of Blast Sepolia");

  await deployAgentFetcher();
}

async function deployAgentFetcher() {
  if(await isDeployed(AGENT_FETCHER_ADDRESS)) {
     await ethers.getContractAt("AgentFetcher", AGENT_FETCHER_ADDRESS, agentfideployer) as AgentFetcher;
  } else {
    console.log("Deploying AgentFetcher");
    const args: any[] = [];
    const agentFetcher = await deployContract(agentfideployer, "AgentFetcher", args,  {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as AgentFetcher;
    console.log(`Deployed AgentFetch to ${agentFetcher.address}`);
    if(chainID != 31337) await verifyContract(agentFetcher.address, args);
    if(!!AGENT_FETCHER_ADDRESS && agentFetcher.address != AGENT_FETCHER_ADDRESS) throw new Error(`Deployed AgentFetcher to ${agentFetcher.address}, expected ${AGENT_FETCHER_ADDRESS}`)
  }
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
