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
const allowlistSignerKey = accounts.allowlistSigner.key
const allowlistSignerAddress = accounts.allowlistSigner.address

import { Agents, BlastAgentAccount, AgentFactory01, AgentFactory02, AgentFactory03, IBlast, ContractFactory, GasCollector, BalanceFetcher } from "../../typechain-types";

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

const AGENT_NFT_ADDRESS               = "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b"; // v0.1.3

const AGENT_FACTORY01_ADDRESS         = "0x66458d8cE1238C7C7818e7988974F0bd5B373c95"; // v0.1.3
const AGENT_FACTORY02_ADDRESS         = "0x59c11B12a2D11810d1ca4afDc21a9Fc837193f41"; // v0.1.3
const AGENT_FACTORY03_ADDRESS         = "0x3c12E9F1FC3C3211B598aD176385939Ea01deA89"; // v0.1.3
const GENESIS_FACTORY_ADDRESS         = "0x9d2f478f121b7b96C0AE29D3Cf8e66914936d4a7"; // genesis

const ACCOUNT_IMPL_BASE_ADDRESS       = "0x25a9aD7766D2857E4EB320a9557F637Bd748b97c"; // v0.1.3
const ACCOUNT_IMPL_RING_C_ADDRESS     = "0xeb61E6600f87c07EB40C735B0DF0aedf899C24F6"; // v0.1.3
const ACCOUNT_IMPL_RING_D_ADDRESS     = "0xD9F32ab36bCB6dD3005038DeB53f9ed742947b64"; // v0.1.3
const ACCOUNT_IMPL_THRUSTER_A_ADDRESS = "0xC33F80Ca19c8Cbc55837F4B6c6EC5C3FE7c4400f"; // v0.1.5
const ACCOUNT_IMPL_BASKET_A_ADDRESS   = "0x68e362fC50d62af91Aba1d9184c63505C9EA02c8"; // v0.1.5

// tokens
const ETH_ADDRESS                = "0x0000000000000000000000000000000000000000";
const ALL_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000001";
const MAX_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000002";
const WETH_ADDRESS               = "0x4200000000000000000000000000000000000023";
const USDB_ADDRESS               = "0x4200000000000000000000000000000000000022";

// ring protocol
const UNIVERSAL_ROUTER_ADDRESS   = "0x334e3F7f5A9740627fA47Fa9Aa51cE0ccbD765cF";
const FEW_ROUTER_ADDRESS         = "0x02F1e7A518e3E286C8E305E39cA7D4f25e0a44Aa";
const STAKING_REWARDS_ADDRESS    = "0x366Ac78214aFE145Ca35d4A6513F4eD9e8909Fe8";
const USDC_ADDRESS               = "0xF19A5b56b419170Aa2ee49E5c9195F5902D39BF1";
const USDT_ADDRESS               = "0xD8F542D710346DF26F28D6502A48F49fB2cFD19B";
const DAI_ADDRESS                = "0x9C6Fc5bF860A4a012C9De812002dB304AD04F581";
const BOLT_ADDRESS               = "0x1B0cC80F4E2A7d205518A1Bf36de5bED686662FE";
const RGB_ADDRESS                = "0x7647a41596c1Ca0127BaCaa25205b310A0436B4C";

const FWWETH_ADDRESS             = "0x798dE0520497E28E8eBfF0DF1d791c2E942eA881";
const FWUSDC_ADDRESS             = "0xa7870cf9143084ED04f4C2311f48CB24a2b4A097";
const LP_TOKEN_ADDRESS           = "0x024Dd95113137f04E715B2fC8F637FBe678e9512";
const RING_ADDRESS               = "0x0BD5539E33a1236bA69228271e60f3bFf8fDB7DB";
const STAKING_REWARDS_INDEX      = 2;

let iblast: IBlast;
let gasCollector: GasCollector;
let agentNft: Agents;
let factory01: AgentFactory01;
let factory02: AgentFactory02;
let factory03: AgentFactory03;
let genesisFactory: BlastooorGenesisFactory;
let accountImplBase: BlastAgentAccount; // the base implementation for agentfi accounts
let accountImplRingC: BlastAgentAccountRingProtocolC;
let accountImplRingD: BlastAgentAccountRingProtocolD;
let accountImplThrusterA: BlastAgentAccountThrusterA;
let accountImplBasketA: BlastAgentAccountBasketA;

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
  factory03 = await ethers.getContractAt("AgentFactory03", AGENT_FACTORY03_ADDRESS, agentfideployer) as AgentFactory03;
  genesisFactory = await ethers.getContractAt("BlastooorGenesisFactory", GENESIS_FACTORY_ADDRESS, agentfideployer) as BlastooorGenesisFactory;
  accountImplBase = await ethers.getContractAt("BlastAgentAccount", ACCOUNT_IMPL_BASE_ADDRESS, agentfideployer) as BlastAgentAccount;
  accountImplRingC = await ethers.getContractAt("BlastAgentAccountRingProtocolC", ACCOUNT_IMPL_RING_C_ADDRESS, agentfideployer) as BlastAgentAccountRingProtocolC;
  accountImplRingD = await ethers.getContractAt("BlastAgentAccountRingProtocolD", ACCOUNT_IMPL_RING_D_ADDRESS, agentfideployer) as BlastAgentAccountRingProtocolD;
  accountImplThrusterA = await ethers.getContractAt("BlastAgentAccountThrusterA", ACCOUNT_IMPL_THRUSTER_A_ADDRESS, agentfideployer) as BlastAgentAccountThrusterA;
  accountImplBasketA = await ethers.getContractAt("BlastAgentAccountBasketA", ACCOUNT_IMPL_BASKET_A_ADDRESS, agentfideployer) as BlastAgentAccountBasketA;

  usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS, agentfideployer) as MockERC20;

  //await configureContractFactoryGasGovernor();

  await whitelistFactories();
  //await setNftMetadata();

  //await configureGasCollector();
  //await collectGasRewards();

  await postAgentCreationSettings_blastooor();
  await addSigners()

  //await postAgentCreationSettings03_1();
  //await postAgentCreationSettings03_2();
  //await postAgentCreationSettings03_3();
  //await postAgentCreationSettings03_4();
  //await postAgentCreationSettings03_6();
  //await postAgentCreationSettings03_7();


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
    {
      factory: factory03.address,
      shouldWhitelist: true,
    },
    {
      factory: GENESIS_FACTORY_ADDRESS,
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
  let desiredBaseURI = "https://stats.agentfi.io/agents/metadata/?chainID=168587773&v=0.1.4&agentID="
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
/*
async function pauseAgentCreationSettings03() {
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
      settingsID: 5,
      isPaused: true,
    },
  ]
  let diffs = []
  for(let i = 0; i < expectedSettings.length; ++i) {
    let { settingsID, isPaused } = expectedSettings[i]
    let res = await factory03.getAgentCreationSettings(settingsID)
    if(res.isPaused != isPaused) {
      diffs.push(expectedSettings[i])
    }
  }
  if(diffs.length == 0) return
  console.log(`Pausing factory03 agent creation settings`)
  console.log(diffs)
  let txdatas = diffs.map(d=>factory03.interface.encodeFunctionData("setPaused",[d.settingsID,d.isPaused]))
  let tx = await factory03.connect(agentfideployer).multicall(txdatas, networkSettings.overrides)
  await tx.wait(networkSettings.confirmations)
  console.log(`Paused factory03 agent creation settings`)
}
*/

// postAgentCreationSettings_blastooor
async function postAgentCreationSettings_blastooor() {
  console.log(`Calling postAgentCreationSettings_blastooor`)

  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let agentInitializationCode3 = accountImplBase.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let agentInitializationCode4 = accountImplBase.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);

  const startTimePast = 1705735600

  const mintStartTime = 1709355600
  const allowlistStopTime = 1709398800

  let params = {
    agentImplementation: accountImplBase.address,
    initializationCalls: [
      agentInitializationCode3,
      agentInitializationCode4,
    ],
    isActive: true,
    paymentToken: AddressZero,
    paymentAmount: WeiPerEther.mul(1).div(100),
    paymentReceiver: agentfideployer.address,
    mintStartTime: startTimePast,
    allowlistStopTime: allowlistStopTime
  }
  let tx = await genesisFactory.connect(agentfideployer).postAgentCreationSettings(params)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="AgentCreationSettingsPosted")[0]

  console.log(`Called postAgentCreationSettings_blastooor`)
}

async function addSigners() {
  console.log(`Adding signers`)
  let tx = await genesisFactory.connect(agentfideployer).addSigner(allowlistSignerAddress, networkSettings.overrides)
  let receipt = await tx.wait(networkSettings.confirmations)
  console.log(`Added signers`)
}

// 1: create new root agent
async function postAgentCreationSettings03_1() {
  let expectedSettingsID = 1
  let count = (await factory03.getAgentCreationSettingsCount()).toNumber()
  if(count >= expectedSettingsID) return // already created
  if(count != expectedSettingsID - 1) throw new Error("postAgentCreationSettings out of order")
  console.log(`Calling postAgentCreationSettings03_${expectedSettingsID}`)

  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let agentInitializationCode3 = accountImplBase.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let agentInitializationCode4 = accountImplBase.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);

  let params = {
    agentImplementation: accountImplBase.address,
    initializationCalls: [
      agentInitializationCode3,
      agentInitializationCode4,
    ],
    isPaused: false,
  }
  let tx = await factory03.connect(agentfideployer).postAgentCreationSettings(params)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="AgentCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postAgentCreationSettings03_${expectedSettingsID}`)
}

// 4: create new ring strategy C as root agent. does not init
async function postAgentCreationSettings03_2() {
  let expectedSettingsID = 2
  let count = (await factory03.getAgentCreationSettingsCount()).toNumber()
  if(count >= expectedSettingsID) return // already created
  if(count != expectedSettingsID - 1) throw new Error("postAgentCreationSettings out of order")
  console.log(`Calling postAgentCreationSettings03_${expectedSettingsID}`)

  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let agentInitializationCode3 = accountImplRingC.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let agentInitializationCode4 = accountImplRingC.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);

  let params = {
    agentImplementation: accountImplRingC.address,
    initializationCalls: [
      agentInitializationCode3,
      agentInitializationCode4,
    ],
    isPaused: false,
  }
  let tx = await factory03.connect(agentfideployer).postAgentCreationSettings(params)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="AgentCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postAgentCreationSettings03_${expectedSettingsID}`)
}

// 3: create new ring strategy D as root agent. does not init
async function postAgentCreationSettings03_3() {
  let expectedSettingsID = 3
  let count = (await factory03.getAgentCreationSettingsCount()).toNumber()
  if(count >= expectedSettingsID) return // already created
  if(count != expectedSettingsID - 1) throw new Error("postAgentCreationSettings out of order")
  console.log(`Calling postAgentCreationSettings03_${expectedSettingsID}`)

  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let agentInitializationCode3 = accountImplRingD.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let agentInitializationCode4 = accountImplRingD.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);

  let params = {
    agentImplementation: accountImplRingD.address,
    initializationCalls: [
      agentInitializationCode3,
      agentInitializationCode4,
    ],
    isPaused: false,
  }
  let tx = await factory03.connect(agentfideployer).postAgentCreationSettings(params)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="AgentCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postAgentCreationSettings03_${expectedSettingsID}`)
}

// 4: create new ring strategy D as root agent. also inits
async function postAgentCreationSettings03_4() {
  let expectedSettingsID = 4
  let count = (await factory03.getAgentCreationSettingsCount()).toNumber()
  if(count >= expectedSettingsID) return // already created
  if(count != expectedSettingsID - 1) throw new Error("postAgentCreationSettings out of order")
  console.log(`Calling postAgentCreationSettings03_${expectedSettingsID}`)

  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let agentInitializationCode3 = accountImplRingD.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let agentInitializationCode4 = accountImplRingD.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);
  let agentInitializationCode5 = accountImplRingD.interface.encodeFunctionData("initialize", [WETH_ADDRESS, USDC_ADDRESS, FWWETH_ADDRESS, FWUSDC_ADDRESS, LP_TOKEN_ADDRESS, STAKING_REWARDS_INDEX])

  let params = {
    agentImplementation: accountImplRingD.address,
    initializationCalls: [
      agentInitializationCode3,
      agentInitializationCode4,
      agentInitializationCode5,
    ],
    isPaused: false,
  }
  let tx = await factory03.connect(agentfideployer).postAgentCreationSettings(params)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="AgentCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postAgentCreationSettings03_${expectedSettingsID}`)
}

// 6: create new thruster strategy A as root agent. also inits
async function postAgentCreationSettings03_6() {
  let expectedSettingsID = 6
  let count = (await factory03.getAgentCreationSettingsCount()).toNumber()
  if(count >= expectedSettingsID) return // already created
  if(count != expectedSettingsID - 1) throw new Error("postAgentCreationSettings out of order")
  console.log(`Calling postAgentCreationSettings03_${expectedSettingsID}`)

  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let agentInitializationCode3 = accountImplThrusterA.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let agentInitializationCode4 = accountImplThrusterA.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);
  let agentInitializationCode5 = accountImplThrusterA.interface.encodeFunctionData("initialize", [WETH_ADDRESS, USDB_ADDRESS])

  let params = {
    agentImplementation: accountImplThrusterA.address,
    initializationCalls: [
      agentInitializationCode3,
      agentInitializationCode4,
      agentInitializationCode5,
    ],
    isPaused: false,
  }
  let tx = await factory03.connect(agentfideployer).postAgentCreationSettings(params)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="AgentCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postAgentCreationSettings03_${expectedSettingsID}`)
}

// 7: create new root agent with basket strategy. basket is root
async function postAgentCreationSettings03_7() {
  let expectedSettingsID = 7
  let count = (await factory03.getAgentCreationSettingsCount()).toNumber()
  if(count >= expectedSettingsID) return // already created
  if(count != expectedSettingsID - 1) throw new Error("postAgentCreationSettings out of order")
  console.log(`Calling postAgentCreationSettings03_${expectedSettingsID}`)

  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let agentInitializationCode3 = accountImplBasketA.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let agentInitializationCode4 = accountImplBasketA.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);
  let agentInitializationCode5 = accountImplBasketA.interface.encodeFunctionData("initialize", [])

  let params = {
    agentImplementation: accountImplBasketA.address,
    initializationCalls: [
      agentInitializationCode3,
      agentInitializationCode4,
      agentInitializationCode5,
    ],
    isPaused: false,
  }
  let tx = await factory03.connect(agentfideployer).postAgentCreationSettings(params)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="AgentCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postAgentCreationSettings03_${expectedSettingsID}`)
}
/*
// 8: create new root agent with basket strategy. root owns basket
async function postAgentCreationSettings03_8() {
  let expectedSettingsID = 8
  let count = (await factory03.getAgentCreationSettingsCount()).toNumber()
  if(count >= expectedSettingsID) return // already created
  if(count != expectedSettingsID - 1) throw new Error("postAgentCreationSettings out of order")
  console.log(`Calling postAgentCreationSettings03_${expectedSettingsID}`)

  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let agentInitializationCode3 = accountImplBasketA.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let agentInitializationCode4 = accountImplBasketA.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);
  let basketAgentInitializationCodes = [accountImplBasketA.interface.encodeFunctionData("initialize", [])]
  let factorydata = factory03.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);
  let agentInitializationCode5 = accountImplBasketA.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);

  let params = {
    agentImplementation: accountImplBasketA.address,
    initializationCalls: [
      agentInitializationCode3,
      agentInitializationCode4,
      agentInitializationCode5,
    ],
    isPaused: false,
  }
  let tx = await factory03.connect(agentfideployer).postAgentCreationSettings(params)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="AgentCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postAgentCreationSettings03_${expectedSettingsID}`)
}
*/
/*
async function postAgentCreationSettings03_5() {
  let expectedSettingsID = 5
  let count = (await factory03.getAgentCreationSettingsCount()).toNumber()
  if(count >= expectedSettingsID) return // already created
  if(count != expectedSettingsID - 1) throw new Error("postAgentCreationSettings out of order")
  console.log(`Calling postAgentCreationSettings03_${expectedSettingsID}`)

  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let agentInitializationCode3 = accountImplRingD.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let agentInitializationCode4 = accountImplRingD.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);
  let agentInitializationCode5 = accountImplRingD.interface.encodeFunctionData("initialize", [WETH_ADDRESS, USDC_ADDRESS, FWWETH_ADDRESS, FWUSDC_ADDRESS, LP_TOKEN_ADDRESS, STAKING_REWARDS_INDEX])

  let params = {
    agentImplementation: accountImplRingD.address,
    initializationCalls: [
      agentInitializationCode3,
      agentInitializationCode4,
      agentInitializationCode5,
    ],
    isPaused: false,
  }
  let tx = await factory03.connect(agentfideployer).postAgentCreationSettings(params)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="AgentCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postAgentCreationSettings03_${expectedSettingsID}`)
}
*/
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

async function transferFundsFromFactory02() {
  console.log(`Transferring funds from factory02`)
  let tx3 = await factory02.connect(agentfideployer).sweep(agentfideployer.address, [AddressZero, USDB_ADDRESS], networkSettings.overrides)
  await tx3.wait(networkSettings.confirmations)
  console.log(`Transferred funds from factory02`)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
