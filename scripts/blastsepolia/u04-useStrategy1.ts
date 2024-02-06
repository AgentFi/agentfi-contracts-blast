import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const lmaodeployer = new ethers.Wallet(accounts.lmaodeployer.key, provider);
const blasttestnetuser2 = new ethers.Wallet(accounts.blasttestnetuser2.key, provider);

import { RingStrategyAccountA, LmaoStrategyFactory, LmaoStrategyNft } from "../../typechain-types";

import { delay } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { getNetworkSettings } from "./../utils/getNetworkSettings";

const { WeiPerEther } = ethers;

let networkSettings: any;
let chainID: number;

const fs = require("fs")
const ABI_MULTICALL = JSON.parse(fs.readFileSync("data/abi/other/Multicall3.json").toString())
const ABI_STRATEGY_NFT = JSON.parse(fs.readFileSync("abi/contracts/strategies/LmaoStrategyNft.sol/LmaoStrategyNft.json").toString())
const ABI_AGENT_TBA = JSON.parse(fs.readFileSync("abi/contracts/agents/LmaoAgentAccount.sol/LmaoAgentAccount.json").toString())
const ABI_STRATEGY_TBA = JSON.parse(fs.readFileSync("abi/contracts/strategies/RingStrategyAccountA.sol/RingStrategyAccountA.json").toString())

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
  console.log(`Using ${blasttestnetuser2.address} as blasttestnetuser2`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID == chainid)/* || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName))*/);
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia. Cannot use a local fork");

  //await useStrategy1_1();
  await useStrategy1_2();
  await useStrategy1_3();
}

// execute strategy via agent owner eoa -> agent tba -> strategy tba
async function useStrategy1_1() {
  console.log("Using strategy 1_1")
  let agentAddress1 = "0x67f0DC0A76e20B3b059b85465f48CA15dc9947DF"
  let strategyAddress1 = "0xb0ee046c3daFdB562776942bAFe8dB37a9D2b1E8"
  let agent1Account = await ethers.getContractAt(ABI_AGENT_TBA, agentAddress1, lmaodeployer);
  let strategy1Account = await ethers.getContractAt(ABI_STRATEGY_TBA, strategyAddress1, lmaodeployer);
  let amount0 = WeiPerEther * 5n / 1000n
  let amount1 = WeiPerEther * 3n / 1000n
  let amount2 = WeiPerEther * 1n / 1000n
  let calldata = strategy1Account.interface.encodeFunctionData("executeRingProtocolStrategyA", [amount2])
  let tx = await agent1Account.execute(strategyAddress1, amount1, calldata, 0, {...networkSettings.overrides, gasLimit:2_000_000, value: amount0})
  console.log('tx')
  console.log(tx)
  await tx.wait(networkSettings.confirmations)
  console.log("Used strategy 1_1")
}

// give strategy manager role
async function useStrategy1_2() {
  console.log("Using strategy 1_2")
  let agentAddress1 = "0x67f0DC0A76e20B3b059b85465f48CA15dc9947DF"
  let strategyAddress1 = "0xb0ee046c3daFdB562776942bAFe8dB37a9D2b1E8"
  let agent1Account = await ethers.getContractAt(ABI_AGENT_TBA, agentAddress1, lmaodeployer);
  let strategy1Account = await ethers.getContractAt(ABI_STRATEGY_TBA, strategyAddress1, lmaodeployer);
  let params = [{
    role: "0x4170d100a3a3728ae51207936ee755ecaa64a7f6e9383c642ab204a136f90b1b",
    account: boombotseth.address,
    grantAccess: true,
  }]
  let calldata = strategy1Account.interface.encodeFunctionData("setRoles", [params])
  let tx = await agent1Account.execute(strategyAddress1, 0, calldata, 0, {...networkSettings.overrides, gasLimit:2_000_000, value: 0})
  console.log('tx')
  console.log(tx)
  await tx.wait(networkSettings.confirmations)
  console.log("Used strategy 1_2")
}

// execute strategy via strategy manager eoa -> strategy
async function useStrategy1_3() {
  console.log("Using strategy 1_3")
  //let agentAddress1 = "0x67f0DC0A76e20B3b059b85465f48CA15dc9947DF"
  let strategyAddress1 = "0xb0ee046c3daFdB562776942bAFe8dB37a9D2b1E8"
  //let agent1Account = await ethers.getContractAt(ABI_AGENT_TBA, agentAddress1, lmaodeployer);
  let strategy1Account = await ethers.getContractAt(ABI_STRATEGY_TBA, strategyAddress1, lmaodeployer);
  let amount0 = WeiPerEther * 35n / 1000n
  let amount1 = WeiPerEther * 33n / 1000n
  //let calldata = strategy1Account.interface.encodeFunctionData("executeRingProtocolStrategyA", [amount2])
  //let tx = await agent1Account.execute(strategyAddress1, amount1, calldata, 0, {...networkSettings.overrides, gasLimit:2_000_000, value: amount0})
  let tx = await strategy1Account.connect(boombotseth).executeRingProtocolStrategyA(amount1, {...networkSettings.overrides, gasLimit:2_000_000, value: amount0})
  console.log('tx')
  console.log(tx)
  await tx.wait(networkSettings.confirmations)
  console.log("Used strategy 1_3")
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
