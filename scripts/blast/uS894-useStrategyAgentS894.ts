import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish, utils } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();
import axios from "axios"

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);

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
const ETH_ADDRESS2               = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ALL_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000001";
const MAX_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000002";
const WETH_ADDRESS               = "0x4300000000000000000000000000000000000004";
const USDB_ADDRESS               = "0x4300000000000000000000000000000000000003";

const COMPTROLLER_ADDRESS           = "0xe9266ae95bB637A7Ad598CB0390d44262130F433";
const DETH_ADDRESS                  = "0x1Da40C742F32bBEe81694051c0eE07485fC630f6";
const DUSD_ADDRESS                  = "0x1A3D9B2fa5c6522c8c071dC07125cE55dF90b253";
const ODETH_ADDRESS                 = "0xa3135b76c28b3971B703a5e6CD451531b187Eb5A";
const ODUSD_ADDRESS                 = "0x4ADF85E2e760c9211894482DF74BA535BCae50A4";
const POOL_ADDRESS                  = "0xf00DA13d2960Cf113edCef6e3f30D92E52906537";
const POSITION_MANAGER_ADDRESS      = "0x434575EaEa081b735C985FA9bf63CD7b87e227F9";
const SWAP_ROUTER_ADDRESS           = "0x337827814155ECBf24D20231fCA4444F530C0555";
const WRAPMINT_ETH_ADDRESS          = "0xD89dcC88AcFC6EF78Ef9602c2Bf006f0026695eF";
const WRAPMINT_USDB_ADDRESS         = "0xf2050acF080EE59300E3C0782B87f54FDf312525";
const ORBIT_ADDRESS                 = "0x42E12D42b3d6C4A74a88A61063856756Ea2DB357";

let iblast: IBlast;
let iblastpoints: IBlastPoints;

let erc6551Registry: IERC6551Registry;
let multicallForwarder: MulticallForwarder;
let contractFactory: ContractFactory;
let gasCollector: GasCollector;
let balanceFetcher: BalanceFetcher;

let agentRegistry: AgentRegistry;
let agentRegistryMC: any;

let strategyCollection: BlastooorStrategyAgents;
let strategyCollectionMC: any;
let strategyFactory: BlastooorStrategyFactory;
let strategyAccountImpl: BlastooorStrategyAgentAccount;

let dispatcher: Dispatcher;

let weth: MockERC20;
let usdb: MockERC20;
let deth: MockERC20;
let dusd: MockERC20;

let strategyAgent894ID = 894;
let strategyAgent894Address = "0xE980706eFa316a447bdF68a3DABda214fadFBDaA";
let strategyAgent894: BlastooorStrategyAgentAccount;
let agentModule894: LoopooorModuleD;

let amountRequired = Zero

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    //return ((chainID == chainid)/* || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName))*/);
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(81457, "blast")) throw("Only run this on Blast Mainnet or a local fork of Blast Mainnet");

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, boombotseth) as IBlast;
  iblastpoints = await ethers.getContractAt("IBlastPoints", BLAST_POINTS_ADDRESS, boombotseth) as IBlastPoints;

  erc6551Registry = await ethers.getContractAt("IERC6551Registry", ERC6551_REGISTRY_ADDRESS) as IERC6551Registry;
  balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, boombotseth) as BalanceFetcher;
  dispatcher = await ethers.getContractAt("Dispatcher", DISPATCHER_ADDRESS, boombotseth) as Dispatcher;
  agentRegistry = await ethers.getContractAt("AgentRegistry", AGENT_REGISTRY_ADDRESS, boombotseth) as AgentRegistry;
  agentRegistryMC = new MulticallContract(AGENT_REGISTRY_ADDRESS, ABI_AGENT_REGISTRY)
  multicallForwarder = await ethers.getContractAt("MulticallForwarder", MULTICALL_FORWARDER_ADDRESS, boombotseth) as MulticallForwarder;

  strategyCollection = await ethers.getContractAt("BlastooorStrategyAgents", STRATEGY_COLLECTION_ADDRESS, boombotseth) as BlastooorStrategyAgents;
  strategyCollectionMC = new MulticallContract(STRATEGY_COLLECTION_ADDRESS, ABI_AGENTS_NFT)
  strategyFactory = await ethers.getContractAt("BlastooorStrategyFactory", STRATEGY_FACTORY_ADDRESS, boombotseth) as BlastooorStrategyFactory;
  strategyAccountImpl = await ethers.getContractAt("BlastooorStrategyAgentAccount", STRATEGY_ACCOUNT_IMPL_ADDRESS, boombotseth) as BlastooorStrategyAgentAccount;

  weth = await ethers.getContractAt("MockERC20", WETH_ADDRESS, boombotseth) as MockERC20;
  usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS, boombotseth) as MockERC20;
  deth = await ethers.getContractAt("MockERC20", DETH_ADDRESS, boombotseth) as MockERC20;
  dusd = await ethers.getContractAt("MockERC20", DUSD_ADDRESS, boombotseth) as MockERC20;

  strategyAgent894 = await ethers.getContractAt("BlastooorStrategyAgentAccountV2", strategyAgent894Address, boombotseth) as BlastooorStrategyAgentAccountV2;
  agentModule894 = await ethers.getContractAt("LoopooorModuleD", strategyAgent894Address, boombotseth) as LoopooorModuleD;

  //await checkOwner()
  await withdrawBalances()
  await getVaults()
  await transferIn()
  await redeem()
}

async function checkOwner() {
  let owner1 = await strategyCollection.ownerOf(strategyAgent894ID)
  console.log(`nft owner   : ${owner1}`)
  let owner2 = await strategyAgent894.owner()
  console.log(`agent owner : ${owner2}`)
  if(owner1 != owner2) throw new Error(`unexpected agent owner. make sure you are using blast or if using a fork network make sure to use the right chainid`)
}

async function withdrawBalances() {
  let txdatas = []
  let tokens = [
    { address: DETH_ADDRESS, symbol: "DETH", decimals:18 },
    { address: DUSD_ADDRESS, symbol: "DUSD", decimals:18 },
    { address: WETH_ADDRESS, symbol: "WETH", decimals:18 },
    { address: USDB_ADDRESS, symbol: "USDB", decimals:18 },
    { address: ORBIT_ADDRESS, symbol: "ORBIT", decimals:18 },
  ]
  for(let token of tokens) {
    let { address, symbol, decimals } = token
    let tokenContract = await ethers.getContractAt("MockERC20", address, boombotseth) as MockERC20;
    let balance = await tokenContract.balanceOf(strategyAgent894Address)
    if(balance.gt(0)) {
      console.log(`Agent has ${formatUnits(balance, decimals)} withdrawable ${symbol}`)
      txdatas.push(agentModule894.interface.encodeFunctionData("moduleD_sendBalanceTo", [boombotseth.address, address]))
    }
  }
  if(txdatas.length == 0) {
    console.log(`Agent has no withdrawable balances, skipping`)
    return
  }
  else if(txdatas.length == 1) {
    console.log(`Withdrawing tokens`)
    let tx = await boombotseth.sendTransaction({
      to: strategyAgent598Address,
      data: txdatas[0],
      ...networkSettings.overrides,
      gasLimit: 200_000
    })
    await watchTxForEvents(tx)
  }
  else {
    let tx = await strategyAgent894.multicall(txdatas, {...networkSettings.overrides, gasLimit:txdatas.length*200_000})
    await watchTxForEvents(tx)
  }
}

async function getVaults() {
  // fetch data
  let url = `https://www.duo.exchange/api/getVaultPositions?owner=${strategyAgent894Address}&showClosed=0`
  let res: any
  try {
    res = await axios.get(url)
  } catch(e) {
    console.error(`Error fetching ${url}`)
    if(!!e.response && !!e.response.stats && !!e.response.data) {
      console.error(`status: ${e.response.status}. data: ${JSON.stringify(e.response.data)}`)
    } else {
      console.error(e)
    }
    return
  }
  //console.log('res')
  //console.log(res)
  //console.log('res.data')
  let data = res.data
  console.log('data')
  //console.log(data)
  console.log(JSON.stringify(data, undefined, 2))

  // parse response
  let numItems = 0
  let fields = ['pointOptimizeds', 'yieldOptimizeds', 'variableRates', 'fixedRates']
  let s = ``
  for(let field of fields) {
    let items = data.result[field].items
    if(items.length > 0) {
      for(let item of items) {
        amountRequired = BN.from(item.principal)
      }
    }
    s += `${items.length} ${field}\n`
    numItems += items.length
  }
  s = `This agent has ${numItems} vaults\n${s}`
  console.log(s)
  console.log(`This agent can redeem ${formatUnits(amountRequired)} DETH`)
}

async function transferIn() {
  if(amountRequired.eq(0)) {
    console.log(`No DETH required, skipping`)
    return
  }
  let balA1 = await deth.balanceOf(strategyAgent894Address)
  let diff = amountRequired.sub(balA1)
  if(diff.gt(0)) {
    let balU1 = await deth.balanceOf(boombotseth.address)
    if(balU1.lt(diff)) {
      throw new Error(`The agent requires ${formatUnits(diff)} more DETH but the user only has ${formatUnits(balU1)}. Get some more and come back`)
    }
    console.log(`Transferring DETH from user to agent`)
    let tx = await deth.transfer(strategyAgent894Address, diff, networkSettings.overrides)
    await watchTxForEvents(tx)
  }
  else {
    console.log(`No additional DETH required, skipping`)
    return
  }
}

async function redeem() {
  if(amountRequired.eq(0)) {
    console.log(`No DETH redeemable, skipping`)
    return
  }
  let balA1 = await deth.balanceOf(strategyAgent894Address)
  if(balA1.lt(amountRequired)) {
    throw new Error(`The agent requires ${formatUnits(amountRequired)} DETH but only has ${formatUnits(balA2)}. Check the status and retry`)
  }
  let itemType = 'yieldOptimizeds'
  if(itemType == 'yieldOptimizeds') { // if (state.mode == MODE.VARIABLE_RATE)
    let wrapMint = await agentModule894.wrapMint()
    let rateContract = await agentModule894.rateContract()
    let comptroller = await agentModule894.comptroller()
    console.log(`wrapMint        : ${wrapMint}`)
    console.log(`rateContract    : ${rateContract}`)
    console.log(`comptroller     : ${comptroller}`)
    let txdata0 = agentModule894.interface.encodeFunctionData("moduleD_burnVariableRate", [wrapMint, rateContract, amountRequired, 0])
    let txdata1 = agentModule894.interface.encodeFunctionData("moduleD_sendBalanceTo", [boombotseth.address, WETH_ADDRESS])
    let txdatas = [txdata0, txdata1]
    try {
      let claimableOrbit = await agentModule894.callStatic.quoteClaim()
      console.log(`claimable orbit : ${formatUnits(claimableOrbit)}`)
      if(claimableOrbit.gt(0)) {
        let txdata2 = agentModule894.interface.encodeFunctionData("moduleD_claimTo", [boombotseth.address])
        txdatas.push(txdata2)
      }
    } catch(e) {}
    console.log(`burning fixed rate and redeeming`)
    let tx = await strategyAgent894.multicall(txdatas, {...networkSettings.overrides, gasLimit: 1_000_000})
    await watchTxForEvents(tx)
  }
  else {
    throw new Error(`Cannot yet handle item type ${itemType}`)
  }
  /*
  if (state.mode == MODE.FIXED_RATE) {
      moduleD_burnFixedRate(state.wrapMint, state.rateContract, burnAmount);
  }
  if (state.mode == MODE.VARIABLE_RATE) {
      moduleD_burnVariableRate(state.wrapMint, state.rateContract, burnAmount, 0);
  }
  */
}


async function watchTxForEvents(tx:any) {
  console.log("tx:", tx);
  //let receipt = await tx.wait(networkSettings.confirmations); // mainnet
  let receipt = await tx.wait(0); // forked network
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
    { address: DETH_ADDRESS, symbol: "DETH", decimals:18 },
    { address: DUSD_ADDRESS, symbol: "DUSD", decimals:18 },
    { address: WETH_ADDRESS, symbol: "WETH", decimals:18 },
    { address: USDB_ADDRESS, symbol: "USDB", decimals:18 },
    { address: ORBIT_ADDRESS, symbol: "ORBIT", decimals:18 },
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
