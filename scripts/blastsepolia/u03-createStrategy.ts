import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const lmaodeployer = new ethers.Wallet(accounts.lmaodeployer.key, provider);

import { RingStrategyAccountA, LmaoStrategyFactory, LmaoStrategyNft } from "../../typechain-types";

import { delay } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { getNetworkSettings } from "./../utils/getNetworkSettings";

let networkSettings: any;
let chainID: number;

const fs = require("fs")
const ABI_MULTICALL = JSON.parse(fs.readFileSync("data/abi/other/Multicall3.json").toString())
const ABI_STRATEGY_NFT = JSON.parse(fs.readFileSync("abi/contracts/strategies/LmaoStrategyNft.sol/LmaoStrategyNft.json").toString())
const ABI_AGENT_TBA = JSON.parse(fs.readFileSync("abi/contracts/agents/LmaoAgentAccount.sol/LmaoAgentAccount.json").toString())

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";

const STRATEGY_NFT_ADDRESS            = "0xc529B9f079679e1424b1A2952FCb2f56f2c1a0A9";
const STRATEGY_ACCOUNT_IMPL_ADDRESS   = "0x4a9222FB3F8c3d77a249d9A4e276c034F47Fc9AC";
const STRATEGY_FACTORY_ADDRESS        = "0x9Ba20146e058Ea4A88A9Bb8b980acf8b16a13431";

let strategyNft: LmaoStrategyNft;
let strategyAccountImplementation: RingStrategyAccountA;
let strategyFactory: LmaoStrategyFactory;

async function main() {
  console.log(`Using ${lmaodeployer.address} as lmaodeployer`);
  console.log(`Using ${boombotseth.address} as boombotseth`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID == chainid) || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia or a local fork of Blast Sepolia");
  //await expectDeployed(ERC6551_REGISTRY_ADDRESS)

  strategyNft = await ethers.getContractAt("LmaoStrategyNft", STRATEGY_NFT_ADDRESS, lmaodeployer) as LmaoStrategyNft;
  strategyFactory = await ethers.getContractAt("LmaoStrategyFactory", STRATEGY_FACTORY_ADDRESS, lmaodeployer) as LmaoStrategyFactory;

  await listStrategies();
  await createStrategies();
  await listStrategies();
}

async function listStrategies() {
  let ts = await strategyNft.totalSupply();
  console.log(`Number strategies created: ${ts}`);
  if(ts == 0) return;
  console.log("Info:")
  let calls = [] as any[]
  for(let strategyID = 1; strategyID <= ts; strategyID++) {
    calls.push(strategyNft.getStrategyInfo(strategyID))
    calls.push(strategyNft.ownerOf(strategyID))
  }
  const results = await Promise.all(calls)
  for(let strategyID = 1; strategyID <= ts; strategyID++) {
    console.log(`Strategy ID ${strategyID}`)
    let strategyInfo = results[strategyID*2-2]
    let strategyAddress = strategyInfo.strategyAddress
    let implementationAddress = strategyInfo.implementationAddress
    let owner = results[strategyID*2-1]
    console.log(`  Strategy Address   ${strategyAddress}`)
    console.log(`  TBA Impl           ${implementationAddress}`)
    console.log(`  Owner              ${owner}`)
  }
}

async function createStrategies() {
  //await createStrategy(lmaodeployer);
  /*
  await createStrategy(lmaodeployer);
  await createStrategy(boombotseth);
  await createStrategy(lmaodeployer);
  await createStrategy(boombotseth);
  await createStrategy(lmaodeployer);
  await createStrategy(boombotseth);
  await createStrategy(lmaodeployer);
  await createStrategy(boombotseth);
  */
  //await createStrategiesMulticall(boombotseth, 3);
  //await createStrategiesMulticall(lmaodeployer, 5);

  let agentAddress1 = "0x67f0DC0A76e20B3b059b85465f48CA15dc9947DF"
  let agent1Account = await ethers.getContractAt(ABI_AGENT_TBA, agentAddress1, lmaodeployer);
  let calldata = strategyFactory.interface.encodeFunctionData("createStrategy()", [])
  let tx = await agent1Account.execute(STRATEGY_FACTORY_ADDRESS, 0, calldata, 0, {...networkSettings.overrides, gasLimit:1_000_000})
  await watchTxForCreatedStrategyID(tx)
}
/*
async function createStrategy(creator=boombotseth) {
  console.log(`Creating new strategy`)
  let tx = await strategyFactory.connect(creator)['createStrategy()']({...networkSettings.overrides, gasLimit: 1_500_000})
  await watchTxForCreatedStrategyID(tx)
}

async function createStrategiesMulticall(creator=boombotseth, numStrategies=5) {
  console.log(`Creating ${numStrategies} new strategies`)
  let txdata = strategyFactory.interface.encodeFunctionData('createStrategy()', [])
  let txdatas = [] as any[]
  for(let i = 0; i < numStrategies; i++) txdatas.push(txdata)
  let tx = await strategyFactory.connect(creator).multicall(txdatas, {...networkSettings.overrides, gasLimit: 1_500_000*numStrategies})
  await watchTxForCreatedStrategyID(tx)
}
*/
async function watchTxForCreatedStrategyID(tx:any) {
  //console.log("tx:", tx);
  let receipt = await tx.wait(networkSettings.confirmations);
  if(!receipt || !receipt.logs || receipt.logs.length == 0) {
    console.log(receipt)
    throw new Error("logs not found");
  }
  let createEvents = (receipt.logs as any).filter((event:any) => {
    if(event.address != STRATEGY_NFT_ADDRESS) return false
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
    let strategyID = parseInt(createEvent.topics[3])
    console.log(`Created 1 strategy. strategyID ${strategyID}`)
    return strategyID
  }
  if(createEvents.length > 1) {
    let strategyIDs = createEvents.map((createEvent:any) => parseInt(createEvent.topics[3]))
    console.log(`Created ${strategyIDs.length} strategies. Strategy IDs ${strategyIDs.join(', ')}`)
    return strategyIDs
  }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
