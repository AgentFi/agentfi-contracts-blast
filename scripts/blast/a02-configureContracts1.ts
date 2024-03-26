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

import { Agents, BlastooorAgentAccount, AgentFactory01, AgentFactory02, AgentFactory03, IBlast, ContractFactory, GasCollector, BalanceFetcher } from "../../typechain-types";

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
const BLAST_POINTS_ADDRESS            = "0x2536FE9ab3F511540F2f9e2eC2A805005C3Dd800";
const BLAST_POINTS_OPERATOR_ADDRESS   = "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";

const ENTRY_POINT_ADDRESS             = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const MULTICALL_FORWARDER_ADDRESS     = "0xAD55F8b65d5738C6f63b54E651A09cC5d873e4d8"; // v1.0.1
const CONTRACT_FACTORY_ADDRESS        = "0x9D735e7926729cAB93b10cb5814FF8487Fb6D5e8"; // v1.0.0

const GAS_COLLECTOR_ADDRESS           = "0xf237c20584DaCA970498917470864f4d027de4ca"; // v1.0.0
const BALANCE_FETCHER_ADDRESS         = "0x3f8Dc480BEAeF711ecE5110926Ea2780a1db85C5"; // v1.0.1

const GENESIS_COLLECTION_ADDRESS      = "0x5066A1975BE96B777ddDf57b496397efFdDcB4A9"; // v1.0.0
const GENESIS_FACTORY_ADDRESS         = "0x700b6f8B315247DD41C42A6Cfca1dAE6B4567f3B"; // v1.0.0
const GENESIS_ACCOUNT_IMPL_ADDRESS    = "0xb9b7FFBaBEC52DFC0589f7b331E4B8Cb78E06301"; // v1.0.1
const GENESIS_ACCOUNT_FACTORY_ADDRESS = "0x101E03D71e756Da260dC5cCd19B6CdEEcbB4397F"; // v1.0.1

const AGENT_REGISTRY_ADDRESS          = "0x12F0A3453F63516815fe41c89fAe84d218Af0FAF"; // v1.0.1

const STRATEGY_COLLECTION_ADDRESS     = "0x73E75E837e4F3884ED474988c304dE8A437aCbEf"; // v1.0.1
const STRATEGY_FACTORY_ADDRESS        = "0x09906C1eaC081AC4aF24D6F7e05f7566440b4601"; // v1.0.1
const STRATEGY_ACCOUNT_IMPL_ADDRESS   = "0x4b1e8C60E4a45FD64f5fBf6c497d17Ab12fba213"; // v1.0.1

const DISPATCHER_ADDRESS              = "0x59c0269f4120058bA195220ba02dd0330d92c36D"; // v1.0.1

const DEX_BALANCER_MODULE_A_ADDRESS   = "0x067299A9C3F7E8d4A9d9dD06E2C1Fe3240144389"; // v1.0.1

const STRATEGY_MANAGER_ROLE = "0x4170d100a3a3728ae51207936ee755ecaa64a7f6e9383c642ab204a136f90b1b";

// tokens
const ETH_ADDRESS                = "0x0000000000000000000000000000000000000000";
const ALL_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000001";
const MAX_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000002";
const WETH_ADDRESS               = "0x4300000000000000000000000000000000000004";
const USDB_ADDRESS               = "0x4300000000000000000000000000000000000003";

let iblast: IBlast;
let iblastpoints: IBlastPoints;

let multicallForwarder: MulticallForwarder;
let contractFactory: ContractFactory;
let gasCollector: GasCollector;
let balanceFetcher: BalanceFetcher;

let genesisCollection: BlastooorGenesisAgents;
let genesisFactory: BlastooorGenesisFactory;
let genesisAccountImpl: BlastooorGenesisAgentAccount;
let genesisAccountFactory: BlastooorAccountFactory;

let agentRegistry: AgentRegistry;

let strategyCollection: BlastooorStrategyAgents;
let strategyFactory: BlastooorStrategyFactory;
let strategyAccountImpl: BlastooorStrategyAgentAccount;

let dispatcher: Dispatcher;

let dexBalancerModuleA: DexBalancerModuleA;

let usdb: MockERC20;

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${agentfideployer.address} as agentfideployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(81457, "blast")) throw("Only run this on Blast Mainnet or a local fork of Blast Mainnet");
  //await expectDeployed(ERC6551_REGISTRY_ADDRESS)
  await expectDeployed(ENTRY_POINT_ADDRESS)
  await expectDeployed(MULTICALL_FORWARDER_ADDRESS)
  await expectDeployed(CONTRACT_FACTORY_ADDRESS)
  await expectDeployed(GAS_COLLECTOR_ADDRESS)
  await expectDeployed(BALANCE_FETCHER_ADDRESS)
  await expectDeployed(GENESIS_COLLECTION_ADDRESS)
  await expectDeployed(GENESIS_FACTORY_ADDRESS)
  await expectDeployed(GENESIS_ACCOUNT_IMPL_ADDRESS)
  await expectDeployed(GENESIS_ACCOUNT_FACTORY_ADDRESS)
  await expectDeployed(AGENT_REGISTRY_ADDRESS)
  await expectDeployed(STRATEGY_COLLECTION_ADDRESS)
  await expectDeployed(STRATEGY_FACTORY_ADDRESS)
  await expectDeployed(STRATEGY_ACCOUNT_IMPL_ADDRESS)
  await expectDeployed(DISPATCHER_ADDRESS)
  await expectDeployed(DEX_BALANCER_MODULE_A_ADDRESS)

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, agentfideployer) as IBlast;
  iblastpoints = await ethers.getContractAt("IBlastPoints", BLAST_POINTS_ADDRESS, agentfideployer) as IBlastPoints;

  gasCollector = await ethers.getContractAt("GasCollector", GAS_COLLECTOR_ADDRESS, agentfideployer) as GasCollector;
  balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, agentfideployer) as BalanceFetcher;
  genesisCollection = await ethers.getContractAt("BlastooorGenesisAgents", GENESIS_COLLECTION_ADDRESS, agentfideployer) as BlastooorGenesisAgents;
  genesisFactory = await ethers.getContractAt("BlastooorGenesisFactory", GENESIS_FACTORY_ADDRESS, agentfideployer) as BlastooorGenesisFactory;
  genesisAccountImpl = await ethers.getContractAt("BlastooorGenesisAgentAccount", GENESIS_ACCOUNT_IMPL_ADDRESS, agentfideployer) as BlastooorGenesisAgentAccount;
  genesisAccountFactory = await ethers.getContractAt("BlastooorAccountFactory", GENESIS_ACCOUNT_FACTORY_ADDRESS, agentfideployer) as BlastooorAccountFactory;
  agentRegistry = await ethers.getContractAt("AgentRegistry", AGENT_REGISTRY_ADDRESS, agentfideployer) as AgentRegistry;
  strategyCollection = await ethers.getContractAt("BlastooorStrategyAgents", STRATEGY_COLLECTION_ADDRESS, agentfideployer) as BlastooorStrategyAgents;
  strategyFactory = await ethers.getContractAt("BlastooorStrategyFactory", STRATEGY_FACTORY_ADDRESS, agentfideployer) as BlastooorStrategyFactory;
  strategyAccountImpl = await ethers.getContractAt("BlastooorStrategyAgentAccount", STRATEGY_ACCOUNT_IMPL_ADDRESS, agentfideployer) as BlastooorStrategyAgentAccount;
  dispatcher = await ethers.getContractAt("Dispatcher", DISPATCHER_ADDRESS, agentfideployer) as Dispatcher;
  multicallForwarder = await ethers.getContractAt("MulticallForwarder", MULTICALL_FORWARDER_ADDRESS, agentfideployer) as MulticallForwarder;
  dexBalancerModuleA = await ethers.getContractAt("DexBalancerModuleA", DEX_BALANCER_MODULE_A_ADDRESS, agentfideployer) as DexBalancerModuleA;
  usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS, agentfideployer) as MockERC20;

  //await configureContractFactoryGasGovernor();

  //await postAgentCreationSettings_blastooor_genesis();
  //await addGenesisMintSigners()
  //await postAgentCreationSettings_blastooor_genesis_2();

  //await whitelistGenesisFactories();
  //await setGenesisNftMetadata();

  //await configureGasCollector();
  //await collectGasRewards();




  //await agentRegistrySetOperators();
  //await setGenesisMaxAccountCreationsPerAgent();
  //await postGenesisAccountCreationSettings_1();
  //await whitelistStrategyFactories();
  //await setMaxCreationsPerGenesisAgent();
  //await setStrategyNftMetadata();
  //await postStrategyAgentCreationSettings_1();
  //await postStrategyAgentCreationSettings_2();
  await postStrategyAgentCreationSettings_3();
  //await addOperatorsToDispatcher();
}

async function configureContractFactoryGasGovernor() {
  console.log("Configuring contract factory gas governor")
  let tx = await iblast.connect(agentfideployer).configureGovernorOnBehalf(gasCollector.address, CONTRACT_FACTORY_ADDRESS, networkSettings.overrides)
  await tx.wait(networkSettings.confirmations)
  console.log("Configured contract factory gas governor")
}

async function whitelistGenesisFactories() {
  let expectedSettings = [
    {
      factory: GENESIS_FACTORY_ADDRESS,
      shouldWhitelist: true,
    },
  ]
  let diffs = [] as any[]
  for(let i = 0; i < expectedSettings.length; i++) {
    let { factory , shouldWhitelist } = expectedSettings[i]
    let isWhitelisted = await genesisCollection.connect(boombotseth).factoryIsWhitelisted(factory)
    if(isWhitelisted != shouldWhitelist) diffs.push(expectedSettings[i])
  }
  if(diffs.length > 0) {
    console.log("Whitelisting factories")
    let tx = await genesisCollection.connect(agentfideployer).setWhitelist(diffs, networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log("Whitelisted factories")
  }
}

async function setGenesisNftMetadata() {
  let txdatas = [] as any[]
  let desiredContractURI = "https://stats-cdn.agentfi.io/contractURI.json"
  //let desiredBaseURI = "https://nwxak6fnj1.execute-api.us-east-2.amazonaws.com/dev/get-meta/"
  let desiredBaseURI = "https://stats.agentfi.io/agents/metadata?chainID=81457&v=100&agentID="
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

// postAgentCreationSettings_blastooor_genesis
async function postAgentCreationSettings_blastooor_genesis() {
  console.log(`Calling postAgentCreationSettings_blastooor_genesis`)

  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let agentInitializationCode3 = accountImplBase.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let agentInitializationCode4 = accountImplBase.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);

  const timestampAllowlistMintStart = 1709355600
  const timestampAllowlistMintEnd = 1709398800

  let params = {
    agentImplementation: accountImplBase.address,
    initializationCalls: [
      agentInitializationCode3,
      agentInitializationCode4,
    ],
    isActive: true,
    paymentAmount: WeiPerEther.mul(1).div(100),
    paymentReceiver: agentfideployer.address,
    timestampAllowlistMintStart: timestampAllowlistMintStart,
    timestampAllowlistMintEnd: timestampAllowlistMintEnd,
    timestampPublicMintStart: timestampPublicMintStart,
  }
  let tx = await genesisFactory.connect(agentfideployer).postAgentCreationSettings(params)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="AgentCreationSettingsPosted")[0]

  console.log(`Called postAgentCreationSettings_blastooor_genesis`)
}

// postAgentCreationSettings_blastooor_genesis_2
async function postAgentCreationSettings_blastooor_genesis_2() {
  console.log(`Calling postAgentCreationSettings_blastooor_genesis_2`)

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
    isActive: true,
    paymentAmount: 0,
    paymentReceiver: agentfideployer.address,
    timestampAllowlistMintStart: 0,
    timestampAllowlistMintEnd: 0,
    timestampPublicMintStart: 0,
  }
  let txdata0 = genesisFactory.interface.encodeFunctionData("postAgentCreationSettings", [params])
  let txdata1 = genesisFactory.interface.encodeFunctionData("addTreasuryMinter", [agentfideployer.address])
  let tx = await genesisFactory.connect(agentfideployer).multicall([txdata0, txdata1], networkSettings.overrides)
  let receipt = await tx.wait(networkSettings.confirmations)

  console.log(`Called postAgentCreationSettings_blastooor_genesis_2`)
}

async function addGenesisMintSigners() {
  console.log(`Adding signers`)
  let tx = await genesisFactory.connect(agentfideployer).addSigner(allowlistSignerAddress, networkSettings.overrides)
  let receipt = await tx.wait(networkSettings.confirmations)
  console.log(`Added signers`)
}

async function configureGasCollector() {
  let contractListExpected = deduplicateArray([
    GAS_COLLECTOR_ADDRESS,
    //CONTRACT_FACTORY_ADDRESS,
    AGENT_NFT_ADDRESS,
    ACCOUNT_IMPL_BROKEN_ADDRESS,
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



// agent registry

async function agentRegistrySetOperators() {
  let expectedSettings = [
    {
      account: genesisAccountFactory.address,
      isAuthorized: true,
    },
    {
      account: strategyFactory.address,
      isAuthorized: true,
    },
  ]
  let diffs = [] as any[]
  for(let i = 0; i < expectedSettings.length; i++) {
    let { account , isAuthorized } = expectedSettings[i]
    let isOperator = await agentRegistry.connect(agentfideployer).isOperator(account)
    if(isOperator != isAuthorized) diffs.push(expectedSettings[i])
  }
  if(diffs.length > 0) {
    console.log("AgentRegistry setting operators")
    let tx = await agentRegistry.connect(agentfideployer).setOperators(diffs, networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log("AgentRegistry set operators")
  }
}

// genesis account factory

async function setGenesisMaxAccountCreationsPerAgent() {
  console.log("calling genesisAccountFactory.setMaxCreationsPerAgent()")
  let tx = await genesisAccountFactory.connect(agentfideployer).setMaxCreationsPerAgent(1, networkSettings.overrides)
  await tx.wait(networkSettings.confirmations)
  console.log("called genesisAccountFactory.setMaxCreationsPerAgent()")
}

async function postGenesisAccountCreationSettings_1() {
  let expectedSettingsID = 1
  let count = (await genesisAccountFactory.getAgentCreationSettingsCount()).toNumber()
  if(count >= expectedSettingsID) return // already created
  if(count != expectedSettingsID - 1) throw new Error("postAgentCreationSettings out of order")
  console.log(`Calling postGenesisAccountCreationSettings_${expectedSettingsID}`)

  let params = {
    agentImplementation: genesisAccountImpl.address,
    initializationCalls: [
      genesisAccountImpl.interface.encodeFunctionData("blastConfigure"),
    ],
    isActive: true
  }
  let tx = await genesisAccountFactory.connect(agentfideployer).postAgentCreationSettings(params, networkSettings.overrides)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="AgentCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postGenesisAccountCreationSettings_${expectedSettingsID}`)
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


async function setStrategyNftMetadata() {
  let txdatas = [] as any[]
  let desiredContractURI = "https://stats-cdn.agentfi.io/contractURI-blastooor-strategy.json"
  let desiredBaseURI = "https://stats.agentfi.io/agents/metadata/?chainID=81457&collection=strategy&agentID="
  let currentContractURI = await strategyCollection.contractURI()
  let currentBaseURI = await strategyCollection.baseURI()
  if(currentContractURI != desiredContractURI) {
    txdatas.push(strategyCollection.interface.encodeFunctionData("setContractURI", [desiredContractURI]))
  }
  if(currentBaseURI != desiredBaseURI) {
    txdatas.push(strategyCollection.interface.encodeFunctionData("setBaseURI", [desiredBaseURI]))
  }
  if(txdatas.length == 0) return
  var tx
  console.log("Setting Strategy NFT metadata");
  if(txdatas.length == 1) {
    tx = await agentfideployer.sendTransaction({
      to: strategyCollection.address,
      data: txdatas[0],
      ...networkSettings.overrides,
      gasLimit: 1_000_000
    })
  } else { // length > 1
    tx = await strategyCollection.connect(agentfideployer).multicall(txdatas, {...networkSettings.overrides, gasLimit: 1_000_000});
  }
  //console.log("tx:", tx);
  await tx.wait(networkSettings.confirmations);
  console.log("Set Strategy NFT metadata");
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

  let params = {
    agentImplementation: strategyAccountImpl.address,
    initializationCalls: [
      strategyAccountImpl.interface.encodeFunctionData("blastConfigure"),
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

  let roles = [
    {
      role: STRATEGY_MANAGER_ROLE,
      account: DISPATCHER_ADDRESS,
      grantAccess: true,
    }
  ]
  let agentInitializationCode0 = strategyAccountImpl.interface.encodeFunctionData("blastConfigure")
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

// 3: create new strategy agent
// turns into dex balancer strategy
async function postStrategyAgentCreationSettings_3() {
  let expectedSettingsID = 3
  let count = (await strategyFactory.getAgentCreationSettingsCount()).toNumber()
  if(count >= expectedSettingsID) return // already created
  if(count != expectedSettingsID - 1) throw new Error("postAgentCreationSettings out of order")
  console.log(`Calling postStrategyAgentCreationSettings_${expectedSettingsID}`)

  let functionParams = [
    { selector: "0x7bb485dc", isProtected: true }, // moduleA_depositBalance()
    { selector: "0xd36bfc2e", isProtected: true }, // moduleA_withdrawBalance()
    { selector: "0xc4fb5289", isProtected: true }, // moduleA_withdrawBalanceTo(address)
  ]
  let overrides = [
    {
      implementation: dexBalancerModuleA.address,
      functionParams: functionParams
    }
  ]
  let params = {
    agentImplementation: strategyAccountImpl.address,
    initializationCalls: [
      strategyAccountImpl.interface.encodeFunctionData("blastConfigure"),
      strategyAccountImpl.interface.encodeFunctionData("setOverrides", [overrides]),
      dexBalancerModuleA.interface.encodeFunctionData("moduleA_depositBalance")
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
