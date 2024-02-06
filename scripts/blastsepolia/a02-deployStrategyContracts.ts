import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const lmaodeployer = new ethers.Wallet(accounts.lmaodeployer.key, provider);

import { RingStrategyAccountA, LmaoStrategyFactory, LmaoStrategyNft } from "../../typechain-types";

import { delay } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/strings";

const { ZeroAddress, WeiPerEther, MaxUint256 } = ethers

let networkSettings: any;
let chainID: number;

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";

const STRATEGY_NFT_ADDRESS            = "0xc529B9f079679e1424b1A2952FCb2f56f2c1a0A9";
const STRATEGY_ACCOUNT_IMPL_ADDRESS   = "0x4a9222FB3F8c3d77a249d9A4e276c034F47Fc9AC";
const STRATEGY_FACTORY_ADDRESS        = "0x9Ba20146e058Ea4A88A9Bb8b980acf8b16a13431";

let strategyNft: LmaoStrategyNft;
let strategyAccountImplementation: RingStrategyAccountA;
let strategyFactory: LmaoStrategyFactory;

async function main() {
  console.log(`Using ${lmaodeployer.address} as lmaodeployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID == chainid) || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia or a local fork of Blast Sepolia");
  //await expectDeployed(ERC6551_REGISTRY_ADDRESS)

  await deployLmaoStrategyNft();
  await deployRingStrategyAccountA();
  await deployLmaoStrategyFactory();
  await whitelistFactories();
  //await setNftMetadata();

  await logAddresses();
}

async function deployLmaoStrategyNft() {
  if(await isDeployed(STRATEGY_NFT_ADDRESS)) {
    strategyNft = await ethers.getContractAt("LmaoStrategyNft", STRATEGY_NFT_ADDRESS, lmaodeployer) as LmaoStrategyNft;
    strategyNft.address = strategyNft.target
  } else {
    console.log("Deploying LmaoStrategyNft");
    let args = [ERC6551_REGISTRY_ADDRESS, lmaodeployer.address];
    strategyNft = await deployContractUsingContractFactory(lmaodeployer, "LmaoStrategyNft", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as LmaoStrategyNft;
    console.log(`Deployed LmaoStrategyNft to ${strategyNft.address}`);
    if(chainID != 31337) await verifyContract(strategyNft.address, args);
    if(!!STRATEGY_NFT_ADDRESS && strategyNft.address != STRATEGY_NFT_ADDRESS) throw new Error(`Deployed LmaoStrategyNft to ${strategyNft.address}, expected ${STRATEGY_NFT_ADDRESS}`)
  }
}

async function deployRingStrategyAccountA() {
  if(await isDeployed(STRATEGY_ACCOUNT_IMPL_ADDRESS)) {
    strategyAccountImplementation = await ethers.getContractAt("RingStrategyAccountA", STRATEGY_ACCOUNT_IMPL_ADDRESS, lmaodeployer) as RingStrategyAccountA;
    strategyAccountImplementation.address = strategyAccountImplementation.target
  } else {
    console.log("Deploying RingStrategyAccountA");
    const badcode = "0x000000000000000000000000000000000baDC0DE"
    let args = [badcode, badcode, ERC6551_REGISTRY_ADDRESS, badcode];
    strategyAccountImplementation = await deployContractUsingContractFactory(lmaodeployer, "RingStrategyAccountA", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as RingStrategyAccountA;
    console.log(`Deployed RingStrategyAccountA to ${strategyAccountImplementation.address}`);
    if(chainID != 31337) await verifyContract(strategyAccountImplementation.address, args);
    if(!!STRATEGY_ACCOUNT_IMPL_ADDRESS && strategyAccountImplementation.address != STRATEGY_ACCOUNT_IMPL_ADDRESS) throw new Error(`Deployed RingStrategyAccountA to ${strategyAccountImplementation.address}, expected ${STRATEGY_ACCOUNT_IMPL_ADDRESS}`)
  }
}

async function deployLmaoStrategyFactory() {
  if(await isDeployed(STRATEGY_FACTORY_ADDRESS)) {
    strategyFactory = await ethers.getContractAt("LmaoStrategyFactory", STRATEGY_FACTORY_ADDRESS, lmaodeployer) as LmaoStrategyFactory;
    strategyFactory.address = strategyFactory.target
  } else {
    console.log("Deploying LmaoStrategyFactory");
    let botInitializationCode1 = "0x"
    let botInitializationCode2 = "0x"
    let args = [
      lmaodeployer.address,
      strategyNft.address,
      strategyAccountImplementation.address,
      botInitializationCode1,
      botInitializationCode2,
    ];
    strategyFactory = await deployContractUsingContractFactory(lmaodeployer, "LmaoStrategyFactory", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as LmaoStrategyFactory;
    console.log(`Deployed LmaoStrategyFactory to ${strategyFactory.address}`);
    if(chainID != 31337) await verifyContract(strategyFactory.address, args);
    if(!!STRATEGY_FACTORY_ADDRESS && strategyFactory.address != STRATEGY_FACTORY_ADDRESS) throw new Error(`Deployed LmaoStrategyFactory to ${strategyFactory.address}, expected ${STRATEGY_FACTORY_ADDRESS}`)
  }
}

async function whitelistFactories() {
  let isWhitelisted = await strategyNft.connect(lmaodeployer).factoryIsWhitelisted(strategyFactory.address)
  if(!isWhitelisted) {
    console.log("Whitelisting factories")
    let tx = await strategyNft.connect(lmaodeployer).setWhitelist([
      {
        factory: strategyFactory.address,
        shouldWhitelist: true,
      }
    ], networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log("Whitelisted factories")
  }
}

async function setNftMetadata() {
  let txdatas = [] as any[]
  let desiredContractURI = "https://stats-cdn.lmaolabs.xyz/strategyNftContractURI.json"
  let desiredBaseURI = "https://stats.lmaolabs.xyz/strategies/metadata/?chainID=168587773&v=0.1.0&strategyID="
  let currentContractURI = await strategyNft.contractURI()
  let currentBaseURI = await strategyNft.baseURI()
  if(currentContractURI != desiredContractURI) {
    txdatas.push(strategyNft.interface.encodeFunctionData("setContractURI", [desiredContractURI]))
  }
  if(currentBaseURI != desiredBaseURI) {
    txdatas.push(strategyNft.interface.encodeFunctionData("setBaseURI", [desiredBaseURI]))
  }
  if(txdatas.length == 0) return
  var tx
  console.log("Setting NFT metadata");
  if(txdatas.length == 1) {
    tx = await lmaodeployer.sendTransaction({
      to: strategyNft.address,
      data: txdatas[0],
      ...networkSettings.overrides,
      gasLimit: 1_000_000
    })
  } else { // length > 1
    tx = await strategyNft.multicall(txdatas, {...networkSettings.overrides, gasLimit: 1_000_000});
  }
  console.log("tx:", tx);
  await tx.wait(networkSettings.confirmations);
  console.log("Set NFT metadata");
}

async function logAddresses() {
  console.log("");
  console.log("| Contract Name                | Address                                      |");
  console.log("|------------------------------|----------------------------------------------|");
  logContractAddress("ERC6551Registry", ERC6551_REGISTRY_ADDRESS);
  logContractAddress("LmaoStrategyNft", strategyNft.address);
  logContractAddress("RingStrategyAccountA", strategyAccountImplementation.address);
  logContractAddress("LmaoStrategyFactory", strategyFactory.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
