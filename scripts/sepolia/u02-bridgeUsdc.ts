import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const blasttestnetuser2 = new ethers.Wallet(accounts.blasttestnetuser2.key, provider);

import { MockERC20 } from "../../typechain-types";

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
const { formatUnits } = ethers.utils;

let networkSettings: any;
let chainID: number;

const fs = require("fs")

const ABI_MULTICALL = JSON.parse(fs.readFileSync("data/abi/other/Multicall3.json").toString())
const ABI_BRIDGE = JSON.parse(fs.readFileSync("data/abi/Blast/BlastBridge.json").toString())

const MULTICALL_ADDRESS = "0xa5b8c45025dA78cF9D27D3263581841663E71A04" // on sepolia

const USDB_ADDRESS   = "0x4200000000000000000000000000000000000022" // on blast sepolia
const USDC_ADDRESS   = "0x7f11f79DEA8CE904ed0249a23930f2e59b43a385" // on sepolia

const BRIDGE_ADDRESS = "0xc644cc19d2A9388b71dd1dEde07cFFC73237Dca8" // usdb bridge on sepolia
//const BRIDGE_ADDRESS = "0xDeDa8D3CCf044fE2A16217846B6e1f1cfD8e122f" // generic erc20 bridge on sepolia

let usdc: MockERC20;
let bridge: any;
let multicallContract: any;

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${blasttestnetuser2.address} as blasttestnetuser2`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID == chainid) || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(11155111, "sepolia")) throw("Only run this on Sepolia or a local fork of Sepolia");

  usdc = await ethers.getContractAt("MockERC20", USDC_ADDRESS, boombotseth) as MockERC20;
  bridge = await ethers.getContractAt(ABI_BRIDGE, BRIDGE_ADDRESS, boombotseth);
  multicallContract = await ethers.getContractAt(ABI_MULTICALL, MULTICALL_ADDRESS, boombotseth);

  //await mintTokens();
  await bridgeTokens();
}

async function mintTokens() {
  console.log("Minting USDC")
  //let tx = await usdc.mint(boombotseth.address, WeiPerEther.mul(10_000), networkSettings.overrides)
  let call = {
    target: USDC_ADDRESS,
    callData: usdc.interface.encodeFunctionData("mint", [boombotseth.address, WeiPerEther.mul(10_000)]),
  }
  let iters = 100
  let calls = []
  for(let i = 0; i < iters; i++) calls.push(call)
  let tx = await multicallContract.aggregate(calls, {...networkSettings.overrides, gasLimit: 60_000 + 25_000*iters})
  console.log('tx')
  console.log(tx)
  await tx.wait(networkSettings.confirmations)
  console.log("Minted USDC")
  console.log(`Balance: ${formatUnits(await usdc.balanceOf(boombotseth.address))}`)
}

async function bridgeTokens() {
  console.log("Bridging USDC")

  let balance = await usdc.balanceOf(boombotseth.address)
  //balance = balance.div(3)
  console.log(`Bridging ${formatUnits(balance)} USDC`)
  if(balance.eq(0)) throw new Error("need to mint first")

  let allowance = await usdc.allowance(boombotseth.address, BRIDGE_ADDRESS)
  if(allowance.lt(balance)) {
    console.log("Approving USDC")
    let tx = await usdc.approve(BRIDGE_ADDRESS, MaxUint256, networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log("Approved USDC")
  }

  let tx = await bridge.bridgeERC20(USDC_ADDRESS, USDB_ADDRESS, balance, 500_000, "0x", {...networkSettings.overrides, gasLimit: 500_000})
  console.log('tx')
  console.log(tx)
  await tx.wait(networkSettings.confirmations)

  console.log("Bridged USDC")
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
