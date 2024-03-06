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
const MULTICALL_FORWARDER_ADDRESS     = "0x26aDd0cB3eA65ADBb063739A5C5735055029B6BD"; // genesis
const CONTRACT_FACTORY_ADDRESS        = "0x9D735e7926729cAB93b10cb5814FF8487Fb6D5e8"; // genesis

const GAS_COLLECTOR_ADDRESS           = "0xf237c20584DaCA970498917470864f4d027de4ca"; // genesis
const BALANCE_FETCHER_ADDRESS         = "0x5f3Ab2963DD2c61c6d69a3E42f51135cfdC189B0"; // genesis

const GENESIS_COLLECTION_ADDRESS      = "0x5066A1975BE96B777ddDf57b496397efFdDcB4A9"; // genesis
const GENESIS_FACTORY_ADDRESS         = "0x700b6f8B315247DD41C42A6Cfca1dAE6B4567f3B"; // genesis
const ACCOUNT_IMPL_BASE_ADDRESS       = "0x8836060137a20E41d599565F644D9EB0807A5353"; // genesis

// tokens
const ETH_ADDRESS                = "0x0000000000000000000000000000000000000000";
const ALL_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000001";
const MAX_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000002";
const WETH_ADDRESS               = "0x4200000000000000000000000000000000000023";
const USDB_ADDRESS               = "0x4200000000000000000000000000000000000022";

let iblast: IBlast;
let gasCollector: GasCollector;
let genesisCollection: BlastooorGenesisAgents;
let genesisFactory: BlastooorGenesisFactory;
let accountImplBase: BlastAgentAccount; // the base implementation for agentfi accounts

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

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, boombotseth) as IBlast;

  gasCollector = await ethers.getContractAt("GasCollector", GAS_COLLECTOR_ADDRESS, agentfideployer) as GasCollector;
  genesisCollection = await ethers.getContractAt("BlastooorGenesisAgents", GENESIS_COLLECTION_ADDRESS, agentfideployer) as BlastooorGenesisAgents;
  genesisFactory = await ethers.getContractAt("BlastooorGenesisFactory", GENESIS_FACTORY_ADDRESS, agentfideployer) as BlastooorGenesisFactory;
  accountImplBase = await ethers.getContractAt("BlastAgentAccount", ACCOUNT_IMPL_BASE_ADDRESS, agentfideployer) as BlastAgentAccount;

  usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS, agentfideployer) as MockERC20;

  //await configureContractFactoryGasGovernor();

  //await postAgentCreationSettings_blastooor();
  //await addSigners()

  //await whitelistFactories();
  await setNftMetadata();

  //await configureGasCollector();
  //await collectGasRewards();

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

async function setNftMetadata() {
  let txdatas = [] as any[]
  //let desiredContractURI = "https://stats-cdn.agentfi.io/contractURI.json"
  //let desiredBaseURI = "https://stats.agentfi.io/agents/metadata/?chainID=168587773&v=0.1.4&agentID="
  let desiredContractURI = ""
  let desiredBaseURI = "https://nwxak6fnj1.execute-api.us-east-2.amazonaws.com/dev/get-meta/"
  let currentContractURI = await genesisCollection.contractURI()
  let currentBaseURI = await genesisCollection.baseURI()
  if(currentContractURI != desiredContractURI) {
    //txdatas.push(genesisCollection.interface.encodeFunctionData("setContractURI", [desiredContractURI]))
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

  const timestampAllowlistMintStart = 1709355600
  const timestampAllowlistMintEnd = 1709398800
  //const timestampPublicMintStart = 1809356500
  //const timestampPublicMintStart = 1709356500

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

  console.log(`Called postAgentCreationSettings_blastooor`)
}

async function addSigners() {
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
