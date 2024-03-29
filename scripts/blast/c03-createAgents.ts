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

const DEX_BALANCER_MODULE_A_ADDRESS   = "0x35a4B9B95bc1D93Bf8e3CA9c030fc15726b83E6F"; // v1.0.1

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
let genesisAgent5Address = "";
let genesisAgent5: BlastooorAgentAccount;

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

  //genesisAgent5 = await ethers.getContractAt("BlastooorGenesisAgentAccount", genesisAgent5Address, boombotseth) as BlastooorGenesisAgentAccount;
  genesisAgent5 = await ethers.getContractAt("BlastooorGenesisAgentAccount", AddressZero, boombotseth) as BlastooorGenesisAgentAccount;


  //await listGenesisAgents();
  //await listStrategyAgents();
  //await listGenesisAgents(boombotseth.address);
  //await listStrategyAgents(boombotseth.address);
  await listAgentsOf(agentfideployer.address);

  await createAgents();

  //await listStrategyAgents();

  await listAgentsOf(agentfideployer.address);
  //await listAgentsOf(boombotseth.address);

}

async function listGenesisAgents(filterbyowner=undefined) {
  let ts = (await genesisCollection.totalSupply()).toNumber();
  console.log(`Number genesis agents created: ${ts}`);
  if(ts == 0) return;
  console.log("Info:")
  let calls = [] as any[]
  for(let agentID = 1; agentID <= ts; agentID++) {
    //calls.push(genesisCollectionMC.getAgentInfo(agentID))
    calls.push(agentRegistryMC.getTbasOfNft(genesisCollection.address, agentID))
    calls.push(genesisCollectionMC.ownerOf(agentID))
  }
  const results = await multicallChunked(mcProvider, calls, "latest", 500)
  for(let agentID = 1; agentID <= ts; agentID++) {
    let agentInfo = results[agentID*2-2]
    let agentAddress = agentInfo.agentAddress
    let implementationAddress = agentInfo.implementationAddress
    let owner = results[agentID*2-1]
    if(!!filterbyowner && owner != filterbyowner) continue
    console.log(`Agent ID ${agentID}`)
    //console.log(`  Agent Address  ${agentAddress}`)
    //console.log(`  TBA Impl       ${implementationAddress}`)
    console.log(`  Owner          ${owner}`)
    console.log(`  # TBAs:        ${agentInfo.length}`)
    for(let j = 0; j < agentInfo.length; j++) {
      let { agentAddress, implementationAddress } = agentInfo[j]
      console.log(`      TBA ${j} Agent Address : ${agentAddress}`)
      console.log(`             Impl Address : ${implementationAddress}`)
    }
  }
}

async function listStrategyAgents(filterbyowner=undefined) {
  let ts = (await strategyCollection.totalSupply()).toNumber();
  console.log(`Number strategy agents created: ${ts}`);
  if(ts == 0) return;
  console.log("Info:")
  let calls = [] as any[]
  for(let agentID = 1; agentID <= ts; agentID++) {
    calls.push(agentRegistryMC.getTbasOfNft(strategyCollection.address, agentID))
    calls.push(strategyCollectionMC.ownerOf(agentID))
  }
  const results = await multicallChunked(mcProvider, calls, "latest", 500)
  for(let agentID = 1; agentID <= ts; agentID++) {
    let agentInfo = results[agentID*2-2]
    let agentAddress = agentInfo.agentAddress
    let implementationAddress = agentInfo.implementationAddress
    let owner = results[agentID*2-1]
    if(!!filterbyowner && owner != filterbyowner) continue
    console.log(`Agent ID ${agentID}`)
    console.log(`  Owner          ${owner}`)
    console.log(`  # TBAs:        ${agentInfo.length}`)
    for(let j = 0; j < agentInfo.length; j++) {
      let { agentAddress, implementationAddress } = agentInfo[j]
      console.log(`      TBA ${j} Agent Address : ${agentAddress}`)
      console.log(`             Impl Address : ${implementationAddress}`)
    }
  }
}

async function listAgentsOf(account:string) {
  let collections = [
    GENESIS_COLLECTION_ADDRESS,
    STRATEGY_COLLECTION_ADDRESS
  ]
  let tokens = [
    ETH_ADDRESS,
    ALL_CLAIMABLE_GAS_ADDRESS,
    MAX_CLAIMABLE_GAS_ADDRESS,
    WETH_ADDRESS,
    USDB_ADDRESS,
  ]
  let res = await balanceFetcher.callStatic.fetchAgents(account, collections, tokens)
  console.log(`fetchAgentsOf(${account}) returned ${res.length} results`)
  for(let i = 0; i < res.length; i++) {
    console.log(`res ${i}`)
    //console.log(res[i])
    console.log({
      agentAddress: res[i].agentAddress,
      implementation: res[i].implementation,
      owner: res[i].owner,
      collection: res[i].collection,
      agentID: res[i].agentID.toNumber(),
      balances: res[i].balances.map(x=>x.toString()),
    })
  }
  //console.log(res)
  console.log(`genesis  agentIDs : ${res.filter(x=>x.collection==GENESIS_COLLECTION_ADDRESS).map(x=>x.agentID.toString()).join(', ')}`)
  console.log(`strategy agentIDs : ${res.filter(x=>x.collection==STRATEGY_COLLECTION_ADDRESS).map(x=>x.agentID.toString()).join(', ')}`)
}

async function createAgents() {
  //await createStrategyAgent1();
  //await createStrategyAgent2();
  //await createStrategyAgent3();
  //await createStrategyAgent3();

  //await createStrategyAgent17();
  //await createStrategyAgent19();

  //await createStrategyAgent1();
  await createStrategyAgent2();
}

async function createStrategy(
  sender:any,
  genesisAgentID:any,
  genesisConfigID:any,
  //strategyFactoryCalldata:any,
  strategyConfigID:any,
  depositAmountETH:any,
  tokenDeposits:any[]

) {
  console.log(`Creating new strategy`)

  // calculate deposit amount ETH
  //let depositAmountETH = Zero
  //let depositETH = tokenDeposits.filter(x=>x.token==AddressZero)


  let genesisTbas = await agentRegistry.getTbasOfNft(genesisCollection.address, genesisAgentID)
  var genesisAgentAddress
  // if a new genesis tba needs to be created
  if(genesisTbas.length == 0) {
    console.log(`Genesis agent ${genesisAgentID} has not yet created a new TBA. This tx will create:`)
    console.log(`- a new TBA for genesis agent ${genesisAgentID}`)
    console.log(`- a new strategy agent. comes with an NFT and TBA`)
    // precalculate the address for the new TBA
    let creationIndex = (await genesisAccountFactory.getCreateCount(genesisAgentID)).toNumber() + 1
    genesisAgentAddress = await erc6551Registry.connect(sender).account(genesisAccountImpl.address, toBytes32(creationIndex), chainID, genesisCollection.address, genesisAgentID)
  }
  // if only need to create the strategy
  else {
    console.log(`This tx will create a new strategy agent. comes with an NFT and TBA`)
    genesisAgentAddress = genesisTbas[0].agentAddress
  }

  // check token approvals
  let numERC20s = 0
  let genesisCallBatch = []
  //let strategyCallBatch = []
  for(let i = 0; i < tokenDeposits.length; ++i) {
    let { token, amount } = tokenDeposits[i]
    if(token != AddressZero) {
      ++numERC20s;
      let tokenContract = await ethers.getContractAt("MockERC20", token, sender) as MockERC20;
      let allowance = await tokenContract.allowance(sender.address, genesisAgentAddress)
      if(allowance.lt(amount)) {
        console.log(`approving token ${token} to genesis agent`)
        let tx = await tokenContract.approve(genesisAgentAddress, MaxUint256, networkSettings.overrides)
        await tx.wait(networkSettings.confirmations)
      }
      genesisCallBatch.push({
        to: token,
        value: 0,
        data: tokenContract.interface.encodeFunctionData("transferFrom", [sender.address, strategyFactory.address, amount]),
        operation: 0
      })
    }
  }

  var strategyFactoryCalldata
  if(tokenDeposits.length == 0) {
    strategyFactoryCalldata = strategyFactory.interface.encodeFunctionData("createAgent(uint256)", [strategyConfigID])
  }
  else {
    strategyFactoryCalldata = strategyFactory.interface.encodeFunctionData("createAgent(uint256,(address,uint256)[])", [strategyConfigID, tokenDeposits])
  }
  //let strategyFactoryCalldata = strategyFactory.interface.encodeFunctionData("createAgent(uint256)", [strategyConfigID])

  genesisCallBatch.push({
    to: strategyFactory.address,
    value: depositAmountETH,
    data: strategyFactoryCalldata,
    operation: 0
  })
  console.log(`tokens approved`)
  var genesisAgentCalldata
  // if only one call to execute
  if(genesisCallBatch.length == 1) {
    let { to, value, data, operation } = genesisCallBatch[0]
    genesisAgentCalldata = genesisAgent5.interface.encodeFunctionData("execute", [to, value, data, operation])
  }
  // if more than one call
  else {
    genesisAgentCalldata = genesisAgent5.interface.encodeFunctionData("executeBatch", [genesisCallBatch])
  }

  var tx
  // if a new genesis tba needs to be created
  if(genesisTbas.length == 0) {

    // use multicall forwarder to create and call new agent

    // if need to transfer in eth
    if(!Zero.eq(depositAmountETH)) {
      let calls = [
        {
          target: genesisAccountFactory.address,
          callData: genesisAccountFactory.interface.encodeFunctionData('createAccount(uint256,uint256)', [genesisAgentID, genesisConfigID]),
          allowFailure: false,
          value: 0,
        },
        {
          target: genesisAgentAddress,
          callData: genesisAgentCalldata,
          allowFailure: false,
          value: depositAmountETH,
        },
      ]
      console.log('here 1.1')
      tx = await multicallForwarder.connect(sender).aggregate3Value(calls, {...networkSettings.overrides, value: depositAmountETH, gasLimit: 3_000_000})
      console.log('here 1.2')
    }
    // if no eth
    else {
      let calls = [
        {
          target: genesisAccountFactory.address,
          callData: genesisAccountFactory.interface.encodeFunctionData('createAccount(uint256,uint256)', [genesisAgentID, genesisConfigID]),
        },
        {
          target: genesisAgentAddress,
          callData: genesisAgentCalldata,
        },
      ]
      console.log('here 2.1')
      tx = await multicallForwarder.connect(sender).aggregate(calls, {...networkSettings.overrides})
      console.log('here 2.2')
    }
  }
  // if only need to create the strategy
  else {
    // get the genesis agent
    let accountProxy = await ethers.getContractAt("BlastooorGenesisAgentAccount", genesisAgentAddress, sender) as BlastooorGenesisAgentAccount;
    console.log('here 3.1')
    tx = await sender.sendTransaction({
      to: accountProxy.address,
      data: genesisAgentCalldata,
      ...networkSettings.overrides,
      value: depositAmountETH
    })
    console.log('here 3.2')
  }
  //console.log('tx')
  //console.log(tx)
  //console.log('here 4')
  //await tx.wait(networkSettings.confirmations)
  await watchTxForEvents(tx)

  console.log(`Created new strategy`)
}

// creates strategy agent 1
async function createStrategyAgent1() {
  console.log(`createStrategyAgent1`)

  // assemble the create strategy calldata
  let strategyConfigID = 1
  //let strategyFactoryCalldata = strategyFactory.interface.encodeFunctionData("createAgent(uint256)", [strategyConfigID])
  let genesisConfigID = 1


  let depositAmountETH = WeiPerEther.div(1000)
  //let depositAmountUSDB = WeiPerEther.mul(1)
  let tokenDeposits = [
    {
      token: AddressZero,
      amount: depositAmountETH,
    },
    /*
    {
      token: usdb.address,
      amount: depositAmountUSDB,
    }
    */
  ]

  //let depositAmountETH = Zero
  //let tokenDeposits = []

  await createStrategy(
    agentfideployer,
    genesisAgent5ID,
    genesisConfigID,
    //strategyFactoryCalldata,
    strategyConfigID,
    depositAmountETH,
    tokenDeposits
  )
}

// creates strategy agent 2
async function createStrategyAgent2() {
  console.log(`createStrategyAgent2`)

  // assemble the create strategy calldata
  let strategyConfigID = 3 // dex balancer module A
  //let strategyFactoryCalldata = strategyFactory.interface.encodeFunctionData("createAgent(uint256)", [strategyConfigID])
  let genesisConfigID = 1


  let depositAmountETH = WeiPerEther.div(1000)
  let depositAmountUSDB = WeiPerEther.mul(1)
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

  //let depositAmountETH = Zero
  //let tokenDeposits = []

  await createStrategy(
    agentfideployer,
    genesisAgent5ID,
    genesisConfigID,
    //strategyFactoryCalldata,
    strategyConfigID,
    depositAmountETH,
    tokenDeposits
  )
}


async function watchTxForEvents(tx:any) {
  console.log("tx:", tx);
  let receipt = await tx.wait(networkSettings.confirmations);
  //let receipt = await tx.wait(0);
  if(!receipt || !receipt.logs || receipt.logs.length == 0) {
    console.log(receipt)
    throw new Error("events not found");
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
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
