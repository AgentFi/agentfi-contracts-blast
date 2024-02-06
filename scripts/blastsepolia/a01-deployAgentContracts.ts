import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const lmaodeployer = new ethers.Wallet(accounts.lmaodeployer.key, provider);

import { LmaoAgentAccount, LmaoAgentFactory, LmaoAgentNft } from "../../typechain-types";

import { delay } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/strings";

const { ZeroAddress, WeiPerEther, MaxUint256 } = ethers

let networkSettings: any;
let chainID: number;

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";

const AGENT_NFT_ADDRESS               = "0x6Ce4Aa68eeAe0abeC6C3027C51223562B4aC1eE9";
const AGENT_ACCOUNT_IMPL_ADDRESS      = "0x3c8cD1A00C55655b01d30C87F400A570F1Da8f8E";
const AGENT_FACTORY_ADDRESS           = "0x2f1eCf50FAc2329e9C88D80b71f755A731AA6957";

let agentNft: LmaoAgentNft;
let agentAccountImplementation: LmaoAgentAccount;
let agentFactory: LmaoAgentFactory;

async function main() {
  console.log(`Using ${lmaodeployer.address} as lmaodeployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID == chainid) || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia or a local fork of Blast Sepolia");
  //await expectDeployed(ERC6551_REGISTRY_ADDRESS)

  await deployLmaoAgentNft();
  await deployLmaoAgentAccount();
  await deployLmaoAgentFactory();
  await whitelistFactories();
  //await setNftMetadata();

  await logAddresses();
}

async function deployLmaoAgentNft() {
  if(await isDeployed(AGENT_NFT_ADDRESS)) {
    agentNft = await ethers.getContractAt("LmaoAgentNft", AGENT_NFT_ADDRESS, lmaodeployer) as LmaoAgentNft;
    agentNft.address = agentNft.target
  } else {
    console.log("Deploying LmaoAgentNft");
    let args = [ERC6551_REGISTRY_ADDRESS, lmaodeployer.address];
    agentNft = await deployContractUsingContractFactory(lmaodeployer, "LmaoAgentNft", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as LmaoAgentNft;
    console.log(`Deployed LmaoAgentNft to ${agentNft.address}`);
    if(chainID != 31337) await verifyContract(agentNft.address, args);
    if(!!AGENT_NFT_ADDRESS && agentNft.address != AGENT_NFT_ADDRESS) throw new Error(`Deployed LmaoAgentNft to ${agentNft.address}, expected ${AGENT_NFT_ADDRESS}`)
  }
}

async function deployLmaoAgentAccount() {
  if(await isDeployed(AGENT_ACCOUNT_IMPL_ADDRESS)) {
    agentAccountImplementation = await ethers.getContractAt("LmaoAgentAccount", AGENT_ACCOUNT_IMPL_ADDRESS, lmaodeployer) as LmaoAgentAccount;
    agentAccountImplementation.address = agentAccountImplementation.target
  } else {
    console.log("Deploying LmaoAgentAccount");
    const badcode = "0x000000000000000000000000000000000baDC0DE"
    let args = [badcode, badcode, ERC6551_REGISTRY_ADDRESS, badcode];
    agentAccountImplementation = await deployContractUsingContractFactory(lmaodeployer, "LmaoAgentAccount", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as LmaoAgentAccount;
    console.log(`Deployed LmaoAgentAccount to ${agentAccountImplementation.address}`);
    if(chainID != 31337) await verifyContract(agentAccountImplementation.address, args);
    if(!!AGENT_ACCOUNT_IMPL_ADDRESS && agentAccountImplementation.address != AGENT_ACCOUNT_IMPL_ADDRESS) throw new Error(`Deployed LmaoAgentAccount to ${agentAccountImplementation.address}, expected ${AGENT_ACCOUNT_IMPL_ADDRESS}`)
  }
}

async function deployLmaoAgentFactory() {
  if(await isDeployed(AGENT_FACTORY_ADDRESS)) {
    agentFactory = await ethers.getContractAt("LmaoAgentFactory", AGENT_FACTORY_ADDRESS, lmaodeployer) as LmaoAgentFactory;
    agentFactory.address = agentFactory.target
  } else {
    console.log("Deploying LmaoAgentFactory");
    let botInitializationCode1 = "0x"
    let botInitializationCode2 = "0x"
    let args = [
      lmaodeployer.address,
      agentNft.address,
      agentAccountImplementation.address,
      botInitializationCode1,
      botInitializationCode2,
    ];
    agentFactory = await deployContractUsingContractFactory(lmaodeployer, "LmaoAgentFactory", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as LmaoAgentFactory;
    console.log(`Deployed LmaoAgentFactory to ${agentFactory.address}`);
    if(chainID != 31337) await verifyContract(agentFactory.address, args);
    if(!!AGENT_FACTORY_ADDRESS && agentFactory.address != AGENT_FACTORY_ADDRESS) throw new Error(`Deployed LmaoAgentFactory to ${agentFactory.address}, expected ${AGENT_FACTORY_ADDRESS}`)
  }
}

async function whitelistFactories() {
  let isWhitelisted = await agentNft.connect(lmaodeployer).factoryIsWhitelisted(agentFactory.address)
  if(!isWhitelisted) {
    console.log("Whitelisting factories")
    let tx = await agentNft.connect(lmaodeployer).setWhitelist([
      {
        factory: agentFactory.address,
        shouldWhitelist: true,
      }
    ], networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log("Whitelisted factories")
  }
}

async function setNftMetadata() {
  let txdatas = [] as any[]
  let desiredContractURI = "https://stats-cdn.lmaolabs.xyz/agentNftContractURI.json"
  let desiredBaseURI = "https://stats.lmaolabs.xyz/agents/metadata/?chainID=168587773&v=0.1.0&agentID="
  let currentContractURI = await agentNft.contractURI()
  let currentBaseURI = await agentNft.baseURI()
  if(currentContractURI != desiredContractURI) {
    txdatas.push(agentNft.interface.encodeFunctionData("setContractURI", [desiredContractURI]))
  }
  if(currentBaseURI != desiredBaseURI) {
    txdatas.push(agentNft.interface.encodeFunctionData("setBaseURI", [desiredBaseURI]))
  }
  if(txdatas.length == 0) return
  var tx
  console.log("Setting NFT metadata");
  if(txdatas.length == 1) {
    tx = await lmaodeployer.sendTransaction({
      to: agentNft.address,
      data: txdatas[0],
      ...networkSettings.overrides,
      gasLimit: 1_000_000
    })
  } else { // length > 1
    tx = await agentNft.multicall(txdatas, {...networkSettings.overrides, gasLimit: 1_000_000});
  }
  console.log("tx:", tx);
  await tx.wait(networkSettings.confirmations);
  console.log("Set NFT metadata");
}

async function logAddresses() {
  console.log("");
  console.log("| Contract Name                | Address                                      |");
  console.log("|------------------------------|----------------------------------------------|");
  logContractAddress("ERC6551Registry", ERC6551_REGISTRY_ADDRESS);
  logContractAddress("LmaoAgentNft", agentNft.address);
  logContractAddress("LmaoAgentAccount", agentAccountImplementation.address);
  logContractAddress("LmaoAgentFactory", agentFactory.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
