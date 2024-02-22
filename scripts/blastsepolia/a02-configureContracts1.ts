import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const agentfideployer = new ethers.Wallet(accounts.agentfideployer.key, provider);
const blasttestnetuser1 = new ethers.Wallet(accounts.blasttestnetuser1.key, provider);

import { Agents, BlastAgentAccount, AgentFactory01, AgentFactory02, IBlast, ContractFactory, GasCollector, BalanceFetcher } from "../../typechain-types";

import { delay, deduplicateArray } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/setStorage";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;
const { formatUnits } = ethers.utils;

let networkSettings: any;
let chainID: number;

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";
const ENTRY_POINT_ADDRESS             = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const MULTICALL_FORWARDER_ADDRESS     = "0x1740c3552c5f1Bd304fab433C977375357B5Bd7c";
const CONTRACT_FACTORY_ADDRESS        = "0xA74500382CAb2EBFe9A08dc2c01430821A4A8E15"; // v0.1.3

const GAS_COLLECTOR_ADDRESS           = "0x0311b9696907AdC2093448678cf080adA1368d00"; // V0.1.3
const BALANCE_FETCHER_ADDRESS         = "0xb646F462A89799d910b1dc330BA1DA9dE763c931"; // v0.1.3

const AGENT_NFT_ADDRESS               = "0xA1E88Ac5DBA42116eDd02987aed8880AbA38d112"; // v0.1.3

const AGENT_FACTORY01_ADDRESS         = "0x9EDa22a1F7Df00A502D164986743933cF787d6Ae"; // v0.1.3
const AGENT_FACTORY02_ADDRESS         = "0x3D6B33A07629D3E120c06419c11b8A1F8714ec40"; // v0.1.3

const ACCOUNT_IMPL_BASE_ADDRESS       = "0x25a9aD7766D2857E4EB320a9557F637Bd748b97c"; // v0.1.3
const ACCOUNT_IMPL_RING_C_ADDRESS     = "0xeb61E6600f87c07EB40C735B0DF0aedf899C24F6"; // v0.1.3

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

let iblast: IBlast;
let gasCollector: GasCollector;
let agentNft: Agents;
let factory01: AgentFactory01;
let factory02: AgentFactory02;
let accountImplBase: BlastAgentAccount; // the base implementation for agentfi accounts
let accountImplRingC: BlastAgentAccountRingProtocolC;

let usdb: MockERC20;

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${agentfideployer.address} as agentfideployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia or a local fork of Blast Sepolia");
  //await expectDeployed(ERC6551_REGISTRY_ADDRESS)

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, boombotseth) as IBlast;

  gasCollector = await ethers.getContractAt("GasCollector", GAS_COLLECTOR_ADDRESS, agentfideployer) as GasCollector;
  agentNft = await ethers.getContractAt("Agents", AGENT_NFT_ADDRESS, agentfideployer) as Agents;
  factory01 = await ethers.getContractAt("AgentFactory01", AGENT_FACTORY01_ADDRESS, agentfideployer) as AgentFactory01;
  factory02 = await ethers.getContractAt("AgentFactory02", AGENT_FACTORY02_ADDRESS, agentfideployer) as AgentFactory02;
  accountImplBase = await ethers.getContractAt("BlastAgentAccount", ACCOUNT_IMPL_BASE_ADDRESS, agentfideployer) as BlastAgentAccount;
  accountImplRingC = await ethers.getContractAt("BlastAgentAccountRingProtocolC", ACCOUNT_IMPL_RING_C_ADDRESS, agentfideployer) as BlastAgentAccountRingProtocolC;

  usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS, agentfideployer) as MockERC20;

  //await configureContractFactoryGasGovernor();

  //await whitelistFactories();
  //await setNftMetadata();

  //await configureGasCollector();
  //await collectGasRewards();

  //await postAgentCreationSettings02_1();
  //await postAgentCreationSettings02_2();
  //await postAgentCreationSettings02_3();

  //await pauseAgentCreationSettings02();

  await postAgentCreationSettings02_4();
  await postAgentCreationSettings02_5();
  await postAgentCreationSettings02_6();
  await postAgentCreationSettings02_7();

  //await transferFundsFromFactory02()
  //await transferFundsToFactory02();

}

async function configureContractFactoryGasGovernor() {
  console.log("Configuring contract factory gas governor")
  let tx = await iblast.connect(agentfideployer).configureGovernorOnBehalf(gasCollector.address, CONTRACT_FACTORY_ADDRESS, networkSettings.overrides)
  await tx.wait(networkSettings.confirmations)
  console.log("Configured contract factory gas governor")
}

async function whitelistFactories() {
  let expectedSettings = [
    {
      factory: factory01.address,
      shouldWhitelist: true,
    },
    {
      factory: factory02.address,
      shouldWhitelist: true,
    },
  ]
  let diffs = [] as any[]
  for(let i = 0; i < expectedSettings.length; i++) {
    let { factory , shouldWhitelist } = expectedSettings[i]
    let isWhitelisted = await agentNft.connect(boombotseth).factoryIsWhitelisted(factory)
    if(isWhitelisted != shouldWhitelist) diffs.push(expectedSettings[i])
  }
  if(diffs.length > 0) {
    console.log("Whitelisting factories")
    let tx = await agentNft.connect(agentfideployer).setWhitelist(diffs, networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log("Whitelisted factories")
  }
}

async function setNftMetadata() {
  let txdatas = [] as any[]
  let desiredContractURI = "https://stats-cdn.agentfi.io/contractURI.json"
  let desiredBaseURI = "https://stats.agentfi.io/agents/metadata/?chainID=168587773&v=0.1.2&agentID="
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
    tx = await agentfideployer.sendTransaction({
      to: agentNft.address,
      data: txdatas[0],
      ...networkSettings.overrides,
      gasLimit: 1_000_000
    })
  } else { // length > 1
    tx = await agentNft.connect(agentfideployer).multicall(txdatas, {...networkSettings.overrides, gasLimit: 1_000_000});
  }
  //console.log("tx:", tx);
  await tx.wait(networkSettings.confirmations);
  console.log("Set NFT metadata");
}

async function pauseAgentCreationSettings02() {
  let expectedSettings = [
    {
      settingsID: 1,
      isPaused: true,
    },
    {
      settingsID: 2,
      isPaused: true,
    },
    {
      settingsID: 3,
      isPaused: true,
    },
    {
      settingsID: 6,
      isPaused: true,
    },
  ]
  let diffs = []
  for(let i = 0; i < expectedSettings.length; ++i) {
    let { settingsID, isPaused } = expectedSettings[i]
    let res = await factory02.getAgentCreationSettings(settingsID)
    if(res.isPaused != isPaused) {
      diffs.push(expectedSettings[i])
    }
  }
  if(diffs.length == 0) return
  console.log(`Pausing factory02 agent creation settings`)
  console.log(diffs)
  let txdatas = diffs.map(d=>factory02.interface.encodeFunctionData("setPaused",[d.settingsID,d.isPaused]))
  let tx = await factory02.connect(agentfideployer).multicall(txdatas, networkSettings.overrides)
  await tx.wait(networkSettings.confirmations)
  console.log(`Paused factory02 agent creation settings`)
}

async function postAgentCreationSettings02_4() {
  let expectedSettingsID = 4
  let count = (await factory02.getAgentCreationSettingsCount()).toNumber()
  if(count >= expectedSettingsID) return // already created
  if(count != expectedSettingsID - 1) throw new Error("postAgentCreationSettings out of order")
  console.log(`Calling postAgentCreationSettings02_${expectedSettingsID}`)

  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let agentInitializationCode3 = accountImplBase.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let agentInitializationCode4 = accountImplBase.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);

  let giveTokenList = []
  let giveTokenAmounts = []

  let params = {
    agentImplementation: accountImplBase.address,
    initializationCalls: [
      agentInitializationCode3,
      agentInitializationCode4,
    ],
    isPaused: false,
    giveTokenList,
    giveTokenAmounts,
  }
  let tx = await factory02.connect(agentfideployer).postAgentCreationSettings(params)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="AgentCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postAgentCreationSettings02_${expectedSettingsID}`)
}

async function postAgentCreationSettings02_5() {
  let expectedSettingsID = 5
  let count = (await factory02.getAgentCreationSettingsCount()).toNumber()
  if(count >= expectedSettingsID) return // already created
  if(count != expectedSettingsID - 1) throw new Error("postAgentCreationSettings out of order")
  console.log(`Calling postAgentCreationSettings02_${expectedSettingsID}`)

  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let agentInitializationCode3 = accountImplBase.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let agentInitializationCode4 = accountImplBase.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);

  let giveTokenList = [ETH_ADDRESS, USDB_ADDRESS]
  let giveTokenAmounts = [WeiPerEther.div(1000), WeiPerEther.mul(100)]

  let params = {
    agentImplementation: accountImplBase.address,
    initializationCalls: [
      agentInitializationCode3,
      agentInitializationCode4,
    ],
    isPaused: false,
    giveTokenList,
    giveTokenAmounts,
  }
  let tx = await factory02.connect(agentfideployer).postAgentCreationSettings(params)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="AgentCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postAgentCreationSettings02_${expectedSettingsID}`)
}

async function postAgentCreationSettings02_6() {
  let expectedSettingsID = 6
  let count = (await factory02.getAgentCreationSettingsCount()).toNumber()
  if(count >= expectedSettingsID) return // already created
  if(count != expectedSettingsID - 1) throw new Error("postAgentCreationSettings out of order")
  console.log(`Calling postAgentCreationSettings02_${expectedSettingsID}`)

  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let agentInitializationCode3 = accountImplBase.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let agentInitializationCode4 = accountImplBase.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);

  let giveTokenList = []
  let giveTokenAmounts = []

  let params = {
    agentImplementation: accountImplBase.address,
    initializationCalls: [
      agentInitializationCode3,
      agentInitializationCode4,
    ],
    isPaused: false,
    giveTokenList,
    giveTokenAmounts,
  }
  let tx = await factory02.connect(agentfideployer).postAgentCreationSettings(params)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="AgentCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postAgentCreationSettings02_${expectedSettingsID}`)
}

async function postAgentCreationSettings02_7() {
  let expectedSettingsID = 7
  let count = (await factory02.getAgentCreationSettingsCount()).toNumber()
  if(count >= expectedSettingsID) return // already created
  if(count != expectedSettingsID - 1) throw new Error("postAgentCreationSettings out of order")
  console.log(`Calling postAgentCreationSettings02_${expectedSettingsID}`)

  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let agentInitializationCode3 = accountImplRingC.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let agentInitializationCode4 = accountImplRingC.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);

  let giveTokenList = []
  let giveTokenAmounts = []

  let params = {
    agentImplementation: accountImplRingC.address,
    initializationCalls: [
      agentInitializationCode3,
      agentInitializationCode4,
    ],
    isPaused: false,
    giveTokenList,
    giveTokenAmounts,
  }
  let tx = await factory02.connect(agentfideployer).postAgentCreationSettings(params)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="AgentCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postAgentCreationSettings02_${expectedSettingsID}`)
}

async function configureGasCollector() {
  let contractListExpected = deduplicateArray([
    GAS_COLLECTOR_ADDRESS,
    //CONTRACT_FACTORY_ADDRESS,
    AGENT_NFT_ADDRESS,
    ACCOUNT_IMPL_BASE_ADDRESS,
    AGENT_FACTORY01_ADDRESS,
    AGENT_FACTORY02_ADDRESS,
    BALANCE_FETCHER_ADDRESS,
  ])
  let receiverExpected = GAS_COLLECTOR_ADDRESS
  let res = await gasCollector.getContractList()
  let { contractList_, gasReceiver_ } = res
  /*
  console.log('contract list expected')
  console.log(contractListExpected)
  console.log('contract list real')
  console.log(contractList_)
  console.log('receiver expected')
  console.log(receiverExpected)
  console.log('receiver real')
  console.log(gasReceiver_)
  */
  let diff = gasReceiver_ != receiverExpected
  for(let i = 0; i < contractListExpected.length && !diff; ++i) {
    if(!contractList_.includes(contractListExpected[i])) {
      diff = true;
      break;
    }
  }
  if(!diff) return

  console.log(`Configuring gas rewards`)
  //let contractList = [gasCollector.address, dataStore.address]
  let tx = await gasCollector.connect(agentfideployer).setClaimContractList(contractListExpected, receiverExpected, networkSettings.overrides)
  await tx.wait(networkSettings.confirmations)
  console.log(`Configured gas rewards`)
}

async function collectGasRewards() {
  console.log(`Collecting gas rewards`)
  let tx = await gasCollector.connect(boombotseth).claimGas(networkSettings.overrides)
  await tx.wait(networkSettings.confirmations)
  console.log(`Collected gas rewards`)
}

async function transferFundsToFactory02() {

  var bal = await provider.getBalance(factory02.address)
  if(bal.eq(0)) {
    console.log(`Transferring ETH to factory02`)
    let tx1 = await boombotseth.sendTransaction({
      ...networkSettings.overrides,
      to: factory02.address,
      value: WeiPerEther,
      gasLimit: 50_000,
    })
    await tx1.wait(networkSettings.confirmations)
    console.log(`Transferred ETH to factory02`)
  }

  var bal = await usdb.balanceOf(factory02.address)
  if(bal.eq(0)) {
    console.log(`Transferring USDB to factory02`)
    //let tx2 = await usdb.connect(boombotseth).transfer(factory02.address, WeiPerEther.mul(100_000), networkSettings.overrides)
    let tx2 = await usdb.connect(boombotseth).transfer(factory02.address, WeiPerEther.mul(100_000), networkSettings.overrides)
    await tx2.wait(networkSettings.confirmations)
    console.log(`Transferred USDB to factory02`)
  }

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
