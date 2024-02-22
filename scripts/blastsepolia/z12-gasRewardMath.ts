import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const agentfideployer = new ethers.Wallet(accounts.agentfideployer.key, provider);

import { MockGasBurner, IBlast } from "../../typechain-types";

const fs = require("fs")
import { delay } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/setStorage";
import { formatUnits2 } from "./../utils/strings";
import { MulticallProvider, MulticallContract } from "./../utils/multicall";
import { multicallChunked } from "./../utils/network";

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;
const { formatUnits } = ethers.utils;

let networkSettings: any;
let chainID: number;

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";
const ENTRY_POINT_ADDRESS             = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

const GAS_BURNER_ADDRESS              = "0x97B73d8B2c0372794a11bE7990Ac85CE07B682DB"; // 3

const ABI_BLAST = JSON.parse(fs.readFileSync("abi/contracts/interfaces/external/Blast/IBlast.sol/IBlast.json").toString())
const ABI_GAS_BURNER = JSON.parse(fs.readFileSync("abi/contracts/mocks/accounts/MockGasBurner.sol/MockGasBurner.json").toString())

let iblast: IBlast;
let gasBurner: MockGasBurner;
let iblastMC: any;
let gasBurnerMC: any;

async function main() {
  console.log(`Using ${agentfideployer.address} as agentfideployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia or a local fork of Blast Sepolia");

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, boombotseth) as IBlast;
  iblastMC = new MulticallContract(BLAST_ADDRESS, ABI_BLAST)

  await deployGasBurner();
  //gasBurner = await ethers.getContractAt("MockGasBurner", GAS_BURNER_ADDRESS, agentfideployer) as MockGasBurner;
  //gasBurnerMC = new MulticallContract(GAS_BURNER_ADDRESS, ABI_GAS_BURNER)
  //await doMath();
  //await configureGasBurner();
  //await doMath();
  //await transferEthIn();
  //await doMath();
  //await burnGas();
  await doMath();
  await claimMaxGas();
  //await claimAllGas();
  await doMath();
}


async function deployGasBurner() {
  if(await isDeployed(GAS_BURNER_ADDRESS)) {
    gasBurner = await ethers.getContractAt("MockGasBurner", GAS_BURNER_ADDRESS, agentfideployer) as MockGasBurner;
  } else {
    console.log("Deploying MockGasBurner");
    let args = [agentfideployer.address];
    gasBurner = await deployContractUsingContractFactory(agentfideployer, "MockGasBurner", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as MockGasBurner;
    console.log(`Deployed MockGasBurner to ${gasBurner.address}`);
    if(chainID != 31337) await verifyContract(gasBurner.address, args);
    if(!!GAS_BURNER_ADDRESS && gasBurner.address != GAS_BURNER_ADDRESS) throw new Error(`Deployed ModulePack100 to ${gasBurner.address}, expected ${GAS_BURNER_ADDRESS}`)
  }
}

async function configureGasBurner() {
  console.log("Configuring gas burner")
  let calldata0 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let calldata1 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let txdata0 = gasBurner.interface.encodeFunctionData("callBlast", [calldata0])
  let txdata1 = gasBurner.interface.encodeFunctionData("callBlast", [calldata1])
  //let txdatas = [calldata0, calldata1]
  let txdatas = [txdata0, txdata1]
  //let txdatas = []
  let tx = await gasBurner.connect(agentfideployer).multicall(txdatas, {...networkSettings.overrides, gasLimit: 500_000})
  console.log('tx')
  console.log(tx)
  await tx.wait(networkSettings.confirmations)
  console.log("Configured gas burner")
}

async function transferEthIn() {
  console.log("Transferring ETH in")
  let tx = await boombotseth.sendTransaction({
    ...networkSettings.overrides,
    to: gasBurner.address,
    value: WeiPerEther.mul(1).div(1000),
  })
  await tx.wait(networkSettings.confirmations)
  console.log("Transferred ETH in")
}

async function burnGas() {
  console.log("Burning gas")
  let tx = await gasBurner.connect(agentfideployer).burnGas(1000, {...networkSettings.overrides, gasLimit: 2_000_000})
  console.log('tx')
  console.log(tx)
  await tx.wait(networkSettings.confirmations)
  console.log("Burnt gas")
}

async function claimMaxGas() {
  console.log("Claiming max gas")
  let bal1 = await provider.getBalance(gasBurner.address)
  let tx = await gasBurner.connect(agentfideployer).claimMaxGas(gasBurner.address, {...networkSettings.overrides, gasLimit: 2_000_000})
  //console.log('tx')
  //console.log(tx)
  await tx.wait(networkSettings.confirmations)
  let bal2 = await provider.getBalance(gasBurner.address)
  let claimed = bal2.sub(bal1)
  console.log(`Claimed ${formatUnits2(claimed)} gas`)
}

async function claimAllGas() {
  console.log("Claiming all gas")
  let bal1 = await provider.getBalance(gasBurner.address)
  let tx = await gasBurner.connect(agentfideployer).claimAllGas(gasBurner.address, {...networkSettings.overrides, gasLimit: 2_000_000})
  //console.log('tx')
  //console.log(tx)
  await tx.wait(networkSettings.confirmations)
  let bal2 = await provider.getBalance(gasBurner.address)
  let claimed = bal2.sub(bal1)
  console.log(`Claimed ${formatUnits2(claimed)} gas`)
}

async function doMath() {
  console.log("Doing math")

  let block = await provider.getBlock("latest")
  let blockTag = block.number
  let overrides = {...networkSettings.overrides, gasLimit: 1_000_000, blockTag}

  var res = await Promise.all([
    iblast.readClaimableYield(gasBurner.address, overrides),
    iblast.readYieldConfiguration(gasBurner.address, overrides),
    iblast.readGasParams(gasBurner.address, overrides),
    gasBurner.connect(agentfideployer).callStatic.claimMaxGas(agentfideployer.address, overrides),
    gasBurner.connect(agentfideployer).callStatic.claimAllGas(agentfideployer.address, overrides),
    gasBurner.connect(agentfideployer).callStatic.quoteClaimMaxGas(overrides),
    gasBurner.connect(agentfideployer).callStatic.quoteClaimAllGas(overrides),
  ])
  var [res1, res2, res3, res4, res5, res6, res7] = res

  console.log(`Claimable yield      : ${res1}`)
  console.log(`Yield configuration  : ${res2}`)
  console.log(`Gas params`)
  console.log(`  etherSeconds       : ${formatUnits2(res3[0])} ETH*seconds`)
  console.log(`  etherBalance       : ${formatUnits2(res3[1])}`)
  console.log(`  lastUpdated        : ${res3[2]}`)
  console.log(`  gasMode            : ${res3[3]}`)

  console.log(`Claim max gas`)
  console.log(`  real               : ${formatUnits2(res4)} ETH`)
  console.log(`  quote              : ${formatUnits2(res6)} ETH`)
  console.log(`Claim all gas`)
  console.log(`  real               : ${formatUnits2(res5)} ETH`)
  console.log(`  quote              : ${formatUnits2(res7)} ETH`)

  // trying to do math. easier to build quoter
  /*
  var now = Math.floor(Date.now() / 1000)
  console.log('')
  console.log(`Now:                 : ${now}`)
  console.log(`Last updated         : ${res3[2]}`)
  var elapsedTime = now - res3[2]
  console.log(`Time elapsed         : ${elapsedTime} seconds`)

  var ceilGasSeconds = 2592000 // 30 days
  if(elapsedTime > ceilGasSeconds) elapsedTime = ceilGasSeconds
  var percent = 50 + 50 * (elapsedTime / ceilGasSeconds)
  console.log(`Claim rate           : ${percent}%`)
  var pred = res3[1].mul(Math.floor(percent*10000000000)).div(1000000000000)
  console.log(`Claim all pred       : ${formatUnits2(pred)} ETH`)
  */
  console.log("\nDid math")
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
