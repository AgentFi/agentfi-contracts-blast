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

let networkSettings: any;
let chainID: number;

const ETH_BRIDGE_ADDRESS = "0xc644cc19d2A9388b71dd1dEde07cFFC73237Dca8"

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${agentfideployer.address} as agentfideployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID == chainid) || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(11155111, "sepolia")) throw("Only run this on Sepolia or a local fork of Sepolia");

  await bridgeEth();
}

async function bridgeEth() {
  console.log("bridging eth")
  let from = boombotseth
  let to = ETH_BRIDGE_ADDRESS
  let value = WeiPerEther.mul(14).div(10)

  let tx = await from.sendTransaction({
    to: to,
    value: value,
    gasLimit: 500_000,
  });
  console.log(tx);
  await tx.wait(networkSettings.confirmations);
  console.log("bridge eth tx sent")
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
