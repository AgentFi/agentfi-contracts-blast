import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();
const accounts = JSON.parse(process.env.ACCOUNTS || "{}");

const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const agentfideployer = new ethers.Wallet(accounts.agentfideployer.key, provider);

import { Agents, BlastooorAgentAccount, BlastooorAgentAccountRingProtocolC, BlastooorAgentAccountRingProtocolD, BlastooorAgentAccountThrusterA, BlastooorAgentAccountBasketA, AgentFactory01, AgentFactory02, AgentFactory03, BlastooorGenesisFactory, IBlast, ContractFactory, GasCollector, BalanceFetcher, MulticallForwarder, BlastooorGenesisAgents, BlastooorStrategyAgentAccount, BlastooorStrategyAgentAccountV2 } from "../../typechain-types";

import { delay } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/setStorage";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;

let networkSettings: any;
let chainID: number;

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";
const BLAST_POINTS_ADDRESS            = "0x2fc95838c71e76ec69ff817983BFf17c710F34E0";
const BLAST_POINTS_OPERATOR_ADDRESS   = "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";

const ENTRY_POINT_ADDRESS             = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const MULTICALL_FORWARDER_ADDRESS     = "0x91074d0AB2e5E4b61c4ff03A40E6491103bEB14a"; // v1.0.1
const CONTRACT_FACTORY_ADDRESS        = "0x9D735e7926729cAB93b10cb5814FF8487Fb6D5e8"; // v1.0.0

const GAS_COLLECTOR_ADDRESS           = "0xf237c20584DaCA970498917470864f4d027de4ca"; // v1.0.0
const BALANCE_FETCHER_ADDRESS         = "0x68b1a5d10FeCD6246299913a553CBb99Ac88913E"; // v1.0.1

const GENESIS_COLLECTION_ADDRESS      = "0x5066A1975BE96B777ddDf57b496397efFdDcB4A9"; // v1.0.0
const GENESIS_FACTORY_ADDRESS         = "0x700b6f8B315247DD41C42A6Cfca1dAE6B4567f3B"; // v1.0.0
const GENESIS_ACCOUNT_IMPL_ADDRESS    = "0x9DE8d1AfA3eF64AcC41Cd84533EE09A0Cd87fefF"; // v1.0.1
const GENESIS_ACCOUNT_FACTORY_ADDRESS = "0xed545485E59C4Dec4156340871CEA8242674b6a2"; // v1.0.1
const GENESIS_ACCOUNT_FACTORY_V2_ADDRESS = "0x2a3ceC83E0503Fcca9061648924Aa696496B9569"; // v1.0.2

const AGENT_REGISTRY_ADDRESS          = "0x40473B0D0cDa8DF6F73bFa0b5D35c2f701eCfe23"; // v1.0.1

let iblast: IBlast;

let multicallForwarder: MulticallForwarder;
let contractFactory: ContractFactory;
let gasCollector: GasCollector;
let balanceFetcher: BalanceFetcher;

let genesisCollection: BlastooorGenesisAgents;
let genesisFactory: BlastooorGenesisFactory;
let genesisAccountImpl: BlastooorGenesisAgentAccount;
let genesisAccountFactory: BlastooorAccountFactory;
let genesisAccountFactoryV2: BlastooorAccountFactoryV2;

let agentRegistry: AgentRegistry;

let contractsToVerify = []

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${agentfideployer.address} as agentfideployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia or a local fork of Blast Sepolia");

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

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, agentfideployer) as IBlast;

  gasCollector = await ethers.getContractAt("GasCollector", GAS_COLLECTOR_ADDRESS, agentfideployer) as GasCollector;
  balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, agentfideployer) as BalanceFetcher;
  genesisCollection = await ethers.getContractAt("BlastooorGenesisAgents", GENESIS_COLLECTION_ADDRESS, agentfideployer) as BlastooorGenesisAgents;
  genesisFactory = await ethers.getContractAt("BlastooorGenesisFactory", GENESIS_FACTORY_ADDRESS, agentfideployer) as BlastooorGenesisFactory;
  genesisAccountImpl = await ethers.getContractAt("BlastooorGenesisAgentAccount", GENESIS_ACCOUNT_IMPL_ADDRESS, agentfideployer) as BlastooorGenesisAgentAccount;
  genesisAccountFactory = await ethers.getContractAt("BlastooorAccountFactory", GENESIS_ACCOUNT_FACTORY_ADDRESS, agentfideployer) as BlastooorAccountFactory;
  agentRegistry = await ethers.getContractAt("AgentRegistry", AGENT_REGISTRY_ADDRESS, agentfideployer) as AgentRegistry;

  await deployGenesisAccountFactoryV2();

  await verifyContracts();
  logAddresses()

  await setOperators();
  await postAgentCreationSettings();

  //await create1Account();
  await createAccounts();
}

async function deployGenesisAccountFactoryV2() {
  if(await isDeployed(GENESIS_ACCOUNT_FACTORY_V2_ADDRESS)) {
    genesisAccountFactoryV2 = await ethers.getContractAt("BlastooorAccountFactoryV2", GENESIS_ACCOUNT_FACTORY_V2_ADDRESS, agentfideployer) as BlastooorAccountFactoryV2;
  } else {
    console.log("Deploying BlastooorAccountFactoryV2");
    let args = [agentfideployer.address, BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, genesisCollection.address, agentRegistry.address, ERC6551_REGISTRY_ADDRESS];
    genesisAccountFactoryV2 = await deployContractUsingContractFactory(agentfideployer, "BlastooorAccountFactoryV2", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BlastooorAccountFactoryV2;
    console.log(`Deployed BlastooorAccountFactoryV2 to ${genesisAccountFactoryV2.address}`);
    contractsToVerify.push({ address: genesisAccountFactoryV2.address, args })
    if(!!GENESIS_ACCOUNT_FACTORY_V2_ADDRESS && genesisAccountFactoryV2.address != GENESIS_ACCOUNT_FACTORY_V2_ADDRESS) throw new Error(`Deployed BlastooorAccountFactoryV2 to ${genesisAccountFactoryV2.address}, expected ${GENESIS_ACCOUNT_FACTORY_V2_ADDRESS}`)
  }
}

async function setOperators() {
  let expectedParams = [
    {
      account: genesisAccountFactoryV2.address,
      isAuthorized: true,
    }
  ]
  let diff = []
  for(let i = 0; i < expectedParams.length; i++) {
    let {account, isAuthorized} = expectedParams[i]
    let res = await agentRegistry.isOperator(account)
    if(res != isAuthorized) {
      diff.push({ account, isAuthorized })
    }
  }
  if(diff.length == 0) return
  console.log("Setting operators")
  let tx = await agentRegistry.connect(agentfideployer).setOperators(diff, {...networkSettings.overrides, gasLimit: 500_000})
  await tx.wait(networkSettings.confirmations)
  console.log("Operators set")
}

async function postAgentCreationSettings() {
  let settings = await genesisAccountFactoryV2.getAgentCreationSettings()
  if(settings.agentImplementation == genesisAccountImpl.address) return
  console.log("Posting agent creation settings")
  let tx = await genesisAccountFactoryV2.connect(agentfideployer).postAgentCreationSettings({
    agentImplementation: genesisAccountImpl.address,
    initializationCalls: [
      genesisAccountImpl.interface.encodeFunctionData("blastConfigure()")
    ]
  }, {...networkSettings.overrides, gasLimit: 500_000})
  let receipt = await tx.wait(networkSettings.confirmations)
  console.log("Posted agent creation settings")
}

async function create1Account() {
  console.log(`Creating 1 account`)
  let tx = await genesisAccountFactoryV2.connect(agentfideployer).createAccounts({...networkSettings.overrides, gasLimit: 1_000_000})
  await watchTxForEvents(tx)
  console.log(`Created 1 account`)
}

async function createAccounts() {
  let txnum = 0
  let supply = await genesisCollection.totalSupply()
  while(true) {
    let lastCheckedAgentID0 = await genesisAccountFactoryV2.lastCheckedAgentID()
    if(lastCheckedAgentID0.gte(supply)) {
      console.log(`\n\nLast agent checked: ${lastCheckedAgentID0.toNumber()}. Supply: ${supply.toNumber()}. breaking`)
      break
    }
    ++txnum
    console.log(`\n\nLast agent checked: ${lastCheckedAgentID0.toNumber()}. Supply: ${supply.toNumber()}. sending tx ${txnum}`)
    let tx = await genesisAccountFactoryV2.connect(agentfideployer).createAccounts({...networkSettings.overrides, gasLimit: 15_000_000})
    await watchTxForEvents(tx)
  }
  console.log(`Created the rest of the accounts in ${txnum} txs`)
}

async function watchTxForEvents(tx:any) {
  //console.log("tx:", tx);
  console.log("tx:", tx.hash);
  let receipt = await tx.wait(networkSettings.confirmations);
  //let receipt = await tx.wait(0);
  console.log(`gasUsed: ${receipt.gasUsed.toNumber().toLocaleString()}`)
  if(!receipt || !receipt.logs || receipt.logs.length == 0) {
    console.log(receipt)
    throw new Error("events not found");
  }
  //console.log('logs:')
  //console.log(receipt.logs)
  //console.log(`${receipt.logs.length} events`)
  for(let i = 0; i < receipt.logs.length; i++) {
    let log = receipt.logs[i]
    //console.log(`event ${i}`)
    //console.log(log)
  }
  // create genesis accounts
  let agentList = receipt.logs.filter(log => log.address == ERC6551_REGISTRY_ADDRESS).map(log => BN.from(log.topics[3]).toString())
  if(agentList.length > 0) console.log(`Created accounts for ${agentList.length} agents: ${agentList.join(', ')}`)
}

async function verifyContracts() {
  if(chainID == 31337) return
  if(contractsToVerify.length == 0) return
  console.log(`verifying ${contractsToVerify.length} contracts`)
  await delay(30_000); // likely just deployed a contract, let etherscan index it
  for(let i = 0; i < contractsToVerify.length; i++) {
    let { address, args, contractName } = contractsToVerify[i]
    await verifyContract(address, args, contractName);
  }
}

function logAddresses() {
  console.log("");
  console.log("| Contract Name                        | Address                                      |");
  console.log("|--------------------------------------|----------------------------------------------|");
  logContractAddress("BlastooorGenesisAccountFactoryV2", genesisAccountFactoryV2.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
