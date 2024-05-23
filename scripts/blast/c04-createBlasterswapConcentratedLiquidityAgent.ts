import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish, utils } from "ethers";
import axios from "axios"
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const dummyaccount = new ethers.Wallet(accounts.dummyaccount.key, provider);

import { Agents, BlastooorAgentAccount, AgentFactory01, AgentFactory02, AgentFactory03 } from "../../typechain-types";

import { delay, deduplicateArray, readAbi, readAbiForMC } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/setStorage";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../utils/diamond"
import { MulticallProvider, MulticallContract } from "./../utils/multicall";
import { multicallChunked } from "./../utils/network";
import { sign, assembleSignature, getMintFromAllowlistDigest, getMintFromAllowlistSignature } from "./../utils/signature";
import { formatNumber2 } from "./../utils/strings";
import { createSigner, bytesToAddr, selectionSortAgents, describeAgent, formatAgentJson, safeBnToNumber } from "./../utils/missionUtils"

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const { formatUnits } = ethers.utils;

let networkSettings: any;
let chainID: number;

const fs = require("fs")
const ABI_BALANCE_FETCHER = readAbiForMC("abi/contracts/utils/BalanceFetcher.sol/BalanceFetcher.json")
const ABI_MULTICALL_FORWARDER = readAbiForMC("abi/contracts/utils/MulticallForwarder.sol/MulticallForwarder.json")
const ABI_AGENTS_NFT = readAbiForMC("abi/contracts/tokens/Agents.sol/Agents.json")
const ABI_AGENT_REGISTRY = readAbiForMC("abi/contracts/utils/AgentRegistry.sol/AgentRegistry.json")
const ABI_STRATEGY_ACCOUNT = readAbiForMC("abi/contracts/accounts/BlastooorStrategyAgentAccount.sol/BlastooorStrategyAgentAccount.json")
const ABI_MODULE_B = readAbiForMC("abi/contracts/modules/MultiplierMaxxooorModuleB.sol/MultiplierMaxxooorModuleB.json")
const ABI_CONCENTRATED_LIQUIDTY_AGENT = readAbiForMC("data/abi/ConcentratedLiquidityAgent.json")
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
const DISPATCHER_ADDRESS              = "0x59c0269f4120058bA195220ba02dd0330d92c36D"; // v1.0.1

const GENESIS_COLLECTION_ADDRESS      = "0x5066A1975BE96B777ddDf57b496397efFdDcB4A9"; // v1.0.0
const GENESIS_FACTORY_ADDRESS         = "0x700b6f8B315247DD41C42A6Cfca1dAE6B4567f3B"; // v1.0.0
const GENESIS_ACCOUNT_IMPL_ADDRESS    = "0xb9b7FFBaBEC52DFC0589f7b331E4B8Cb78E06301"; // v1.0.1
const GENESIS_ACCOUNT_FACTORY_ADDRESS = "0x101E03D71e756Da260dC5cCd19B6CdEEcbB4397F"; // v1.0.1

const AGENT_REGISTRY_ADDRESS          = "0x12F0A3453F63516815fe41c89fAe84d218Af0FAF"; // v1.0.1

const STRATEGY_COLLECTION_ADDRESS     = "0x73E75E837e4F3884ED474988c304dE8A437aCbEf"; // v1.0.1
const STRATEGY_FACTORY_ADDRESS        = "0x09906C1eaC081AC4aF24D6F7e05f7566440b4601"; // v1.0.1
const STRATEGY_ACCOUNT_IMPL_V1_ADDRESS   = "0x4b1e8C60E4a45FD64f5fBf6c497d17Ab12fba213"; // v1.0.1
const STRATEGY_ACCOUNT_IMPL_V2_ADDRESS   = "0x376Ba5cF93908D78a3d98c05C8e0B39C0207568d"; // v1.0.2

const DEX_BALANCER_MODULE_A_ADDRESS   = "0x35a4B9B95bc1D93Bf8e3CA9c030fc15726b83E6F"; // v1.0.1
const MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS  = "0x54D588243976F7fA4eaf68d77122Da4e6C811167"; // v1.0.1

const EXPLORER_COLLECTION_ADDRESS                       = "0xFB0B3C31eAf58743603e8Ee1e122547EC053Bf18"; // v1.0.2
const EXPLORER_ACCOUNT_IMPL_ADDRESS                     = "0xC429897531D8F70093C862C81a7B3F18b6F46426"; // v1.0.2
const CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS   = "0x10C02a975a748Db5B749Dc420154dD945e2e8657"; // v1.0.2
const CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS      = "0x96E50f33079F749cb20f32C05DBb62B09620a817"; // v1.0.2
const CONCENTRATED_LIQUIDITY_MODULES = [
  "0x10C02a975a748Db5B749Dc420154dD945e2e8657",
  "0x41D68d86545D6b931c1232f1E0aBB5844Ada4967",
  "0xa11D4dcD5a9ad75c609E1786cf1FD88b53C83A5E",
]

// tokens
const ETH_ADDRESS                = "0x0000000000000000000000000000000000000000";
const ALL_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000001";
const MAX_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000002";
const WETH_ADDRESS               = "0x4300000000000000000000000000000000000004";
const USDB_ADDRESS               = "0x4300000000000000000000000000000000000003";

const collections = [GENESIS_COLLECTION_ADDRESS, STRATEGY_COLLECTION_ADDRESS, EXPLORER_COLLECTION_ADDRESS]
const tokenlist = [
  /*
  ETH_ADDRESS,
  ALL_CLAIMABLE_GAS_ADDRESS,
  MAX_CLAIMABLE_GAS_ADDRESS,
  WETH_ADDRESS,
  USDB_ADDRESS
  */
]

const BLASTERSWAP_POSITION_MANAGER_ADDRESS = "0xa761d82F952e9998fE40a6Db84bD234F39122BAD"
const BLASTERSWAP_WETH_USDB_V3_POOL        = "0xEA3C97b7e599BafabC2243429f3684AB097e2FD7"; // 0.3% fee

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
const INCREASE_LIQUIDITY_TOPIC = "0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f"
const BYTES_32_0 = "0x0000000000000000000000000000000000000000000000000000000000000000"

let iblast: IBlast;
let iblastpoints: IBlastPoints;

let erc6551Registry: IERC6551Registry;
let multicallForwarder: MulticallForwarder;
let multicallForwarderStatic: MulticallForwarder;
let contractFactory: ContractFactory;
let gasCollector: GasCollector;
let balanceFetcher: BalanceFetcher;
let balanceFetcherMC: any;

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

let explorerCollection: ExplorerAgents;
let explorerAccountImpl: ExplorerAgentAccount;
let concentratedLiquidityGatewayModuleC: ConcentratedLiquidityGatewayModuleC;
let concentratedLiquidityAgentFactory: ConcentratedLiquidityAgentFactory;

let weth: MockERC20;
let usdb: MockERC20;

let blasterswapWethUsdbV3Pool: IBlasterswapV3Pool;

let ethPrice = 3560.0 // fetch this at start of script
let usdbPrice = 1.0 // assume this is sufficiently pegged to $1


async function main() {
  console.log(`Using ${dummyaccount.address} as dummyaccount`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    //return ((chainID == chainid)/* || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName))*/);
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(81457, "blast")) throw("Only run this on Blast Mainnet or a local fork of Blast Mainnet");

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, dummyaccount) as IBlast;
  iblastpoints = await ethers.getContractAt("IBlastPoints", BLAST_POINTS_ADDRESS, dummyaccount) as IBlastPoints;

  erc6551Registry = await ethers.getContractAt("IERC6551Registry", ERC6551_REGISTRY_ADDRESS) as IERC6551Registry;
  balanceFetcher = await ethers.getContractAt(ABI_BALANCE_FETCHER, BALANCE_FETCHER_ADDRESS, dummyaccount) as BalanceFetcher;
  balanceFetcherMC = new MulticallContract(BALANCE_FETCHER_ADDRESS, ABI_BALANCE_FETCHER)
  dispatcher = await ethers.getContractAt("Dispatcher", DISPATCHER_ADDRESS, dummyaccount) as Dispatcher;
  agentRegistry = await ethers.getContractAt("AgentRegistry", AGENT_REGISTRY_ADDRESS, dummyaccount) as AgentRegistry;
  agentRegistryMC = new MulticallContract(AGENT_REGISTRY_ADDRESS, ABI_AGENT_REGISTRY)
  multicallForwarder = await ethers.getContractAt("MulticallForwarder", MULTICALL_FORWARDER_ADDRESS, dummyaccount) as MulticallForwarder;
  multicallForwarderStatic = await ethers.getContractAt(ABI_MULTICALL_FORWARDER, MULTICALL_FORWARDER_ADDRESS, dummyaccount) as MulticallForwarder;

  genesisCollection = await ethers.getContractAt("Agents", GENESIS_COLLECTION_ADDRESS, dummyaccount) as Agents;
  genesisCollectionMC = new MulticallContract(GENESIS_COLLECTION_ADDRESS, ABI_AGENTS_NFT)
  genesisFactory = await ethers.getContractAt("BlastooorGenesisFactory", GENESIS_FACTORY_ADDRESS, dummyaccount) as BlastooorGenesisFactory;
  genesisAccountImpl = await ethers.getContractAt("BlastooorGenesisAgentAccount", GENESIS_ACCOUNT_IMPL_ADDRESS, dummyaccount) as BlastooorGenesisAgentAccount;
  genesisAccountFactory = await ethers.getContractAt("BlastooorAccountFactory", GENESIS_ACCOUNT_FACTORY_ADDRESS, dummyaccount) as BlastooorAccountFactory;

  strategyCollection = await ethers.getContractAt("BlastooorStrategyAgents", STRATEGY_COLLECTION_ADDRESS, dummyaccount) as BlastooorStrategyAgents;
  strategyCollectionMC = new MulticallContract(STRATEGY_COLLECTION_ADDRESS, ABI_AGENTS_NFT)
  strategyFactory = await ethers.getContractAt("BlastooorStrategyFactory", STRATEGY_FACTORY_ADDRESS, dummyaccount) as BlastooorStrategyFactory;
  strategyAccountImpl = await ethers.getContractAt("BlastooorStrategyAgentAccount", STRATEGY_ACCOUNT_IMPL_V1_ADDRESS, dummyaccount) as BlastooorStrategyAgentAccount;
  strategyAccountImplMC = new MulticallContract(STRATEGY_ACCOUNT_IMPL_V1_ADDRESS, ABI_STRATEGY_ACCOUNT);

  dexBalancerModuleA = await ethers.getContractAt("DexBalancerModuleA", DEX_BALANCER_MODULE_A_ADDRESS, dummyaccount) as DexBalancerModuleA;
  multiplierMaxxooorModuleB = await ethers.getContractAt("MultiplierMaxxooorModuleB", MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS, dummyaccount) as MultiplierMaxxooorModuleB;
  multiplierMaxxooorModuleBMC = new MulticallContract(MULTIPLIER_MAXXOOOR_MODULE_B_ADDRESS, ABI_MODULE_B);

  explorerCollection = await ethers.getContractAt("ExplorerAgents", EXPLORER_COLLECTION_ADDRESS, dummyaccount) as ExplorerAgents;
  explorerAccountImpl = await ethers.getContractAt("ExplorerAgentAccount", EXPLORER_ACCOUNT_IMPL_ADDRESS, dummyaccount) as ExplorerAgentAccount;
  concentratedLiquidityGatewayModuleC = await ethers.getContractAt("ConcentratedLiquidityGatewayModuleC", CONCENTRATED_LIQUIDITY_GATEWAY_MODULE_C_ADDRESS, dummyaccount) as ConcentratedLiquidityGatewayModuleC;
  concentratedLiquidityAgentFactory = await ethers.getContractAt("ConcentratedLiquidityAgentFactory", CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS, dummyaccount) as ConcentratedLiquidityAgentFactory;

  weth = await ethers.getContractAt("MockERC20", WETH_ADDRESS, dummyaccount) as MockERC20;
  usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS, dummyaccount) as MockERC20;

  blasterswapWethUsdbV3Pool = await ethers.getContractAt("IBlasterswapV3Pool", BLASTERSWAP_WETH_USDB_V3_POOL, dummyaccount) as MockERC20;

  await fetchPrices();

  // read chain state
  let { blasterswapCLAgents, rootAgent } = await analyzeAgentsOf("0x14F3fC5Bd9F29fA60B84310cf6e5CfED67d75FB9")
  
  // create new agent
  await createBlasterswapCLAgent()
}

async function fetchPrices() {
  // eth/usdb
  let slot0 = await blasterswapWethUsdbV3Pool.slot0()
  let sqrtPriceX96 = slot0.sqrtPriceX96
  let numerator = BN.from(2).pow(192).mul(WeiPerEther)
  let denominator = sqrtPriceX96.pow(2)
  let str = formatUnits(numerator.div(denominator))
  ethPrice = parseFloat(str)
  console.log(`The current price of ETH is 1 ETH = ${formatNumber2(ethPrice)} USDB`)
}

async function analyzeAgentsOf(address:string) {
  console.log(`\nAnalyzing agents of ${address}`)
  // remember to callstatic this one
  let agents = await balanceFetcher.callStatic.fetchAgents(address, collections, tokenlist)
  if(agents.length == 0) {
    console.log(`No agents detected`)
    return undefined
  }
  let agents2 = agents.map(agent => {
    return {
      agentAddress: agent.agentAddress,
      implementation: agent.implementation,
      owner: agent.owner,
      collection: agent.collection,
      agentID: safeBnToNumber(agent.agentID),
      balances: agent.balances.map(x=>x.toString()),
    }
  })
  let blasterswapCLAgents = await listBlasterswapConcentratedLiquidityAgents(agents2)
  let rootAgent = await selectRootAgent(agents2, address)
  return { blasterswapCLAgents, rootAgent }
}

async function listBlasterswapConcentratedLiquidityAgents(agents:any[]) {
  let strategyAgents = agents.filter(agent => agent.collection == STRATEGY_COLLECTION_ADDRESS)
  if(strategyAgents.length == 0) {
    console.log("No strategy agents")
    return []
  }
  // use multicall forwarder to detect overrides
  let calls1 = []
  for(let agentIndex = 0; agentIndex < strategyAgents.length; agentIndex++) {
    let agent = strategyAgents[agentIndex]
    let tbaAddress = agent.agentAddress
    calls1.push({ // overrides strategyType()
      target: tbaAddress,
      callData: strategyAccountImpl.interface.encodeFunctionData("overrides", ["0x82ccd330"]),
    })
    calls1.push({ // overrides moduleC_mint()
      target: tbaAddress,
      callData: strategyAccountImpl.interface.encodeFunctionData("overrides", ["0xbdb7336b"]),
    })
  }
  let results1 = await multicallForwarderStatic.connect(dummyaccount).aggregate(calls1)
  let returnData = results1[1]

  // analyze strategy types
  let clAgents = []
  for(let agentIndex = 0; agentIndex < strategyAgents.length; agentIndex++) {
    let agent = strategyAgents[agentIndex]
    let agentID = safeBnToNumber(agent.agentID)
    let tbaAddress = agent.agentAddress
    let strategyType = "Unknown"
    for(let responseIndex = 0; responseIndex < 2; responseIndex++) {
      let ri = agentIndex * 2 + responseIndex
      var ret = returnData[ri]
      if(ret.length != 130) continue
      var impl = bytesToAddr(ret)
      if(CONCENTRATED_LIQUIDITY_MODULES.includes(impl)) {
        strategyType = "Concentrated Liquidity"
        clAgents.push(strategyAgents[agentIndex])
        break
      }
    }
  }

  // early exit if no concentrated liquidity agents
  if(clAgents.length == 0) {
    console.log("No concentrated liquidity agents")
    return []
  }

  // fetch the v3 info on each agent
  let calls2 = []
  for(let agentIndex = 0; agentIndex < clAgents.length; agentIndex++) {
    let agent = clAgents[agentIndex]
    let agentID = safeBnToNumber(agent.agentID)
    let tbaAddress = agent.agentAddress
    let agentContractMC = new MulticallContract(tbaAddress, ABI_CONCENTRATED_LIQUIDTY_AGENT)
    calls2.push(agentContractMC.manager())
    calls2.push(agentContractMC.pool())
    calls2.push(agentContractMC.tokenId())
  }
  let results2 = await multicallChunked(mcProvider, calls2, "latest", 500)
  // parse v3 info
  let blasterswapCLAgents = []
  for(let agentIndex = 0; agentIndex < clAgents.length; agentIndex++) {
    let agent = clAgents[agentIndex]
    let agentID = safeBnToNumber(agent.agentID)
    let tbaAddress = agent.agentAddress
    let manager = results2[agentIndex * 3 + 0]
    let pool = results2[agentIndex * 3 + 1]
    let tokenId = results2[agentIndex * 3 + 2]
    if(manager == BLASTERSWAP_POSITION_MANAGER_ADDRESS) {
      console.log(`Strategy agent ${agentID} account ${tbaAddress} deposits into Blasterswap V3 pool ${pool} tokenId ${tokenId}`)
      agent.manager = manager
      agent.pool = pool
      agent.tokenId = tokenId
      blasterswapCLAgents.push(agent)
    }
  }
  console.log(`User has ${blasterswapCLAgents.length} Blasterswap Concentrated Liquidity Agents`)
  return blasterswapCLAgents
}

async function selectRootAgent(agents:any[], owner:string) {
  let rootAgents = agents.filter(agent => agent.owner == owner)
  if(rootAgents.length == 0) {
    console.log("No root agents")
    return undefined
  }
  let agents3 = selectionSortAgents(rootAgents)
  return agents3[0]
}

// creates a new agent
async function createBlasterswapCLAgent() {

  // these values should be provided by the frontend
  let manager = BLASTERSWAP_POSITION_MANAGER_ADDRESS
  let pool = BLASTERSWAP_WETH_USDB_V3_POOL
  let slippageLiquidity = 1_000_000
  let tickLower = -80520
  let tickUpper = -79560
  let sqrtPriceX96 = BN.from("1441300361101759976520828579")
  let mintParams = { manager, pool, slippageLiquidity, tickLower, tickUpper, sqrtPriceX96 }

  let deposit0 = {
    token: WETH_ADDRESS, // also accepts ETH by passing in AddressZero
    amount: WeiPerEther.mul(1).div(30_000)
  }
  let deposit1 = {
    token: USDB_ADDRESS,
    amount: WeiPerEther.mul(1).div(10)
  }
  let deposits = [deposit0, deposit1]

  let signer = new ethers.Wallet(accounts.boombotseth.key, provider);

  // fetch the users root agent if any
  let agents = await balanceFetcher.callStatic.fetchAgents(signer.address, collections, tokenlist)
  let rootAgent = await selectRootAgent(agents, signer.address)
  //rootAgent = undefined

  // check token balances and allowance
  for(let deposit of deposits) {
    let { token, amount } = deposit
    if(token == AddressZero) {
      let balance = await provider.getBalance(signer.address)
      if(balance.lt(amount)) throw new Error(`Insufficient ETH for deposit, expected ${amount} have ${balance}`)
    }
    else {
      let erc20 = await ethers.getContractAt("MockERC20", token, signer) as MockERC20;
      let balance = await erc20.balanceOf(signer.address)
      if(balance.lt(amount)) throw new Error(`Insufficient ERC20 ${token} for deposit, expected ${amount} have ${balance}`)
      let allowance = await erc20.allowance(signer.address, CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS)
      if(allowance.lt(amount)) {
        console.log(`Approving ${token}`)
        let tx = await erc20.approve(CONCENTRATED_LIQUIDITY_AGENT_FACTORY_ADDRESS, MaxUint256, {...networkSettings.overrides, gasLimit: 200_000})
        await tx.wait(networkSettings.confirmations)
      }
    }
  }

  // create the agent
  let tx
  console.log(`Creating agent`)
  if(!!rootAgent) {
    tx = await concentratedLiquidityAgentFactory.connect(signer).createConcentratedLiquidityAgentForRoot(
      mintParams, deposit0, deposit1, rootAgent.agentAddress, {...networkSettings.overrides, gasLimit: 4_000_000}
    )
  } else {
    tx = await concentratedLiquidityAgentFactory.connect(signer).createConcentratedLiquidityAgentAndExplorer(
      mintParams, deposit0, deposit1, {...networkSettings.overrides, gasLimit: 4_000_000}
    )
  }
  await watchTxForEvents(tx)
  console.log(`Created agent`)
}

async function watchTxForEvents(tx:any) {
  console.log("tx:", tx.hash);
  let receipt = await tx.wait(networkSettings.confirmations);
  console.log(`gasUsed: ${receipt.gasUsed.toNumber().toLocaleString()}`)
  if(!receipt || !receipt.logs || receipt.logs.length == 0) {
    console.log(receipt)
    console.log("No events found")
  }

  console.log('logs:')
  for(let i = 0; i < receipt.logs.length; i++) {
    let log = receipt.logs[i]
    let address = log.address

    if(address == STRATEGY_COLLECTION_ADDRESS) {
      if(log.topics[0] == TRANSFER_TOPIC) {
        let agentID = BN.from(log.topics[3]).toNumber()
        if(log.topics[1] == BYTES_32_0) {
          console.log(`Minted strategy agent #${agentID}`)
        } else {
          console.log(`Transferred strategy agent #${agentID}`)
        }
      } else {
        console.log("Did something with a strategy agent")
      }
    }
    else if(address == EXPLORER_COLLECTION_ADDRESS) {
      if(log.topics[0] == TRANSFER_TOPIC) {
        let agentID = BN.from(log.topics[3]).toNumber()
        if(log.topics[1] == BYTES_32_0) {
          console.log(`Minted explorer agent #${agentID}`)
        } else {
          console.log(`Transferred explorer agent #${agentID}`)
        }
      } else {
        console.log("Did something with an explorer agent")
      }
    }
    else if(address == ERC6551_REGISTRY_ADDRESS) {
      let collection = bytesToAddr(log.topics[2])
      let agentID = BN.from(log.topics[3]).toNumber()
      if(collection == STRATEGY_COLLECTION_ADDRESS) {
        console.log(`Created a TBA for strategy agent #${agentID}`)
      }
      else if(collection == EXPLORER_COLLECTION_ADDRESS) {
        console.log(`Created a TBA for explorer agent #${agentID}`)
      }
      else {
        console.log(`Created a TBA for agent ${collection} #${agentID}`)
      }
    }
    else if(address == BLASTERSWAP_POSITION_MANAGER_ADDRESS) {
      if(log.topics[0] == TRANSFER_TOPIC) {
        let tokenID = BN.from(log.topics[3]).toNumber()
        if(log.topics[1] == BYTES_32_0) {
          console.log(`Minted Blasterswap V3 position #${tokenID}`)
        } else {
          console.log(`Transferred Blasterswap V3 position #${tokenID}`)
        }
      } else if(log.topics[0] == INCREASE_LIQUIDITY_TOPIC) {
        console.log("Increased liquidity in the Blasterswap V3 position")
      } else {
        console.log("Did something with a Blasterswap V3 position")
      }
    }
  }
}



main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
