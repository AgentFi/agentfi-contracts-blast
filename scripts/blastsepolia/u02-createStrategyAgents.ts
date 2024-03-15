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

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;

let networkSettings: any;
let chainID: number;

const fs = require("fs")
const ABI_AGENTS_NFT = JSON.parse(fs.readFileSync("abi/contracts/tokens/Agents.sol/Agents.json").toString()).filter(x=>!!x&&x.type=="function")
let mcProvider = new MulticallProvider(provider, 168587773);

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

const DOMAIN_NAME = "AgentFi-BlastooorGenesisFactory";
const MINT_FROM_ALLOWLIST_TYPEHASH = utils.keccak256(utils.toUtf8Bytes("MintFromAllowlist(address receiver)"));

let iblast: IBlast;
let iblastpoints: IBlastPoints;

let genesisCollection: Agents;
let genesisCollectionMC: any;
let genesisFactory: BlastooorGenesisFactory;
let accountImplBase: BlastooorAgentAccount; // the base implementation for agentfi accounts
let accountImplRingC: BlastooorAgentAccountRingProtocolC;
let accountImplRingD: BlastooorAgentAccountRingProtocolD;
let accountImplThrusterA: BlastooorAgentAccountThrusterA;
let accountImplBasketA: BlastooorAgentAccountBasketA;

let strategyCollection: BlastooorStrategyAgents;
let strategyCollectionMC: any;
let strategyFactory: BlastooorStrategyFactory;
let strategyAccountImpl: BlastooorStrategyAgentAccount;
let dispatcher: Dispatcher;

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${agentfideployer.address} as agentfideployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    //return ((chainID == chainid)/* || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName))*/);
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia or a local fork of Blast Sepolia");

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, agentfideployer) as IBlast;
  iblastpoints = await ethers.getContractAt("IBlastPoints", BLAST_POINTS_ADDRESS, agentfideployer) as IBlastPoints;

  genesisCollection = await ethers.getContractAt("Agents", GENESIS_COLLECTION_ADDRESS, boombotseth) as Agents;
  genesisCollectionMC = new MulticallContract(GENESIS_COLLECTION_ADDRESS, ABI_AGENTS_NFT)
  genesisFactory = await ethers.getContractAt("BlastooorGenesisFactory", GENESIS_FACTORY_ADDRESS, agentfideployer) as BlastooorGenesisFactory;
  accountImplBase = await ethers.getContractAt("BlastooorAgentAccount", ACCOUNT_IMPL_BASE_ADDRESS, agentfideployer) as BlastooorAgentAccount;

  strategyCollection = await ethers.getContractAt("BlastooorStrategyAgents", STRATEGY_COLLECTION_ADDRESS, agentfideployer) as BlastooorStrategyAgents;
  strategyCollectionMC = new MulticallContract(STRATEGY_COLLECTION_ADDRESS, ABI_AGENTS_NFT)
  strategyFactory = await ethers.getContractAt("BlastooorStrategyFactory", STRATEGY_FACTORY_ADDRESS, agentfideployer) as BlastooorStrategyFactory;
  strategyAccountImpl = await ethers.getContractAt("BlastooorStrategyAgentAccount", STRATEGY_ACCOUNT_IMPL_ADDRESS, agentfideployer) as BlastooorStrategyAgentAccount;
  dispatcher = await ethers.getContractAt("Dispatcher", DISPATCHER_ADDRESS, agentfideployer) as Dispatcher;

  //await listGenesisAgents();
  await listStrategyAgents();

  await createAgents();

  await listStrategyAgents();
}

async function listGenesisAgents() {
  let ts = (await genesisCollection.totalSupply()).toNumber();
  console.log(`Number genesis agents created: ${ts}`);
  if(ts == 0) return;
  console.log("Info:")
  let calls = [] as any[]
  for(let agentID = 1; agentID <= ts; agentID++) {
    calls.push(genesisCollectionMC.getAgentInfo(agentID))
    calls.push(genesisCollectionMC.ownerOf(agentID))
  }
  const results = await multicallChunked(mcProvider, calls, "latest", 500)
  for(let agentID = 1; agentID <= ts; agentID++) {
    console.log(`Agent ID ${agentID}`)
    let agentInfo = results[agentID*2-2]
    let agentAddress = agentInfo.agentAddress
    let implementationAddress = agentInfo.implementationAddress
    let owner = results[agentID*2-1]
    console.log(`  Agent Address  ${agentAddress}`)
    console.log(`  TBA Impl       ${implementationAddress}`)
    console.log(`  Owner          ${owner}`)
  }
}

async function listStrategyAgents() {
  let ts = (await strategyCollection.totalSupply()).toNumber();
  console.log(`Number strategy agents created: ${ts}`);
  if(ts == 0) return;
  console.log("Info:")
  let calls = [] as any[]
  for(let agentID = 1; agentID <= ts; agentID++) {
    calls.push(strategyCollectionMC.getAgentInfo(agentID))
    calls.push(strategyCollectionMC.ownerOf(agentID))
  }
  const results = await multicallChunked(mcProvider, calls, "latest", 200)
  for(let agentID = 1; agentID <= ts; agentID++) {
    console.log(`Agent ID ${agentID}`)
    let agentInfo = results[agentID*2-2]
    let agentAddress = agentInfo.agentAddress
    let implementationAddress = agentInfo.implementationAddress
    let owner = results[agentID*2-1]
    console.log(`  Agent Address  ${agentAddress}`)
    console.log(`  TBA Impl       ${implementationAddress}`)
    console.log(`  Owner          ${owner}`)
  }
}

async function createAgents() {
  //await createStrategyAgent1();
  await createStrategyAgent2();
}

/*
Agent ID 4640
  Agent Address  0x7BEdF6D85E522a30f4eb9b5158dAbDCf31aC0160
  TBA Impl       0xE2f875c02B4FB117aFa62D40b960f1f95073d25C
  Owner          0x7da01a06A2582193C2867E22FE62f7f649F7B9e2 // boombotseth

Agent ID 4641
  Agent Address  0x38A828a45461E8fEcfD6b2035a0F774c34eA4e08
  TBA Impl       0xE2f875c02B4FB117aFa62D40b960f1f95073d25C
  Owner          0xA214a4fc09C42202C404E2976c50373fE5F5B789 // agentfideployer
*/

// creates strategy agent 1
// also configures points on the root agent (only needs to be done once)
async function createStrategyAgent1() {
  console.log(`createStrategyAgent1`)

  let calldata0 = iblastpoints.interface.encodeFunctionData("configurePointsOperator", [BLAST_POINTS_OPERATOR_ADDRESS])
  //let txdata0 = strategyAccountImpl.interface.encodeFunctionData("execute", [BLAST_POINTS_ADDRESS, 0, calldata0, 0]);

  let calldata1 = strategyFactory.interface.encodeFunctionData("createAgent(uint256)", [1])
  //let txdata1 = strategyAccountImpl.interface.encodeFunctionData("execute", [STRATEGY_FACTORY_ADDRESS, 0, calldata1, 0]);

  let genesisAgent4640Address = "0x7BEdF6D85E522a30f4eb9b5158dAbDCf31aC0160"
  let genesisAgent4640 = await ethers.getContractAt("BlastooorAgentAccount", genesisAgent4640Address, boombotseth) as BlastooorAgentAccount;

  let batch = [
    {
      to: BLAST_POINTS_ADDRESS,
      value: 0,
      data: calldata0,
      operation: 0,
    },
    {
      to: STRATEGY_FACTORY_ADDRESS,
      value: 0,
      data: calldata1,
      operation: 0,
    },
  ]

  let tx = await genesisAgent4640.executeBatch(batch, networkSettings.overrides)
  await watchTxForCreatedAgentID(tx)

  console.log(`createStrategyAgent1`)
}

// creates strategy agent 2
// and funds with 0.01 eth
async function createStrategyAgent2() {
  console.log(`createStrategyAgent2`)

  let depositAmount = WeiPerEther.div(100)
  let deposits = [{
    token: AddressZero,
    amount: depositAmount
  }]
  let calldata1 = strategyFactory.interface.encodeFunctionData("createAgent(uint256,(address,uint256)[])", [1, deposits])

  let genesisAgent4640Address = "0x7BEdF6D85E522a30f4eb9b5158dAbDCf31aC0160"
  let genesisAgent4640 = await ethers.getContractAt("BlastooorAgentAccount", genesisAgent4640Address, boombotseth) as BlastooorAgentAccount;

  let tx = await genesisAgent4640.execute(STRATEGY_FACTORY_ADDRESS, depositAmount, calldata1, 0, {...networkSettings.overrides, value: depositAmount})
  await watchTxForCreatedAgentID(tx)

  console.log(`createStrategyAgent2`)
}

async function watchTxForCreatedAgentID(tx:any) {
  console.log("tx:", tx);
  let receipt = await tx.wait(networkSettings.confirmations);
  if(!receipt || !receipt.events || receipt.events.length == 0) {
    console.log(receipt)
    throw new Error("events not found");
  }
  let createEvents = (receipt.events as any).filter((event:any) => {
    if(event.address != GENESIS_COLLECTION_ADDRESS && event.address != STRATEGY_COLLECTION_ADDRESS) return false
    if(event.topics.length != 4) return false;
    if(event.topics[0] != "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") return false // transfer topic
    if(event.topics[1] != "0x0000000000000000000000000000000000000000000000000000000000000000") return false // from address zero
    return true
  });
  if(createEvents.length == 0) {
    throw new Error("Create event not detected")
  }
  if(createEvents.length == 1) {
    let createEvent = createEvents[0]
    let agentID = BN.from(createEvent.topics[3]).toNumber()
    console.log(`Created 1 agent. agentID ${agentID}`)
    return agentID
  }
  if(createEvents.length > 1) {
    let agentIDs = createEvents.map((createEvent:any) => BN.from(createEvent.topics[3]).toNumber())
    console.log(`Created ${agentIDs.length} agents. Agent IDs ${agentIDs.join(', ')}`)
    return agentIDs
  }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
