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

import { Agents, BlastooorAgentAccount, AgentFactory01, AgentFactory02, AgentFactory03, IBlast, ContractFactory, GasCollector, BalanceFetcher, BlastooorStrategyAgents, BlastooorStrategyFactory, BlastooorStrategyAgentAccount, Dispatcher, IBlastPoints } from "../../typechain-types";

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
const BLAST_POINTS_ADDRESS            = "0x2fc95838c71e76ec69ff817983BFf17c710F34E0";
const BLAST_POINTS_OPERATOR_ADDRESS   = "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";

const ENTRY_POINT_ADDRESS             = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const MULTICALL_FORWARDER_ADDRESS     = "0x26aDd0cB3eA65ADBb063739A5C5735055029B6BD"; // v1.0.0
const CONTRACT_FACTORY_ADDRESS        = "0x9D735e7926729cAB93b10cb5814FF8487Fb6D5e8"; // v1.0.0

const GAS_COLLECTOR_ADDRESS           = "0xf237c20584DaCA970498917470864f4d027de4ca"; // v1.0.0
const BALANCE_FETCHER_ADDRESS         = "0xecBa5144eeFEebceC60e0Bfb0D19e6F86048690A"; // v1.0.1

const GENESIS_COLLECTION_ADDRESS      = "0x5066A1975BE96B777ddDf57b496397efFdDcB4A9"; // v1.0.0
const GENESIS_FACTORY_ADDRESS         = "0x700b6f8B315247DD41C42A6Cfca1dAE6B4567f3B"; // v1.0.0
const ACCOUNT_IMPL_BASE_ADDRESS       = "0x8836060137a20E41d599565F644D9EB0807A5353"; // v1.0.0

const STRATEGY_COLLECTION_ADDRESS     = "0x07A10106e8cA35D3ca976A63B93aCECF56Ef10dF"; // v1.0.1
const STRATEGY_FACTORY_ADDRESS        = "0x91e82c028C1b7015225a7bCFa7a430E46C8DCFb6"; // v1.0.1
const STRATEGY_ACCOUNT_IMPL_ADDRESS   = "0xF62f98e2aF80BB65e544D38783254bE294a4526d"; // v1.0.1

const DISPATCHER_ADDRESS              = "0xC9EB588498e911bdeB081A927c8059FaC4480260"; // v1.0.1

const STRATEGY_MANAGER_ROLE = "0x4170d100a3a3728ae51207936ee755ecaa64a7f6e9383c642ab204a136f90b1b";

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
let iblastpoints: IBlastPoints;
let gasCollector: GasCollector;
let balanceFetcher: BalanceFetcher;

let genesisCollection: BlastooorGenesisAgents;
let genesisFactory: BlastooorGenesisFactory;
let accountImplBase: BlastooorAgentAccount; // the base implementation for agentfi accounts

let strategyCollection: BlastooorStrategyAgents;
let strategyFactory: BlastooorStrategyFactory;
let strategyAccountImpl: BlastooorStrategyAgentAccount;

let dispatcher: Dispatcher;

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

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, agentfideployer) as IBlast;
  iblastpoints = await ethers.getContractAt("IBlastPoints", BLAST_POINTS_ADDRESS, agentfideployer) as IBlastPoints;

  gasCollector = await ethers.getContractAt("GasCollector", GAS_COLLECTOR_ADDRESS, agentfideployer) as GasCollector;
  balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, agentfideployer) as BalanceFetcher;
  genesisCollection = await ethers.getContractAt("BlastooorGenesisAgents", GENESIS_COLLECTION_ADDRESS, agentfideployer) as BlastooorGenesisAgents;
  genesisFactory = await ethers.getContractAt("BlastooorGenesisFactory", GENESIS_FACTORY_ADDRESS, agentfideployer) as BlastooorGenesisFactory;
  accountImplBase = await ethers.getContractAt("BlastooorAgentAccount", ACCOUNT_IMPL_BASE_ADDRESS, agentfideployer) as BlastooorAgentAccount;
  strategyCollection = await ethers.getContractAt("BlastooorStrategyAgents", STRATEGY_COLLECTION_ADDRESS, agentfideployer) as BlastooorStrategyAgents;
  strategyFactory = await ethers.getContractAt("BlastooorStrategyFactory", STRATEGY_FACTORY_ADDRESS, agentfideployer) as BlastooorStrategyFactory;
  strategyAccountImpl = await ethers.getContractAt("BlastooorStrategyAgentAccount", STRATEGY_ACCOUNT_IMPL_ADDRESS, agentfideployer) as BlastooorStrategyAgentAccount;
  dispatcher = await ethers.getContractAt("Dispatcher", DISPATCHER_ADDRESS, agentfideployer) as Dispatcher;

  usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS, agentfideployer) as MockERC20;

  //await configureContractFactoryGasGovernor();

  //await postAgentCreationSettings_blastooor();
  //await addSigners()

  //await whitelistFactories();
  //await setNftMetadata();

  //await configureGasCollector();
  //await collectGasRewards();


  //await postAgentCreationSettings03_1();
  //await postAgentCreationSettings03_2();
  //await postAgentCreationSettings03_3();
  //await postAgentCreationSettings03_4();
  //await postAgentCreationSettings03_6();
  //await postAgentCreationSettings03_7();

  //await whitelistStrategyFactories();
  //await setMaxCreationsPerGenesisAgent();
  //await setStrategyNftMetadata();
  //await postStrategyAgentCreationSettings_1();
  //await postStrategyAgentCreationSettings_2();

  //await addOperatorsToDispatcher();
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
      factory: GENESIS_FACTORY_ADDRESS,
      shouldWhitelist: true,
    },
  ]
  let diffs = [] as any[]
  for(let i = 0; i < expectedSettings.length; i++) {
    let { factory , shouldWhitelist } = expectedSettings[i]
    let isWhitelisted = await genesisCollection.connect(agentfideployer).factoryIsWhitelisted(factory)
    if(isWhitelisted != shouldWhitelist) diffs.push(expectedSettings[i])
  }
  if(diffs.length > 0) {
    console.log("Whitelisting factories")
    let tx = await genesisCollection.connect(agentfideployer).setWhitelist(diffs, networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log("Whitelisted factories")
  }
}

async function setNftMetadata() {
  let txdatas = [] as any[]
  let desiredContractURI = "https://stats-cdn.agentfi.io/contractURI.json"
  let desiredBaseURI = "https://stats.agentfi.io/agents/metadata/?chainID=168587773&v=0.1.4&agentID="
  let currentContractURI = await genesisCollection.contractURI()
  let currentBaseURI = await genesisCollection.baseURI()
  if(currentContractURI != desiredContractURI) {
    txdatas.push(genesisCollection.interface.encodeFunctionData("setContractURI", [desiredContractURI]))
  }
  if(currentBaseURI != desiredBaseURI) {
    txdatas.push(genesisCollection.interface.encodeFunctionData("setBaseURI", [desiredBaseURI]))
  }
  if(txdatas.length == 0) return
  var tx
  console.log("Setting NFT metadata");
  if(txdatas.length == 1) {
    tx = await agentfideployer.sendTransaction({
      to: genesisCollection.address,
      data: txdatas[0],
      ...networkSettings.overrides,
      gasLimit: 1_000_000
    })
  } else { // length > 1
    tx = await genesisCollection.connect(agentfideployer).multicall(txdatas, {...networkSettings.overrides, gasLimit: 1_000_000});
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

  const timestampAllowlistMintStart = 1709355600
  const timestampAllowlistMintEnd = 1709398800
  const timestampPublicMintStart = 1709355600

  let params = {
    agentImplementation: accountImplBase.address,
    initializationCalls: [
      agentInitializationCode3,
      agentInitializationCode4,
    ],
    isActive: true,
    paymentAmount: WeiPerEther.mul(1).div(100),
    paymentReceiver: agentfideployer.address,
    timestampAllowlistMintStart: 0,
    timestampAllowlistMintEnd: timestampAllowlistMintEnd,
    timestampPublicMintStart: 0,
  }
  let tx = await genesisFactory.connect(agentfideployer).postAgentCreationSettings(params, networkSettings.overrides)
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
  let tx = await factory03.connect(agentfideployer).postAgentCreationSettings(params, networkSettings.overrides)
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
  let tx = await factory03.connect(agentfideployer).postAgentCreationSettings(params, networkSettings.overrides)
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
  let tx = await factory03.connect(agentfideployer).postAgentCreationSettings(params, networkSettings.overrides)
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
  let tx = await factory03.connect(agentfideployer).postAgentCreationSettings(params, networkSettings.overrides)
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
  let tx = await factory03.connect(agentfideployer).postAgentCreationSettings(params, networkSettings.overrides)
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
  let tx = await factory03.connect(agentfideployer).postAgentCreationSettings(params, networkSettings.overrides)
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
  let tx = await factory03.connect(agentfideployer).postAgentCreationSettings(params, networkSettings.overrides)
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
  let tx = await factory03.connect(agentfideployer).postAgentCreationSettings(params, networkSettings.overrides)
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
  let tx = await gasCollector.connect(agentfideployer).claimGas(networkSettings.overrides)
  await tx.wait(networkSettings.confirmations)
  console.log(`Collected gas rewards`)
}

async function transferFundsToFactory02() {

  var bal = await provider.getBalance(factory02.address)
  if(bal.eq(0)) {
    console.log(`Transferring ETH to factory02`)
    let tx1 = await agentfideployer.sendTransaction({
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
    //let tx2 = await usdb.connect(agentfideployer).transfer(factory02.address, WeiPerEther.mul(100_000), networkSettings.overrides)
    let tx2 = await usdb.connect(agentfideployer).transfer(factory02.address, WeiPerEther.mul(100_000), networkSettings.overrides)
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

// strategies

async function whitelistStrategyFactories() {
  let expectedSettings = [
    {
      factory: STRATEGY_FACTORY_ADDRESS,
      shouldWhitelist: true,
    },
  ]
  let diffs = [] as any[]
  for(let i = 0; i < expectedSettings.length; i++) {
    let { factory , shouldWhitelist } = expectedSettings[i]
    let isWhitelisted = await strategyCollection.connect(agentfideployer).factoryIsWhitelisted(factory)
    if(isWhitelisted != shouldWhitelist) diffs.push(expectedSettings[i])
  }
  if(diffs.length > 0) {
    console.log("Whitelisting strategy factories")
    let tx = await strategyCollection.connect(agentfideployer).setWhitelist(diffs, networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log("Whitelisted strategy factories")
  }
}

async function setMaxCreationsPerGenesisAgent() {
  console.log("setMaxCreationsPerGenesisAgent")
  let tx = await strategyFactory.connect(agentfideployer).setMaxCreationsPerGenesisAgent(100, networkSettings.overrides)
  await tx.wait(networkSettings.confirmations)
  console.log("setMaxCreationsPerGenesisAgent")
}

// 1: create new strategy agent
// vanilla. has no overrides and no strategy managers
async function postStrategyAgentCreationSettings_1() {
  let expectedSettingsID = 1
  let count = (await strategyFactory.getAgentCreationSettingsCount()).toNumber()
  if(count >= expectedSettingsID) return // already created
  if(count != expectedSettingsID - 1) throw new Error("postAgentCreationSettings out of order")
  console.log(`Calling postStrategyAgentCreationSettings_${expectedSettingsID}`)

  let blastcalldata0 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let agentInitializationCode0 = strategyAccountImpl.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata0, 0]);
  let blastcalldata1 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let agentInitializationCode1 = strategyAccountImpl.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata1, 0]);
  let blastPointsCalldata2 = iblastpoints.interface.encodeFunctionData("configurePointsOperator", [BLAST_POINTS_OPERATOR_ADDRESS])
  let agentInitializationCode2 = strategyAccountImpl.interface.encodeFunctionData("execute", [BLAST_POINTS_ADDRESS, 0, blastPointsCalldata2, 0]);

  let params = {
    agentImplementation: strategyAccountImpl.address,
    initializationCalls: [
      agentInitializationCode0,
      agentInitializationCode1,
      agentInitializationCode2,
    ],
    isActive: true,
  }
  let tx = await strategyFactory.connect(agentfideployer).postAgentCreationSettings(params, networkSettings.overrides)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="AgentCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postStrategyAgentCreationSettings_${expectedSettingsID}`)
}

// 2: create new strategy agent
// has a strategy manager
async function postStrategyAgentCreationSettings_2() {
  let expectedSettingsID = 2
  let count = (await strategyFactory.getAgentCreationSettingsCount()).toNumber()
  if(count >= expectedSettingsID) return // already created
  if(count != expectedSettingsID - 1) throw new Error("postAgentCreationSettings out of order")
  console.log(`Calling postStrategyAgentCreationSettings_${expectedSettingsID}`)

  let calldata0 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let calldata1 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let calldata2 = iblastpoints.interface.encodeFunctionData("configurePointsOperator", [BLAST_POINTS_OPERATOR_ADDRESS])

  let batch = [
    {
      to: BLAST_ADDRESS,
      value: 0,
      data: calldata0,
      operation: 0,
    },
    {
      to: BLAST_ADDRESS,
      value: 0,
      data: calldata1,
      operation: 0,
    },
    {
      to: BLAST_POINTS_ADDRESS,
      value: 0,
      data: calldata2,
      operation: 0,
    },
  ]

  let agentInitializationCode0 = strategyAccountImpl.interface.encodeFunctionData("executeBatch", [batch]);

  let roles = [
    {
      role: STRATEGY_MANAGER_ROLE,
      account: DISPATCHER_ADDRESS,
      grantAccess: true,
    }
  ]
  let agentInitializationCode1 = strategyAccountImpl.interface.encodeFunctionData("setRoles", [roles]);

  let params = {
    agentImplementation: strategyAccountImpl.address,
    initializationCalls: [
      agentInitializationCode0,
      agentInitializationCode1,
    ],
    isActive: true,
  }
  let tx = await strategyFactory.connect(agentfideployer).postAgentCreationSettings(params, networkSettings.overrides)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="AgentCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postStrategyAgentCreationSettings_${expectedSettingsID}`)
}

async function addOperatorsToDispatcher() {
  console.log('addOperatorsToDispatcher')
  let operators = [{
      account: agentfideployer.address,
      isAuthorized: true,
  }]
  let tx = await dispatcher.connect(agentfideployer).setOperators(operators, networkSettings.overrides)
  let receipt = await tx.wait(networkSettings.confirmations)
  console.log('addOperatorsToDispatcher')
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
