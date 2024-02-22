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
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;
const { formatUnits } = ethers.utils;

let networkSettings: any;
let chainID: number;

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";
const ENTRY_POINT_ADDRESS             = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

const CONTRACT_FACTORY_ADDRESS        = "0xa43C26F8cbD9Ea70e7B0C45e17Af81B6330AC543";

const BOOM_BOTS_NFT_ADDRESS           = "0xB3856D22fE476892Af3Cc6dee3D84F015AD5F5b1"; // v0.1.1
const ACCOUNT_IMPL_DIAMOND_ADDRESS    = "0x152d3Ba1f7ac4a0AD0ec485b6A292B1F92aB8876"; // v0.1.1
const MODULE_PACK_100_ADDRESS         = "0x044CA8B45C270E744BDaE436E7FA861c6de6b5A5"; // v0.1.0
const MODULE_PACK_101_ADDRESS         = "0x0ea0b9aF8dD6D2C294281E7a983909BA81Bbb199"; // v0.1.1
const DATA_STORE_ADDRESS              = "0x4092c948cE402c18c8Ad6342859dEe8bcAD932bC"; // v0.1.1
const AGENT_FACTORY01_ADDRESS     = "0x0B0eEBa9CC8035D8EB2516835E57716f0eAE7B73"; // v0.1.1

const BALANCE_FETCHER_ADDRESS         = "0x183D60a574Ef5F75e65e3aC2190b8B1Ad0707d71";

const GAS_BURNER_ADDRESS              = "0x97B73d8B2c0372794a11bE7990Ac85CE07B682DB";

// v0.1.1
const BOT_1_ADDRESS = "0x7CF5C2124dea60aC8dE90FA53CA611BA9d27628F" // BoomBotDiamondAccount v0.1.1

const ABI_BLAST = JSON.parse(fs.readFileSync("abi/contracts/interfaces/external/Blast/IBlast.sol/IBlast.json").toString())
const ABI_GAS_BURNER = JSON.parse(fs.readFileSync("abi/contracts/mocks/accounts/MockGasBurner.sol/MockGasBurner.json").toString())

let gasBurner: MockGasBurner;
let agentNft: Agents;
let accountImplDiamond: BoomBotDiamondAccount; // the base implementation for agentfi accounts
let modulePack100: ModulePack100;
let dataStore: DataStore;
let factory01: AgentFactory01;

let iblast: IBlast;


let abi = getCombinedAbi([
  "artifacts/contracts/accounts/BoomBotDiamondAccount.sol/BoomBotDiamondAccount.json",
  //"artifacts/contracts/modules/ModulePack100.sol/ModulePack100.json",
  "artifacts/contracts/modules/ModulePack101.sol/ModulePack101.json",
  //"artifacts/contracts/mocks/accounts/MockGasBurner.sol/MockGasBurner.json",
  //"artifacts/contracts/mocks/accounts/MockGasBurner2.sol/MockGasBurner2.json",
  //"artifacts/contracts/mocks/accounts/MockBlastableAccount.sol/MockBlastableAccount.json",
])

async function main() {
  console.log(`Using ${agentfideployer.address} as agentfideployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID == chainid)/* || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName))*/);
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia. Cannot use a local fork");

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, boombotseth) as IBlast;

  gasBurner = await ethers.getContractAt(abi, GAS_BURNER_ADDRESS, agentfideployer) as MockGasBurner;

  //await doMath();
  //await configureGasBurner();
  //await doMath();
  //await transferEthIn();
  //await doMath();
  //await burnGas();
  //await doMath();
  //await claimMaxGas();
  //await claimAllGas();

  // v0.1.1
  await doMathAddr(ERC6551_REGISTRY_ADDRESS, "ERC6551Registry", 0, 0);

  await doMathAddr(CONTRACT_FACTORY_ADDRESS, "ContractFactory", 1, 1);

  await doMathAddr(GAS_BURNER_ADDRESS, "GasBurner", 1, 1);
  await doMathAddr(BOOM_BOTS_NFT_ADDRESS, "AgentsNft", 1, 1);
  await doMathAddr(MODULE_PACK_100_ADDRESS, "ModulePack100", 0, 0);
  await doMathAddr(MODULE_PACK_101_ADDRESS, "ModulePack101", 1, 2);
  await doMathAddr(DATA_STORE_ADDRESS, "DataStore", 1, 1);
  await doMathAddr(AGENT_FACTORY01_ADDRESS, "AgentFactory01", 1, 1);
  await doMathAddr(ACCOUNT_IMPL_DIAMOND_ADDRESS, "BoomBotDiamondAccount Impl", 1, 2);
  await doMathAddr(BOT_1_ADDRESS, "Agent 1 v0.1.1", 1, 3);
}
/*
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
*/
async function doMath(contract:any, contractName:string, supportsQuoteClaimAllGas=0, supportsClaimGas=0) {
  console.log(`\nDoing math on contract: ${contractName}`)
  try {
    let block = await provider.getBlock("latest")
    let blockTag = block.number
    let overrides = {...networkSettings.overrides, gasLimit: 1_000_000, blockTag}

    var promises = [
      iblast.readClaimableYield(contract.address, overrides),
      iblast.readYieldConfiguration(contract.address, overrides),
      iblast.readGasParams(contract.address, overrides),
      //contract.connect(agentfideployer).callStatic.quoteClaimMaxGas(overrides),
      //contract.connect(agentfideployer).callStatic.quoteClaimAllGas(overrides),
      //contract.connect(agentfideployer).callStatic.claimMaxGas(agentfideployer.address, overrides),
      //contract.connect(agentfideployer).callStatic.claimAllGas(agentfideployer.address, overrides),
      (() => { return 12345 })(),
      (() => { return 12345 })(),
      (() => { return 12345 })(),
      (() => { return 12345 })(),
    ]
    if(!!supportsQuoteClaimAllGas) {
      promises[3] = contract.connect(agentfideployer).callStatic.quoteClaimMaxGas(overrides)
      promises[4] = contract.connect(agentfideployer).callStatic.quoteClaimAllGas(overrides)
    }
    if(supportsClaimGas==1) {
      promises[5] = contract.connect(agentfideployer).callStatic.claimMaxGas(agentfideployer.address, overrides)
      promises[6] = contract.connect(agentfideployer).callStatic.claimAllGas(agentfideployer.address, overrides)
    }
    if(supportsClaimGas==2) {
      //promises[5] = contract.connect(agentfideployer).callStatic.claimMaxGasImpl(agentfideployer.address, overrides)
      //promises[6] = contract.connect(agentfideployer).callStatic.claimAllGasImpl(agentfideployer.address, overrides)
      promises[5] = contract.connect(agentfideployer).callStatic.zzz_implClaimMaxGas(agentfideployer.address, overrides)
      promises[6] = contract.connect(agentfideployer).callStatic.zzz_implClaimAllGas(agentfideployer.address, overrides)
    }
    if(supportsClaimGas==3) {
      let calldata5 = iblast.interface.encodeFunctionData("claimMaxGas", [contract.address, contract.address])
      let calldata6 = iblast.interface.encodeFunctionData("claimAllGas", [contract.address, contract.address])
      promises[5] = contract.connect(agentfideployer).callStatic.execute(BLAST_ADDRESS, 0, calldata5, 0, overrides)
      promises[6] = contract.connect(agentfideployer).callStatic.execute(BLAST_ADDRESS, 0, calldata6, 0, overrides)
    }
    var res = await Promise.all(promises)
    //console.log({res})
    var [res0, res1, res2, res3, res4, res5, res6] = res

    const yieldModes = [
      'AUTOMATIC',
      'VOID',
      'CLAIMABLE'
    ]
    const yieldMode = yieldModes[res1] || "unknown"
    const gasModes = [
      'VOID',
      'CLAIMABLE'
    ]
    const gasMode = gasModes[res2[3]] || "unknown"

    const detailLevel = 2

    if(detailLevel == 1) {

    }
    else if(detailLevel == 2) {
      console.log(`Claimable yield      : ${res0}`)
      console.log(`Yield configuration  : ${res1} (${yieldMode})`)
      console.log(`Gas params`)
      console.log(`  etherSeconds       : ${formatUnits2(res2[0])} ETH*seconds`)
      console.log(`  etherBalance       : ${formatUnits2(res2[1])}`)
      console.log(`  lastUpdated        : ${res2[2]}`)
      console.log(`  gasMode            : ${res2[3]} (${gasMode})`)
      console.log(`Claim max gas`)
      console.log(`  quote              : ${!!supportsQuoteClaimAllGas ? `${formatUnits2(res3)} ETH` : `not supported`}`)
      console.log(`  real               : ${!!supportsClaimGas ? `${formatUnits2(res5)} ETH` : `not supported`}`)
      console.log(`Claim all gas`)
      console.log(`  quote              : ${!!supportsQuoteClaimAllGas ? `${formatUnits2(res4)} ETH` : `not supported`}`)
      console.log(`  real               : ${!!supportsClaimGas ? `${formatUnits2(res6)} ETH` : `not supported`}`)
    }
    console.log("Did math\n")
  } catch(e) {
    console.error(`Caught error while doing math on contract: ${contractName}`)
    console.error(e)
  }
}

async function doMathAddr(address:string, contractName:string, supportsQuoteClaimAllGas=0, supportsClaimGas=0) {
  var contract = await ethers.getContractAt(abi, address, agentfideployer) as MockGasBurner;
  await doMath(contract, contractName, supportsQuoteClaimAllGas, supportsClaimGas)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
