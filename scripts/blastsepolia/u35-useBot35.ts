import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const blasttestnetuser3 = new ethers.Wallet(accounts.blasttestnetuser3.key, provider);

import { Agents, BlastooorAgentAccount, ModulePack100, AgentFactory01, AgentFactory02, IBlast, BalanceFetcher, MockERC20 } from "../../typechain-types";

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
const ABI_MULTICALL = JSON.parse(fs.readFileSync("data/abi/other/Multicall3.json").toString())

let mcProvider = new MulticallProvider(provider, 168587773);

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";
const ENTRY_POINT_ADDRESS             = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

const CONTRACT_FACTORY_ADDRESS        = "0xA74500382CAb2EBFe9A08dc2c01430821A4A8E15"; // v0.1.2
const GAS_COLLECTOR_ADDRESS           = "0xf67f800486E8B9cC7e4416F329dF56bB43D2B7B4"; // V0.1.2
const BOOM_BOTS_NFT_ADDRESS           = "0x7724cc10B42760d4C624d6b81C4367118194E39B"; // v0.1.2
const ACCOUNT_IMPL_DIAMOND_ADDRESS    = "0x8EA19CA269A3F3A7563F7A098C9C3dC46f4A2448"; // v0.1.2
const MODULE_PACK_102_ADDRESS         = "0xfEC2e1F3c66f181650641eC50a5E131C1f3b4740"; // v0.1.2
const DATA_STORE_ADDRESS              = "0xDFF8DCD5441B1B709cDCB7897dB304041Cc9DE4C"; // v0.1.2
const AGENT_FACTORY01_ADDRESS     = "0x92e795B8D78eA13a564da4F4E03965FBB89cb788"; // v0.1.2
const AGENT_FACTORY02_ADDRESS     = "0x4acb9D0243dF085B4F59683cee2F36597334bDa4"; // v0.1.2
const BALANCE_FETCHER_ADDRESS         = "0x0268efA44785909AAb150Ff00545568351dd25b6"; // v0.1.2
const RING_PROTOCOL_MODULE_B_ADDRESS  = "0x141268a519D42149c6dcA9695d065d91eda66501"; // v0.1.2

const ETH_ADDRESS                = "0x0000000000000000000000000000000000000000";
const ALL_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000001";
const MAX_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000002";
const WETH_ADDRESS               = "0x4200000000000000000000000000000000000023";
const USDB_ADDRESS               = "0x4200000000000000000000000000000000000022";
const USDC_ADDRESS               = "0xF19A5b56b419170Aa2ee49E5c9195F5902D39BF1";
const USDT_ADDRESS               = "0xD8F542D710346DF26F28D6502A48F49fB2cFD19B";
const DAI_ADDRESS                = "0x9C6Fc5bF860A4a012C9De812002dB304AD04F581";
const BOLT_ADDRESS               = "0x1B0cC80F4E2A7d205518A1Bf36de5bED686662FE";
const RGB_ADDRESS                = "0x7647a41596c1Ca0127BaCaa25205b310A0436B4C";
const PRE_BOOM_ADDRESS           = "0xdBa6Cb5a91AE6F0ac3883F3841190c2BFa168f9b"; // v0.1.2

const TOKEN_LIST = [
  ETH_ADDRESS,
  ALL_CLAIMABLE_GAS_ADDRESS,
  MAX_CLAIMABLE_GAS_ADDRESS,
  WETH_ADDRESS,
  USDB_ADDRESS,
  PRE_BOOM_ADDRESS,
  USDC_ADDRESS,
  USDT_ADDRESS,
  DAI_ADDRESS,
  BOLT_ADDRESS,
  RGB_ADDRESS,
]

let agentNft: Agents;
let agentNftMC: any;
let accountImplDiamond: BoomBotDiamondAccount; // the base implementation for agentfi accounts
let modulePack100: ModulePack100;
let dataStore: DataStore;
let factory01: AgentFactory01;
let ringProtocolModuleB: RingProtocolModuleB;
let balanceFetcher: BalanceFetcher;

let abi = getCombinedAbi([
  "artifacts/contracts/accounts/BoomBotDiamondAccount.sol/BoomBotDiamondAccount.json",
  "artifacts/contracts/modules/ModulePack102.sol/ModulePack102.json",
  "artifacts/contracts/modules/RingProtocolModuleB.sol/RingProtocolModuleB.json",
  "artifacts/contracts/libraries/Errors.sol/Errors.json",
])

let agentID35 = 35
let agentAddress35 = "0xA6E8a482c21245A6d574ce05b23b3Dce4292E79F"
let implAddress35 = "0x8EA19CA269A3F3A7563F7A098C9C3dC46f4A2448"
let agentOwner = blasttestnetuser3
let accountProxy6: any;

let iblast: IBlast;

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${blasttestnetuser3.address} as blasttestnetuser3`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID == chainid)/* || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName))*/);
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia. Cannot use a local fork");

  accountProxy6 = await ethers.getContractAt(abi, agentAddress35, agentOwner);
  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, agentOwner) as IBlast;

  ringProtocolModuleB = await ethers.getContractAt("RingProtocolModuleB", RING_PROTOCOL_MODULE_B_ADDRESS, agentOwner) as RingProtocolModuleB;
  balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, agentOwner) as BalanceFetcher;

  await fetchAgentBalances();

  //await useAgent35_1();
  //await useAgent35_2();

  //await useAgent35_6();
  //await useAgent35_7();

  //await mintUSDB()

  //await fetchAgentBalances();
}

// get token balances
async function fetchAgentBalances() {
  console.log("Fetching agent 35 balances")

  let balances = await balanceFetcher.callStatic.fetchBalances(agentAddress35, TOKEN_LIST, {...networkSettings.overrides, gasLimit: 30_000_000})
  for(let i = 0; i < TOKEN_LIST.length; i++) {
    console.log(`${TOKEN_LIST[i]}: ${balances[i].toString()}`)
  }

  var hardcall = false
  if(hardcall) {
    let tx = await balanceFetcher.fetchBalances(agentAddress35, TOKEN_LIST)
    console.log('tx')
    console.log(tx)
    await tx.wait(networkSettings.confirmations)
  }

  console.log("Fetched agent 35 balances")
}

// install and execute ring protocol module a
async function useAgent35_1() {
  console.log("Using agent 35_1")

  /*
  // describe
  console.log("Describing")
  let token = await accountProxy6.token();
  console.log('token')
  console.log(token)
  let owner = await accountProxy6.owner();
  console.log('owner')
  console.log(owner)
  console.log(owner == agentOwner.address)
  */

  let ethAmount1 = WeiPerEther.mul(5).div(1000)
  let ethAmount2 = ethAmount1.mul(9).div(10)
  let sighashes = ['0x25d315e0'] // executeRingProtocolModuleB(uint256)
  let delegatecalldata = accountProxy6.interface.encodeFunctionData("executeRingProtocolModuleB", [ethAmount2])
  let cut = [{
    facetAddress: RING_PROTOCOL_MODULE_B_ADDRESS,
    action: FacetCutAction.Add,
    functionSelectors: sighashes
  }]
  console.log("executing cut")
  //console.log(cut)
  //console.log(RING_PROTOCOL_MODULE_B_ADDRESS)
  //console.log(delegatecalldata)
  let tx = await accountProxy6.connect(agentOwner).diamondCut(cut, RING_PROTOCOL_MODULE_B_ADDRESS, delegatecalldata, {...networkSettings.overrides, value: ethAmount1, gasLimit: 2_000_000}); // and delegatecall
  await tx.wait(networkSettings.confirmations)
  console.log("Used agent 35_1")
}

// execute ring protocol module b
async function useAgent35_2() {
  console.log("Using agent 35_2")
  let ethAmount1 = WeiPerEther.mul(2).div(1000)
  let ethAmount2 = ethAmount1.mul(9).div(10)
  let tx = await accountProxy6.connect(agentOwner).executeRingProtocolModuleB(ethAmount2, {...networkSettings.overrides, value: ethAmount1, gasLimit: 2_000_000});
  await tx.wait(networkSettings.confirmations)
  console.log("Used agent 35_2")
}

// claim max gas rewards
async function useAgent35_6() {
  console.log("Using agent 35_6")
  let calldata = iblast.interface.encodeFunctionData("claimMaxGas", [agentAddress35, agentAddress35])
  let tx = await accountProxy6.connect(agentOwner).execute(BLAST_ADDRESS, 0, calldata, 0, {...networkSettings.overrides, gasLimit:1_000_000})
  //console.log('tx')
  //console.log(tx)
  await tx.wait(networkSettings.confirmations)
  console.log("Used agent 35_6")
}

// claim all gas rewards
async function useAgent35_7() {
  console.log("Using agent 35_7")
  let calldata = iblast.interface.encodeFunctionData("claimAllGas", [agentAddress35, agentAddress35])
  let tx = await accountProxy6.connect(agentOwner).execute(BLAST_ADDRESS, 0, calldata, 0, {...networkSettings.overrides, gasLimit:1_000_000})
  //console.log('tx')
  //console.log(tx)
  await tx.wait(networkSettings.confirmations)
  console.log("Used agent 35_7")
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
