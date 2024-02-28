import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const blasttestnetuser3 = new ethers.Wallet(accounts.blasttestnetuser3.key, provider);
const agentfideployer = new ethers.Wallet(accounts.agentfideployer.key, provider);

import { Agents, BlastAgentAccount, ModulePack100, AgentFactory01, AgentFactory02, IBlast, BalanceFetcher, MockERC20 } from "../../typechain-types";

import { delay } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/setStorage";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../utils/diamond"
import { MulticallProvider, MulticallContract } from "./../utils/multicall";
import { multicallChunked } from "./../utils/network";

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const { formatUnits } = ethers.utils;

let networkSettings: any;
let chainID: number;

let mcProvider = new MulticallProvider(provider, 168587773);

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";
const ENTRY_POINT_ADDRESS             = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const MULTICALL_FORWARDER_ADDRESS     = "0x1740c3552c5f1Bd304fab433C977375357B5Bd7c";
const CONTRACT_FACTORY_ADDRESS        = "0xA74500382CAb2EBFe9A08dc2c01430821A4A8E15"; // v0.1.3

const GAS_COLLECTOR_ADDRESS           = "0x0311b9696907AdC2093448678cf080adA1368d00"; // V0.1.3
const BALANCE_FETCHER_ADDRESS         = "0xb646F462A89799d910b1dc330BA1DA9dE763c931"; // v0.1.3

const AGENT_NFT_ADDRESS               = "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b"; // v0.1.3

const AGENT_FACTORY01_ADDRESS         = "0x66458d8cE1238C7C7818e7988974F0bd5B373c95"; // v0.1.3
const AGENT_FACTORY02_ADDRESS         = "0x59c11B12a2D11810d1ca4afDc21a9Fc837193f41"; // v0.1.3
const AGENT_FACTORY03_ADDRESS         = "0x3c12E9F1FC3C3211B598aD176385939Ea01deA89"; // v0.1.3

const ACCOUNT_IMPL_BASE_ADDRESS       = "0x25a9aD7766D2857E4EB320a9557F637Bd748b97c"; // v0.1.3
const ACCOUNT_IMPL_RING_C_ADDRESS     = "0xeb61E6600f87c07EB40C735B0DF0aedf899C24F6"; // v0.1.3
const ACCOUNT_IMPL_RING_D_ADDRESS     = "0xD9F32ab36bCB6dD3005038DeB53f9ed742947b64"; // v0.1.3
const ACCOUNT_IMPL_THRUSTER_A_ADDRESS = "0xC33F80Ca19c8Cbc55837F4B6c6EC5C3FE7c4400f"; // v0.1.5
const ACCOUNT_IMPL_BASKET_A_ADDRESS   = "0x68e362fC50d62af91Aba1d9184c63505C9EA02c8"; // v0.1.5

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

// thruster
const POSITION_MANAGER_ADDRESS = "0x46Eb7Cff688ea0defCB75056ca209d7A2039fDa8";

const TOKEN_LIST = [
  {address:ETH_ADDRESS, symbol: "ETH", decimals: 18},
  {address:ALL_CLAIMABLE_GAS_ADDRESS, symbol: "ETH All Claimable Gas", decimals: 18},
  {address:MAX_CLAIMABLE_GAS_ADDRESS, symbol: "ETH Max Claimable Gas", decimals: 18},
  {address:WETH_ADDRESS, symbol: "WETH", decimals: 18},
  {address:USDB_ADDRESS, symbol: "USDB", decimals: 18},
  {address:USDC_ADDRESS, symbol: "USDC", decimals: 6},
  {address:USDT_ADDRESS, symbol: "USDT", decimals: 6},
  {address:DAI_ADDRESS, symbol: "DAI", decimals: 18},
  {address:BOLT_ADDRESS, symbol: "BOLT", decimals: 18},
  {address:RGB_ADDRESS, symbol: "RGB", decimals: 18},
  {address:RING_ADDRESS, symbol: "RING", decimals: 18},
  {address:LP_TOKEN_ADDRESS, symbol: "WETH/USDC RING UNI-V2", decimals: 18},
  {address:AGENT_NFT_ADDRESS, symbol: "Agents", decimals: -1},
  {address:POSITION_MANAGER_ADDRESS, symbol: "Thruster V3 Positions", decimals: -1},
]
const TOKEN_ADDRESSES = TOKEN_LIST.map(token=>token.address)

let balanceFetcher: BalanceFetcher;
let agentNft: Agents;
let agentNftMC: any;
let factory01: AgentFactory01;
let factory02: AgentFactory02;
let factory03: AgentFactory02;
let accountImplBase: BlastAgentAccount; // the base implementation for agentfi accounts
let accountImplRingC: BlastAgentAccountRingProtocolC;
let accountImplRingD: BlastAgentAccountRingProtocolD;
let accountImplThrusterA: BlastAgentAccountThrusterA;
let accountImplBasketA: BlastAgentAccountBasketA;

let weth: MockERC20;
let usdc: MockERC20;
let usdb: MockERC20;
let ringLpToken: IRingV2Pair;
let stakingRewards: IFixedStakingRewards;
let positionManager: INonfungiblePositionManager;
let blockTag:any;

let agentID20 = 20
let agentAddress20 = "0xa9b7B191DA5749A203D8e6637C71cE4A92803F99"
let implAddress20 = "0x25a9aD7766D2857E4EB320a9557F637Bd748b97c"
let agentOwner20 = agentfideployer
let accountProxy20: any;

let agentID21 = 21
let agentAddress21 = "0xC541D6cb7302535390Ff10b2AFFcf95DFD190629"
let implAddress21 = "0x68e362fC50d62af91Aba1d9184c63505C9EA02c8"
//let agentOwner21 = agentfideployer // agent 20
let accountProxy21: any;

let agentID22 = 22
let agentAddress22 = "0x5A117d079b2C1272bC2B13f57B80687D5002483f"
let implAddress22 = "0xD9F32ab36bCB6dD3005038DeB53f9ed742947b64"
//let agentOwner22 = agentfideployer // agent 21
let accountProxy22: any;

let agentID23 = 23
let agentAddress23 = "0x0879DcE6101cF72545F59aE8d0b6A1A099464F8F"
let implAddress23 = "0xC33F80Ca19c8Cbc55837F4B6c6EC5C3FE7c4400f"
//let agentOwner23 = agentfideployer // agent 21
let accountProxy23: any;

let iblast: IBlast;

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${blasttestnetuser3.address} as blasttestnetuser3`);
  console.log(`Using ${agentfideployer.address} as agentfideployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID == chainid)/* || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName))*/);
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia. Cannot use a local fork");

  agentNft = await ethers.getContractAt("Agents", AGENT_NFT_ADDRESS, boombotseth) as Agents;
  //agentNftMC = new MulticallContract(AGENT_NFT_ADDRESS, ABI_AGENTS_NFT)

  accountProxy20 = await ethers.getContractAt("BlastAgentAccount", agentAddress20, agentOwner20);
  accountProxy21 = await ethers.getContractAt("BlastAgentAccountBasketA", agentAddress21, agentOwner20);
  accountProxy22 = await ethers.getContractAt("BlastAgentAccountRingProtocolD", agentAddress22, agentOwner20);
  accountProxy23 = await ethers.getContractAt("BlastAgentAccountThrusterA", agentAddress23, agentOwner20);

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, agentfideployer) as IBlast;
  balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, agentfideployer) as BalanceFetcher;

  weth = await ethers.getContractAt("MockERC20", WETH_ADDRESS) as MockERC20;
  usdc = await ethers.getContractAt("MockERC20", USDC_ADDRESS) as MockERC20;
  usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS) as MockERC20;
  ringLpToken = await ethers.getContractAt("IRingV2Pair", LP_TOKEN_ADDRESS) as IRingV2Pair;
  stakingRewards = await ethers.getContractAt("IFixedStakingRewards", STAKING_REWARDS_ADDRESS) as IFixedStakingRewards;
  positionManager = await ethers.getContractAt("INonfungiblePositionManager", POSITION_MANAGER_ADDRESS) as INonfungiblePositionManager;
  blockTag = await provider.getBlockNumber('latest')

  //await fetchAgentBalances20();
  await fetchAgentBalances(agentAddress20, agentID20);
  await fetchAgentBalances(agentAddress21, agentID21);
  await fetchAgentBalances(agentAddress22, agentID22);
  await fetchAgentBalances(agentAddress23, agentID23);

  console.log('')
}

// get token balances
async function fetchAgentBalances(agentAddress:string, agentID:number) {
  console.log(`\nAgent ${agentID} balances:`)

  // fetch 1
  let [balances, ringStakedBalanceOf, ringStakingEarned] = await Promise.all([
    balanceFetcher.callStatic.fetchBalances(agentAddress, TOKEN_ADDRESSES, {...networkSettings.overrides, gasLimit: 30_000_000, blockTag}),
    stakingRewards.balanceOf(STAKING_REWARDS_INDEX, agentAddress, {blockTag}),
    stakingRewards.earned(STAKING_REWARDS_INDEX, agentAddress, {blockTag}),
  ])
  // generic balances
  let numAgents = 0
  let numThrusterV3Positions = 0
  for(let i = 0; i < TOKEN_LIST.length; i++) {
    let bal = balances[i]
    if(bal.eq(0)) continue;
    let { address, symbol, decimals } = TOKEN_LIST[i]
    if(symbol == "Agents") numAgents = bal.toNumber()
    if(symbol == "Thruster V3 Positions") numThrusterV3Positions = bal.toNumber()
    if(decimals > 0) bal = formatUnits(bal, decimals)
    else bal = bal.toString()
    //console.log(`${address}: ${bal} ${symbol}`)
    console.log(`${bal} ${symbol}`)
  }
  // staked ring lps
  if(ringStakedBalanceOf > 0 || ringStakingEarned > 0) {
    let [ts, reserves] = await Promise.all([
      ringLpToken.totalSupply({blockTag}),
      ringLpToken.getReserves({blockTag})
    ])
    let val0 = reserves[0].mul(ringStakedBalanceOf).div(ts)
    let val1 = reserves[1].mul(ringStakedBalanceOf).div(ts)
    console.log(`${formatUnits(ringStakedBalanceOf)} Staked WETH/USDC RING UNI-V2`)
    console.log(`  Redeemable for ${formatUnits(val0, 18)} WETH and ${formatUnits(val1, 6)} USDC`)
    console.log(`${formatUnits(ringStakingEarned)} Claimable RING Rewards`)
  }
  // agents
  if(numAgents > 0) {
    let promises = []
    for(let i = 0; i < numAgents; i++) promises.push(agentNft.tokenOfOwnerByIndex(agentAddress, i, {blockTag}))
    let tokenIds = await Promise.all(promises)
    console.log(`${numAgents == 1 ? "Agent" : "Agents"} ${tokenIds.join(', ')}`)
  }
  // thruster v3 positions
  if(numThrusterV3Positions > 0) {
    let promises = []
    for(let i = 0; i < numThrusterV3Positions; i++) promises.push(positionManager.tokenOfOwnerByIndex(agentAddress, i, {blockTag}))
    let tokenIds = await Promise.all(promises)
    promises = []
    for(let i = 0; i < numThrusterV3Positions; i++) promises.push(positionManager.positions(tokenIds[i]))
    let positions = await Promise.all(promises)
    for(let i = 0; i < numThrusterV3Positions; i++) {
      let tokenId = tokenIds[i]
      let position = positions[i]
      console.log(`Thruster V3 Position ${tokenId}`)
      console.log(`  liquidity                : ${position.liquidity}`)
      console.log(`  feeGrowthInside0LastX128 : ${position.feeGrowthInside0LastX128}`)
      console.log(`  feeGrowthInside1LastX128 : ${position.feeGrowthInside1LastX128}`)
      console.log(`  tokensOwed0              : ${formatUnits(position.tokensOwed0)} USDB`)
      console.log(`  tokensOwed1              : ${formatUnits(position.tokensOwed1)} WETH`)
    }
  }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
