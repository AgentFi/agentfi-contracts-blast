import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const blasttestnetuser3 = new ethers.Wallet(accounts.blasttestnetuser3.key, provider);
const agentfideployer = new ethers.Wallet(accounts.agentfideployer.key, provider);

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

let mcProvider = new MulticallProvider(provider, 168587773);

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";
const ENTRY_POINT_ADDRESS             = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const MULTICALL_FORWARDER_ADDRESS     = "0x1740c3552c5f1Bd304fab433C977375357B5Bd7c";
const CONTRACT_FACTORY_ADDRESS        = "0xA74500382CAb2EBFe9A08dc2c01430821A4A8E15"; // v0.1.3

const GAS_COLLECTOR_ADDRESS           = "0x0311b9696907AdC2093448678cf080adA1368d00"; // V0.1.3
const BALANCE_FETCHER_ADDRESS         = "0xb646F462A89799d910b1dc330BA1DA9dE763c931"; // v0.1.3

const AGENT_NFT_ADDRESS               = "0xA1E88Ac5DBA42116eDd02987aed8880AbA38d112"; // v0.1.3
const ACCOUNT_IMPL_BROKEN_ADDRESS     = "0xB51A0d4ea00AAf80B5A1d7bCf3e361BDe68EF7c8"; // v0.1.3

const AGENT_FACTORY01_ADDRESS         = "0x9EDa22a1F7Df00A502D164986743933cF787d6Ae"; // v0.1.3
const AGENT_FACTORY02_ADDRESS         = "0x3D6B33A07629D3E120c06419c11b8A1F8714ec40"; // v0.1.3

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

const TOKEN_LIST = [
  ETH_ADDRESS,
  ALL_CLAIMABLE_GAS_ADDRESS,
  MAX_CLAIMABLE_GAS_ADDRESS,
  WETH_ADDRESS,
  USDB_ADDRESS,
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

let agentID5 = 5
let agentAddress5 = "0xbc60487Bd1901C0a6b7D473B64beD855c300457e"
let implAddress5 = "0xeb61E6600f87c07EB40C735B0DF0aedf899C24F6"
let agentOwner = agentfideployer
let accountProxy5: any;

let iblast: IBlast;

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${blasttestnetuser3.address} as blasttestnetuser3`);
  console.log(`Using ${agentfideployer.address} as agentfideployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID == chainid)/* || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName))*/);
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia. Cannot use a local fork");

  accountProxy5 = await ethers.getContractAt("BlastooorAgentAccountRingProtocolC", agentAddress5, agentOwner);
  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, agentOwner) as IBlast;
  balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, agentOwner) as BalanceFetcher;

  await fetchAgentBalances();

  //await useAgent5_1();

  //await useAgent5_6();
  //await useAgent5_7();

  //await mintUSDB()

  //await fetchAgentBalances();
}

// get token balances
async function fetchAgentBalances() {
  console.log("Fetching agent 5 balances")

  let balances = await balanceFetcher.callStatic.fetchBalances(agentAddress5, TOKEN_LIST, {...networkSettings.overrides, gasLimit: 30_000_000})
  for(let i = 0; i < TOKEN_LIST.length; i++) {
    console.log(`${TOKEN_LIST[i]}: ${balances[i].toString()}`)
  }

  var hardcall = false
  if(hardcall) {
    let tx = await balanceFetcher.fetchBalances(agentAddress5, TOKEN_LIST)
    console.log('tx')
    console.log(tx)
    await tx.wait(networkSettings.confirmations)
  }

  console.log("Fetched agent 5 balances")
}

// execute ring protocol c
async function useAgent5_1() {
  console.log("Using agent 5_1")

  let ethAmount1 = WeiPerEther.mul(5).div(1000)
  let ethAmount2 = ethAmount1.mul(9).div(10)
  /*
  let delegatecalldata = accountProxy5.interface.encodeFunctionData("executeRingProtocolModuleB", [ethAmount2])
  let cut = [{
    facetAddress: RING_PROTOCOL_MODULE_B_ADDRESS,
    action: FacetCutAction.Add,
    functionSelectors: sighashes
  }]
  console.log("executing cut")
  //console.log(cut)
  //console.log(RING_PROTOCOL_MODULE_B_ADDRESS)
  //console.log(delegatecalldata)
  let tx = await accountProxy5.connect(agentOwner).diamondCut(cut, RING_PROTOCOL_MODULE_B_ADDRESS, delegatecalldata, {...networkSettings.overrides, value: ethAmount1, gasLimit: 2_000_000}); // and delegatecall
  */
  let tx = await accountProxy5.connect(agentOwner).executeRingProtocolStrategyC(ethAmount2, {...networkSettings.overrides, value: ethAmount1, gasLimit: 2_000_000}); // and delegatecall
  await tx.wait(networkSettings.confirmations)
  console.log("Used agent 5_1")
}

// claim max gas rewards
async function useAgent5_6() {
  console.log("Using agent 5_6")
  //let calldata = iblast.interface.encodeFunctionData("claimMaxGas", [agentAddress5, agentAddress5])
  //let tx = await accountProxy5.connect(agentOwner).execute(BLAST_ADDRESS, 0, calldata, 0, {...networkSettings.overrides, gasLimit:1_000_000})
  let tx = await accountProxy5.connect(agentOwner).claimMaxGas({...networkSettings.overrides, gasLimit:1_000_000})
  //console.log('tx')
  //console.log(tx)
  await tx.wait(networkSettings.confirmations)
  console.log("Used agent 5_6")
}

// claim all gas rewards
async function useAgent5_7() {
  console.log("Using agent 5_7")
  //let calldata = iblast.interface.encodeFunctionData("claimAllGas", [agentAddress5, agentAddress5])
  //let tx = await accountProxy5.connect(agentOwner).execute(BLAST_ADDRESS, 0, calldata, 0, {...networkSettings.overrides, gasLimit:1_000_000})
  let tx = await accountProxy5.connect(agentOwner).claimAllGas({...networkSettings.overrides, gasLimit:1_000_000})
  //console.log('tx')
  //console.log(tx)
  await tx.wait(networkSettings.confirmations)
  console.log("Used agent 5_7")
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
