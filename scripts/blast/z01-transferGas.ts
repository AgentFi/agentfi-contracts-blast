import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const agentfideployer = new ethers.Wallet(accounts.agentfideployer.key, provider);
const blasttestnetuser3 = new ethers.Wallet(accounts.blasttestnetuser3.key, provider);
const hydrogendefieth = new ethers.Wallet(accounts.hydrogendefieth.key, provider);

import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { MockERC20 } from "../../typechain-types";

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;
const { formatUnits } = ethers.utils;

let networkSettings: any;
let chainID: number;

let factorydeployer = "0x869B1283d487c61EbE3f198038688e24380d5D31"

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${agentfideployer.address} as agentfideployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(81457, "blast")) throw("Only run this on Blast Mainnet or a local fork of Blast Mainnet");

  await getEthBalance(accounts.boombotseth.address, 'boombotseth');
  await getEthBalance(accounts.agentfideployer.address, 'agentfideployer');
  await getEthBalance(factorydeployer, 'factorydeployer');

  await transfer();

  await getEthBalance(accounts.boombotseth.address, 'boombotseth');
  await getEthBalance(accounts.agentfideployer.address, 'agentfideployer');
  await getEthBalance(factorydeployer, 'factorydeployer');
}

async function getEthBalance(address:string, name:string) {
  let bal = await provider.getBalance(address);
  console.log(`${name} balance: ${formatUnits(bal)} ETH`)
}

async function transfer() {
  console.log("transferring eth")
  let from = boombotseth
  let to = accounts.agentfideployer.address
  let value = WeiPerEther.mul(12).div(100)

  let tx = await from.sendTransaction({
    to: to,
    value: value,
    gasLimit: 21000,
  });
  console.log(tx);
  await tx.wait(networkSettings.confirmations);
  console.log("transferred eth")
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
