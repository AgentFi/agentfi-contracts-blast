import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish, utils } from "ethers";
import axios from "axios"
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
const ABI_STRATEGY_ACCOUNT = JSON.parse(fs.readFileSync("abi/contracts/accounts/BlastooorStrategyAgentAccount.sol/BlastooorStrategyAgentAccount.json").toString()).filter(x=>!!x&&x.type=="function")
const ABI_MODULE_B = JSON.parse(fs.readFileSync("abi/contracts/modules/MultiplierMaxxooorModuleB.sol/MultiplierMaxxooorModuleB.json").toString()).filter(x=>!!x&&x.type=="function")
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

const DEX_BALANCER_MODULE_A_ADDRESS_OLD   = "0x067299A9C3F7E8d4A9d9dD06E2C1Fe3240144389"; // v1.0.1
const DEX_BALANCER_MODULE_A_ADDRESS   = "0x35a4B9B95bc1D93Bf8e3CA9c030fc15726b83E6F"; // v1.0.1
const MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS  = "0x54D588243976F7fA4eaf68d77122Da4e6C811167";

// tokens
const ETH_ADDRESS                = "0x0000000000000000000000000000000000000000";
const ALL_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000001";
const MAX_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000002";
const WETH_ADDRESS               = "0x4300000000000000000000000000000000000004";
const USDB_ADDRESS               = "0x4300000000000000000000000000000000000003";

const THRUSTER_ROUTER_ADDRESS_030     = "0x98994a9A7a2570367554589189dC9772241650f6"; // 0.3% fee
const THRUSTER_ROUTER_ADDRESS_100     = "0x44889b52b71E60De6ed7dE82E2939fcc52fB2B4E"; // 1% fee
const THRUSTER_LP_TOKEN_ADDRESS       = "0x12c69BFA3fb3CbA75a1DEFA6e976B87E233fc7df";

const HYPERLOCK_STAKING_ADDRESS       = "0xC3EcaDB7a5faB07c72af6BcFbD588b7818c4a40e";

//const UNIVERSAL_ROUTER_ADDRESS        = "";
const RING_SWAP_V2_ROUTER_ADDRESS     = "0x7001F706ACB6440d17cBFaD63Fa50a22D51696fF";
const RING_STAKING_REWARDS_ADDRESS    = "0xEff87A51f5Abd015F1AFCD5737BBab450eA15A24";
const RING_FWWETH_ADDRESS             = "0x66714DB8F3397c767d0A602458B5b4E3C0FE7dd1";
const RING_FWUSDB_ADDRESS             = "0x866f2C06B83Df2ed7Ca9C2D044940E7CD55a06d6";
const RING_LP_TOKEN_ADDRESS           = "0x9BE8a40C9cf00fe33fd84EAeDaA5C4fe3f04CbC3";
const RING_FWLP_TOKEN_ADDRESS         = "0xA3F8128166E54d49A65ec2ba12b45965E4FA87C9";
//const RING_ADDRESS                    = "";
const RING_ADDRESS                    = "0x4300000000000000000000000000000000000003";
const RING_STAKING_REWARDS_INDEX      = 3;

const BLASTERSWAP_ROUTER_ADDRESS      = "0xc972FaE6b524E8A6e0af21875675bF58a3133e60";
const BLASTERSWAP_LP_TOKEN_ADDRESS    = "0x3b5d3f610Cc3505f4701E9FB7D0F0C93b7713adD";

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
let strategyAccountImplMC: any;

let dispatcher: Dispatcher;

let dexBalancerModuleA: DexBalancerModuleA;
let multiplierMaxxooorModuleB: MultiplierMaxxooorModuleB;
let dexBalancerModuleAMC: any;
let multiplierMaxxooorModuleBMC: any;

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
  strategyAccountImplMC = new MulticallContract(STRATEGY_ACCOUNT_IMPL_ADDRESS, ABI_STRATEGY_ACCOUNT);

  dexBalancerModuleA = await ethers.getContractAt("DexBalancerModuleA", DEX_BALANCER_MODULE_A_ADDRESS, agentfideployer) as DexBalancerModuleA;
  multiplierMaxxooorModuleB = await ethers.getContractAt("MultiplierMaxxooorModuleB", MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS, agentfideployer) as MultiplierMaxxooorModuleB;
  multiplierMaxxooorModuleBMC = new MulticallContract(MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS, ABI_MODULE_B);

  weth = await ethers.getContractAt("MockERC20", WETH_ADDRESS, agentfideployer) as MockERC20;
  usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS, agentfideployer) as MockERC20;

  //genesisAgent5 = await ethers.getContractAt("BlastooorGenesisAgentAccount", genesisAgent5Address, boombotseth) as BlastooorGenesisAgentAccount;
  genesisAgent5 = await ethers.getContractAt("BlastooorGenesisAgentAccount", AddressZero, boombotseth) as BlastooorGenesisAgentAccount;


  //await listGenesisAgents();
  //await listStrategyAgents();
  //await listGenesisAgents(boombotseth.address);
  //await listStrategyAgents(boombotseth.address);
  //await listAgentsOf(agentfideployer.address);


  //await listAgentTreeStructure();

  await findAgentType("0x1EA80570E8b2b341408180bc7B3678FdB047cab5")
  await findAgentType("0x718d0C58A289431ca5c2805b5A31DFDdd5A54F7a")
  await findAgentType("0xbBe2DfC636D4D68465B368597fDA6fbD21dB7da7")

  //await fetchBalancesFromApi('0x89320a45B474E5367024Bb6c8e0A04Cf9DfF4051')
  //await fetchBalancesFromApi('0xA214a4fc09C42202C404E2976c50373fE5F5B789')
  //await fetchBalancesFromApi('0x7da01a06A2582193C2867E22FE62f7f649F7B9e2')
}

async function listAgentTreeStructure() {
  let blockNumber = (await provider.getBlock()).blockNumber
  let calls1 = [
    genesisCollectionMC.totalSupply(),
    strategyCollectionMC.totalSupply(),
  ]
  let results1 = await multicallChunked(mcProvider, calls1, blockNumber, 500)
  let tsg = results1[0].toNumber()
  let tss = results1[1].toNumber()
  console.log(`Number genesis agents created   : ${tsg}`);
  console.log(`Number strategy agents created  : ${tss}`);
  if(tsg == 0 && tss == 0) return;
  let calls2 = [] as any[]
  for(let genesisAgentID = 1; genesisAgentID <= tsg; genesisAgentID++) {
    calls2.push(genesisCollectionMC.ownerOf(genesisAgentID))
    calls2.push(agentRegistryMC.getTbasOfNft(genesisCollection.address, genesisAgentID))
  }
  let calls3 = [] as any[]
  for(let strategyAgentID = 1; strategyAgentID <= tss; strategyAgentID++) {
    calls3.push(strategyCollectionMC.ownerOf(strategyAgentID))
    calls3.push(agentRegistryMC.getTbasOfNft(strategyCollection.address, strategyAgentID))
  }
  console.log(`Fetching agent info...`)
  let [results2, results3] = await Promise.all([
    multicallChunked(mcProvider, calls2, blockNumber, 1000),
    multicallChunked(mcProvider, calls3, blockNumber, 1000),
  ])
  console.log(`Fetched agent info. Reformatting`)
  let results22 = reformatTbasAndOwnersResults(results2)
  let results33 = reformatTbasAndOwnersResults(results3)

  let genesisAgents = results22.filter(x => x.tbas.length > 0)
  if(genesisAgents.length == 0) {
    console.log('No genesis agents have TBAs')
    return
  }

  console.log(`${genesisAgents.length} genesis agents have strategies. List:`)
  const line = `-----------------------------------------------------------------`
  console.log(line)
  for(let genesisAgent of genesisAgents) {
    if(genesisAgent.tbas.length == 0) continue
    console.log(`Genesis Agent ID ${genesisAgent.agentID}`)
    console.log(`  Owner          ${genesisAgent.owner}`)
    let tba = genesisAgent.tbas[0]
    console.log(`  TBA            ${tba.agentAddress}`)
    let strategyAgents = results33.filter(x => x.owner == tba.agentAddress)
    console.log(`  # strategies : ${strategyAgents.length}`)
    for(let strategyAgent of strategyAgents) {
      console.log(`    Strategy Agent ID ${strategyAgent.agentID}`)
      console.log(`      TBA        ${strategyAgent.tbas[0].agentAddress}`)
    }
    console.log(line)
  }
  console.log('\n')

  let owners = deduplicateArray(genesisAgents.map(x=>x.owner))
  console.log(`${owners.length} unique owners of genesis agents detected`)
  owners.forEach(x=>console.log(x))

  console.log('\n\nFetching balances for all owners\n')

  let tvlUSD = 0.0
  for(let i = 0; i < owners.length; ++i) {
    tvlUSD += await fetchBalancesFromApi(owners[i])
    await delay(500)
  }
  console.log(`\nestimated tvl: $${tvlUSD}`)
}

function reformatTbasAndOwnersResults(res1:any[]) {
  let res2 = []
  for(let i = 0; i < res1.length; i+=2) {
    res2.push({
      agentID: (i/2)+1,
      owner: res1[i],
      tbas: res1[i+1],
    })
  }
  return res2
}

async function fetchBalancesFromApi(address:string) {
  let url = `https://api.agentfi.io/agents/${address}?chainID=81457`
  let res = await axios.get(url)
  let agents = res.data.data
  if(agents.length == 0) return undefined
  let agentNameList = agents.map(x => {
    if(x.name == "BlastooorGenesisAgents") return `Genesis Agent #${x.tokenId}`
    else if(x.name == "BlastooorStrategyAgents") return `Strategy Agent #${x.tokenId}`
    else return `Unknown Agent`
  }).join(', ')

  let balanceUSD = 0.0
  for(let i = 0; i < agents.length; i++) {
    let agent = agents[i]
    balanceUSD += calculateUsdValueOfTokens(agent.balances)

  }
  console.log(`user ${address} owns ${agentNameList}. estimated value: $${balanceUSD}`)
  return balanceUSD
}

function calculateUsdValueOfTokens(balances:any[]) {
  let balanceUSD = 0.0
  let ethPrice = 3560.0 // todo: pull from oracle
  let usdbPrice = 1.0 // todo: pull from oracle

  for(let j = 0; j < balances.length; j++) {
    let bal = balances[j]
    let address = bal.address
    let balance = parseFloat(bal.balance)
    //console.log(`${address}: ${balance}`)
    if(address == ETH_ADDRESS) balanceUSD += balance * ethPrice
    else if(address == ALL_CLAIMABLE_GAS_ADDRESS) balanceUSD += balance * ethPrice
    else if(address == MAX_CLAIMABLE_GAS_ADDRESS) balanceUSD += balance * ethPrice
    else if(address == WETH_ADDRESS) balanceUSD += balance * ethPrice
    else if(address == USDB_ADDRESS) balanceUSD += balance * usdbPrice
    else if(address == USDB_ADDRESS) balanceUSD += balance * usdbPrice
    else if(!!bal.underlying && !!bal.underlying.length) balanceUSD += calculateUsdValueOfTokens(bal.underlying)
  }
  return balanceUSD
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

async function findAgentType(addr:string) {
  var calls = [
    // strategyType()
    {
      target: addr,
      callData: multiplierMaxxooorModuleB.interface.encodeFunctionData("strategyType"),
    },
    // overrides strategyType()
    {
      target: addr,
      callData: strategyAccountImpl.interface.encodeFunctionData("overrides", ["0x82ccd330"]),
    },
    // overrides moduleA_depositBalance()
    {
      target: addr,
      callData: strategyAccountImpl.interface.encodeFunctionData("overrides", ["0x7bb485dc"]),
    },
  ]
  let results = await multicallForwarder.callStatic.aggregate(calls, {...networkSettings.overrides, gasLimit: 15_000_000})
  let returnData = results[1]
  // TODO: decode result from strategyType()
  for(let i = 1; i < returnData.length; i++) {
    var res = returnData[i]
    if(res.length != 130) continue
    var impl = bytesToAddr(res)
    if(impl == DEX_BALANCER_MODULE_A_ADDRESS.toLowerCase()) {
      console.log(`Account ${addr} is a strategy of type Dex Balancer`)
      return
    }
    else if(impl == DEX_BALANCER_MODULE_A_ADDRESS_OLD.toLowerCase()) {
      console.log(`Account ${addr} is a strategy of type Dex Balancer`)
      return
    }
    else if(impl == MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS.toLowerCase()) {
      console.log(`Account ${addr} is a strategy of type Multiplier Maxxooor`)
      return
    }
  }
  console.log(`Account ${addr} is an unknown strategy type`)
}

// only works in this case
function bytesToAddr(s:string) {
  return '0x' + s.substr(26, 40)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
