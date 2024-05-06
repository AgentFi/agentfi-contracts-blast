import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish, utils } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const agentfideployer = new ethers.Wallet(accounts.agentfideployer.key, provider);
const blasttestnetuser1 = new ethers.Wallet(accounts.blasttestnetuser1.key, provider);
const blasttestnetuser2 = new ethers.Wallet(accounts.blasttestnetuser2.key, provider);
const blasttestnetuser3 = new ethers.Wallet(accounts.blasttestnetuser3.key, provider);
const allowlistSignerKey = accounts.allowlistSigner.key

import { Agents, BlastooorAgentAccount, AgentFactory01, AgentFactory02, AgentFactory03 } from "../../typechain-types";

import { delay, deduplicateArray } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/setStorage";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../utils/diamond"
import { MulticallProvider, MulticallContract } from "./../utils/multicall";
import { multicallChunked } from "./../utils/network";
import { sign, assembleSignature, getMintFromAllowlistDigest, getMintFromAllowlistSignature } from "./../utils/signature";

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const { formatUnits } = ethers.utils;

let networkSettings: any;
let chainID: number;

const fs = require("fs")
const ABI_AGENTS_NFT = JSON.parse(fs.readFileSync("abi/contracts/tokens/Agents.sol/Agents.json").toString()).filter(x=>!!x&&x.type=="function")
const ABI_AGENT_REGISTRY = JSON.parse(fs.readFileSync("abi/contracts/utils/AgentRegistry.sol/AgentRegistry.json").toString()).filter(x=>!!x&&x.type=="function")
let mcProvider = new MulticallProvider(provider, 81457);

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

// tokens
const ETH_ADDRESS                = "0x0000000000000000000000000000000000000000";
const ALL_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000001";
const MAX_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000002";
const WETH_ADDRESS               = "0x4300000000000000000000000000000000000004";
const USDB_ADDRESS               = "0x4300000000000000000000000000000000000003";

let iblast: IBlast;
let iblastpoints: IBlastPoints;

let erc6551Registry: IERC6551Registry;
let multicallForwarder: MulticallForwarder;
let contractFactory: ContractFactory;
let gasCollector: GasCollector;
let balanceFetcher: BalanceFetcher;

let genesisCollection: BlastooorGenesisAgents;
let genesisCollectionMC: any;
let genesisFactory: BlastooorGenesisFactory;
let genesisAccountImpl: BlastooorGenesisAgentAccount;
let genesisAccountFactory: BlastooorAccountFactory;

let agentRegistry: AgentRegistry;
let agentRegistryMC: any;

let strategyCollection: BlastooorStrategyAgents;
let strategyCollectionMC: any;
let strategyFactory: BlastooorStrategyFactory;
let strategyAccountImpl: BlastooorStrategyAgentAccount;

let dispatcher: Dispatcher;

let dexBalancerModuleA: DexBalancerModuleA;

let weth: MockERC20;
let usdb: MockERC20;

let genesisAgent5ID = 5;
let genesisAgent5Address = "0xf93D295e760f05549451ae68A392F774428040B4";
let genesisAgent5: BlastooorGenesisAgentAccount;

let strategyAgent2ID = 2;
let strategyAgent2Address = "0xbBe2DfC636D4D68465B368597fDA6fbD21dB7da7";
let strategyAgent2: BlastooorStrategyAgentAccount;


async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${agentfideployer.address} as agentfideployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    //return ((chainID == chainid)/* || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName))*/);
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(81457, "blast")) throw("Only run this on Blast Mainnet or a local fork of Blast Mainnet");

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, agentfideployer) as IBlast;
  iblastpoints = await ethers.getContractAt("IBlastPoints", BLAST_POINTS_ADDRESS, agentfideployer) as IBlastPoints;

  erc6551Registry = await ethers.getContractAt("IERC6551Registry", ERC6551_REGISTRY_ADDRESS) as IERC6551Registry;
  balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, agentfideployer) as BalanceFetcher;
  dispatcher = await ethers.getContractAt("Dispatcher", DISPATCHER_ADDRESS, agentfideployer) as Dispatcher;
  agentRegistry = await ethers.getContractAt("AgentRegistry", AGENT_REGISTRY_ADDRESS, agentfideployer) as AgentRegistry;
  agentRegistryMC = new MulticallContract(AGENT_REGISTRY_ADDRESS, ABI_AGENT_REGISTRY)
  multicallForwarder = await ethers.getContractAt("MulticallForwarder", MULTICALL_FORWARDER_ADDRESS, agentfideployer) as MulticallForwarder;

  genesisCollection = await ethers.getContractAt("Agents", GENESIS_COLLECTION_ADDRESS, boombotseth) as Agents;
  genesisCollectionMC = new MulticallContract(GENESIS_COLLECTION_ADDRESS, ABI_AGENTS_NFT)
  genesisFactory = await ethers.getContractAt("BlastooorGenesisFactory", GENESIS_FACTORY_ADDRESS, agentfideployer) as BlastooorGenesisFactory;
  genesisAccountImpl = await ethers.getContractAt("BlastooorGenesisAgentAccount", GENESIS_ACCOUNT_IMPL_ADDRESS, agentfideployer) as BlastooorGenesisAgentAccount;
  genesisAccountFactory = await ethers.getContractAt("BlastooorAccountFactory", GENESIS_ACCOUNT_FACTORY_ADDRESS, agentfideployer) as BlastooorAccountFactory;

  strategyCollection = await ethers.getContractAt("BlastooorStrategyAgents", STRATEGY_COLLECTION_ADDRESS, agentfideployer) as BlastooorStrategyAgents;
  strategyCollectionMC = new MulticallContract(STRATEGY_COLLECTION_ADDRESS, ABI_AGENTS_NFT)
  strategyFactory = await ethers.getContractAt("BlastooorStrategyFactory", STRATEGY_FACTORY_ADDRESS, agentfideployer) as BlastooorStrategyFactory;
  strategyAccountImpl = await ethers.getContractAt("BlastooorStrategyAgentAccount", STRATEGY_ACCOUNT_IMPL_ADDRESS, agentfideployer) as BlastooorStrategyAgentAccount;

  dexBalancerModuleA = await ethers.getContractAt("DexBalancerModuleA", DEX_BALANCER_MODULE_A_ADDRESS, agentfideployer) as DexBalancerModuleA;

  weth = await ethers.getContractAt("MockERC20", WETH_ADDRESS, agentfideployer) as MockERC20;
  usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS, agentfideployer) as MockERC20;

  genesisAgent5 = await ethers.getContractAt("BlastooorGenesisAgentAccount", genesisAgent5Address, agentfideployer) as BlastooorGenesisAgentAccount;
  strategyAgent2 = await ethers.getContractAt("BlastooorStrategyAgentAccount", strategyAgent2Address, agentfideployer) as BlastooorStrategyAgentAccount;

  //await depositMore_1()
  await withdraw_1()
}

async function depositMore_1() {
  // deposit amounts
  let depositAmountETH = WeiPerEther.div(1000000)
  //let depositAmountETH = 0
  let depositAmountUSDB = WeiPerEther.mul(2)
  let tokenDeposits = [

    {
      token: AddressZero,
      amount: depositAmountETH,
    },
    {
      token: usdb.address,
      amount: depositAmountUSDB,
    }

  ]

  await depositMore(
    agentfideployer,
    genesisAgent5Address,
    strategyAgent2Address,
    depositAmountETH,
    tokenDeposits
  )
}

async function depositMore(
  sender:any,
  genesisAgentAddress:any,
  strategyAgentAddress:any,
  depositAmountETH:any,
  tokenDeposits:any[]
) {
  // check token approvals
  let numERC20s = 0
  let genesisCallBatch = []
  //let strategyCallBatch = []
  for(let i = 0; i < tokenDeposits.length; ++i) {
    let { token, amount } = tokenDeposits[i]
    if(token != AddressZero) {
      ++numERC20s;
      let tokenContract = await ethers.getContractAt("MockERC20", token, sender) as MockERC20;
      let balance = await tokenContract.balanceOf(sender.address);
      if(balance.lt(amount)) {
        throw new Error(`Insufficient balance of ${token}. Expected ${amount} have ${balance}`)
      }
      let allowance = await tokenContract.allowance(sender.address, genesisAgentAddress)
      if(allowance.lt(amount)) {
        console.log(`approving token ${token} to genesis agent`)
        let tx = await tokenContract.approve(genesisAgentAddress, MaxUint256, networkSettings.overrides)
        await tx.wait(networkSettings.confirmations)
      }
      genesisCallBatch.push({
        to: token,
        value: 0,
        data: tokenContract.interface.encodeFunctionData("transferFrom", [sender.address, strategyAgentAddress, amount]),
        operation: 0
      })
    }
    else {
      genesisCallBatch.push({
        to: strategyAgentAddress,
        value: depositAmountETH,
        data: "0x",
        operation: 0
      })
    }
  }

  genesisCallBatch.push({
    to: strategyAgentAddress,
    //value: depositAmountETH,
    value: 0,
    data: dexBalancerModuleA.interface.encodeFunctionData("moduleA_depositBalance"),
    operation: 0
  })
  console.log(`tokens approved`)
  var genesisAgentCalldata
  // if only one call to execute
  if(genesisCallBatch.length == 1) {
    let { to, value, data, operation } = genesisCallBatch[0]
    console.log("executing single")
    console.log(genesisCallBatch)
    genesisAgentCalldata = genesisAgent5.interface.encodeFunctionData("execute", [to, value, data, operation])
  }
  // if more than one call
  else {
    console.log("executing batch")
    console.log(genesisCallBatch)
    genesisAgentCalldata = genesisAgent5.interface.encodeFunctionData("executeBatch", [genesisCallBatch])
  }

  console.log('sending tx')
  let tx = await sender.sendTransaction({
    to: genesisAgentAddress,
    data: genesisAgentCalldata,
    ...networkSettings.overrides,
    value: depositAmountETH,
    gasLimit: 2_000_000,
  })
  await watchTxForEvents(tx)
}

async function withdraw_1() {
  await withdraw(
    agentfideployer,
    genesisAgent5Address,
    strategyAgent2Address,
    agentfideployer.address
  )
}

async function withdraw(
  sender:any,
  genesisAgentAddress:any,
  strategyAgentAddress:any,
  receiver:any
) {
  console.log('sending tx')
  var innerCalldata
  if(!!receiver) {
    innerCalldata = dexBalancerModuleA.interface.encodeFunctionData("moduleA_withdrawBalanceTo", [receiver])
  }
  else {
    innerCalldata = dexBalancerModuleA.interface.encodeFunctionData("moduleA_withdrawBalance")
  }
  //let tx = await genesisAgent5.connect(sender).execute(strategyAgentAddress)
  let genesisAgentCalldata = genesisAgent5.interface.encodeFunctionData("execute", [strategyAgentAddress, 0, innerCalldata, 0])
  let tx = await sender.sendTransaction({
    to: genesisAgentAddress,
    data: genesisAgentCalldata,
    ...networkSettings.overrides,
    value: 0,
    gasLimit: 2_000_000,
  })
  await watchTxForEvents(tx)
}


async function watchTxForEvents(tx:any) {
  console.log("tx:", tx);
  let receipt = await tx.wait(networkSettings.confirmations);
  //let receipt = await tx.wait(0);
  //console.log('receipt:')
  //console.log(receipt)
  if(!receipt || !receipt.logs || receipt.logs.length == 0) {
    console.log(receipt)
    //throw new Error("events not found");
    console.log("events not found");
    return;
  }
  //console.log('logs:')
  //console.log(receipt.logs)
  console.log(`${receipt.logs.length} events`)
  for(let i = 0; i < receipt.logs.length; i++) {
    let log = receipt.logs[i]
    //console.log(`event ${i}`)
    //console.log(log)
  }
  // create genesis nft
  var createEvents = (receipt.logs as any).filter((event:any) => {
    if(event.address != GENESIS_COLLECTION_ADDRESS) return false
    if(event.topics.length != 4) return false;
    if(event.topics[0] != "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") return false // transfer topic
    if(event.topics[1] != "0x0000000000000000000000000000000000000000000000000000000000000000") return false // from address zero
    return true
  });
  if(createEvents.length == 1) {
    let createEvent = createEvents[0]
    let agentID = BN.from(createEvent.topics[3]).toNumber()
    console.log(`Created 1 genesis agent NFT. agentID ${agentID}`)
  }
  if(createEvents.length > 1) {
    let agentIDs = createEvents.map((createEvent:any) => BN.from(createEvent.topics[3]).toNumber())
    console.log(`Created ${agentIDs.length} genesis agent NFTs. Agent IDs ${agentIDs.join(', ')}`)
  }
  // create genesis tba
  var registerEvents = (receipt.logs as any).filter((event:any) => {
    if(event.address != AGENT_REGISTRY_ADDRESS) return false
    if(event.topics.length != 4) return false;
    if(event.topics[0] != "0xae6249e1b0de18c2723755a5833e4712be14aaa5c1d2b8923223ad3784964f6e") return false // agent registered topic
    if(event.topics[2] != "0x0000000000000000000000005066a1975be96b777dddf57b496397effddcb4a9") return false // genesis collection
    return true
  });
  if(registerEvents.length == 1) {
    let registerEvent = registerEvents[0]
    let agentID = BN.from(registerEvent.topics[3]).toNumber()
    console.log(`Created 1 strategy agent TBA for strategy agentID ${agentID}`)
  }
  if(registerEvents.length > 1) {
    let agentIDs = createEvents.map((createEvent:any) => BN.from(createEvent.topics[3]).toNumber())
    console.log(`Created ${agentIDs.length} strategy agent TBAs for strategy agentIDs ${agentIDs.join(', ')}`)
  }
  // create strategy nft
  var createEvents = (receipt.logs as any).filter((event:any) => {
    if(event.address != STRATEGY_COLLECTION_ADDRESS) return false
    if(event.topics.length != 4) return false;
    if(event.topics[0] != "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") return false // transfer topic
    if(event.topics[1] != "0x0000000000000000000000000000000000000000000000000000000000000000") return false // from address zero
    return true
  });
  if(createEvents.length == 1) {
    let createEvent = createEvents[0]
    let agentID = BN.from(createEvent.topics[3]).toNumber()
    console.log(`Created 1 strategy agent NFT. agentID ${agentID}`)
  }
  if(createEvents.length > 1) {
    let agentIDs = createEvents.map((createEvent:any) => BN.from(createEvent.topics[3]).toNumber())
    console.log(`Created ${agentIDs.length} strategy agent NFTs. Agent IDs ${agentIDs.join(', ')}`)
  }
  // create strategy tba
  var registerEvents = (receipt.logs as any).filter((event:any) => {
    if(event.address != AGENT_REGISTRY_ADDRESS) return false
    if(event.topics.length != 4) return false;
    if(event.topics[0] != "0xae6249e1b0de18c2723755a5833e4712be14aaa5c1d2b8923223ad3784964f6e") return false // agent registered topic
    if(event.topics[2] != "0x00000000000000000000000073e75e837e4f3884ed474988c304de8a437acbef") return false // strategy collection
    return true
  });
  if(registerEvents.length == 1) {
    let registerEvent = registerEvents[0]
    let agentID = BN.from(registerEvent.topics[3]).toNumber()
    console.log(`Created 1 strategy agent TBA for strategy agentID ${agentID}`)
  }
  if(registerEvents.length > 1) {
    let agentIDs = createEvents.map((createEvent:any) => BN.from(createEvent.topics[3]).toNumber())
    console.log(`Created ${agentIDs.length} strategy agent TBAs for strategy agentIDs ${agentIDs.join(', ')}`)
  }
  // check erc20 transfers
  let tokens = [
    { address: WETH_ADDRESS, symbol: "WETH", decimals:18 },
    { address: USDB_ADDRESS, symbol: "USDB", decimals:18 },
  ]
  for(let token of tokens) {
    let { address, symbol, decimals } = token
    var transferEvents = (receipt.logs as any).filter((event:any) => {
      if(event.address != address) return false
      if(event.topics.length != 3) return false;
      if(event.topics[0] != "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") return false // transfer topic
      return true
    });
    for(let transferEvent of transferEvents) {
      console.log(`Transferred ${formatUnits(transferEvent.data, decimals)} ${symbol} from 0x${transferEvent.topics[1].substring(26)} to 0x${transferEvent.topics[2].substring(26)}`)
    }
  }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
