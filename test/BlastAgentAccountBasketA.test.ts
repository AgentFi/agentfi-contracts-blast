/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;

import { IERC6551Registry, Agents, ERC165Module, FallbackModule, RevertModule, AgentFactory01, AgentFactory02, MockERC20, MockERC721, RevertAccount, MockERC1271, GasCollector, BlastAgentAccount } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { toBytes32 } from "./../scripts/utils/setStorage";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { deployContract } from "../scripts/utils/deployContract";
import L1DataFeeAnalyzer from "../scripts/utils/L1DataFeeAnalyzer";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../scripts/utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const { formatUnits } = ethers.utils;
const WeiPerUsdc = BN.from(1_000_000); // 6 decimals

const ERC6551_REGISTRY_ADDRESS = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS            = "0x4300000000000000000000000000000000000002";
const ENTRY_POINT_ADDRESS      = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const badcode                  = "0x000000000000000000000000000000000baDC0DE";

const SWAP_ROUTER_ADDRESS      = "0xE4690BD7A9cFc681A209443BCE31aB943F9a9459";
const POSITION_MANAGER_ADDRESS = "0x46Eb7Cff688ea0defCB75056ca209d7A2039fDa8";
const FACTORY_ADDRESS          = "0xe05c310A68F0D3A30069A20cB6fAeD5612C70c88";
const WETH_ADDRESS             = "0x4200000000000000000000000000000000000023";
const USDB_ADDRESS             = "0x4200000000000000000000000000000000000022";

describe("BlastAgentAccountThrusterA", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  let erc6551Registry: IERC6551Registry;

  let gasCollector: GasCollector;
  let agentNft: Agents;
  let blastAccountImplementation: BlastAgentAccount; // the base implementation for token bound accounts
  let tbaccount1: BlastAgentAccount; // an account bound to a token
  let tbaccount2: BlastAgentAccount; // an account bound to a token
  let agentInitializationCode1: any;
  let agentInitializationCode2: any;
  // factory
  let factory: AgentFactory02;

  let stakingRewards: IFixedStakingRewards;

  let erc20a: MockERC20;
  let erc20b: MockERC20;
  let erc20c: MockERC20;

  let weth: MockERC20;
  let usdb: MockERC20;

  let chainID: number;
  let networkSettings: any;
  let snapshot: BN;

  let l1DataFeeAnalyzer = new L1DataFeeAnalyzer();

  before(async function () {
    [deployer, owner, user1, user2, user3, user4, user5] = await ethers.getSigners();
    chainID = (await provider.getNetwork()).chainId;
    networkSettings = getNetworkSettings(chainID);
    if(!networkSettings.isTestnet) throw new Error("Do not run tests on production networks");
    snapshot = await provider.send("evm_snapshot", []);
    await deployer.sendTransaction({to:deployer.address}); // for some reason this helps solidity-coverage

    erc20a = await deployContract(deployer, "MockERC20", [`Token A`, `TKNA`, 18]) as MockERC20;
    erc20b = await deployContract(deployer, "MockERC20", [`Token B`, `TKNB`, 18]) as MockERC20;
    erc20c = await deployContract(deployer, "MockERC20", [`Token C`, `TKNC`, 18]) as MockERC20;

    await expectDeployed(ERC6551_REGISTRY_ADDRESS); // expect to be run on a fork of a testnet with registry deployed
    erc6551Registry = await ethers.getContractAt("IERC6551Registry", ERC6551_REGISTRY_ADDRESS) as IERC6551Registry;

    await expectDeployed(SWAP_ROUTER_ADDRESS);
    await expectDeployed(POSITION_MANAGER_ADDRESS);
    await expectDeployed(WETH_ADDRESS);
    await expectDeployed(USDB_ADDRESS);

    //stakingRewards = await ethers.getContractAt("IFixedStakingRewards", STAKING_REWARDS_ADDRESS) as IFixedStakingRewards;

    weth = await ethers.getContractAt("MockERC20", WETH_ADDRESS) as MockERC20;
    usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS) as MockERC20;
  });

  after(async function () {
    await provider.send("evm_revert", [snapshot]);
  });

  describe("setup", function () {
    it("can deploy gas collector", async function () {
      gasCollector = await deployContract(deployer, "GasCollector", [owner.address, BLAST_ADDRESS]);
      await expectDeployed(gasCollector.address);
      expect(await gasCollector.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy GasCollector", gasCollector.deployTransaction);
    })
    it("can deploy Agents ERC721", async function () {
      // to deployer
      agentNft = await deployContract(deployer, "Agents", [deployer.address, BLAST_ADDRESS, gasCollector.address, ERC6551_REGISTRY_ADDRESS]) as Agents;
      await expectDeployed(agentNft.address);
      expect(await agentNft.owner()).eq(deployer.address);
      l1DataFeeAnalyzer.register("deploy Boomagents", agentNft.deployTransaction);
      // to owner
      agentNft = await deployContract(deployer, "Agents", [owner.address, BLAST_ADDRESS, gasCollector.address, ERC6551_REGISTRY_ADDRESS]) as Agents;
      await expectDeployed(agentNft.address);
      expect(await agentNft.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy Boomagents", agentNft.deployTransaction);
    });
    it("initializes properly", async function () {
      expect(await agentNft.totalSupply()).eq(0);
      expect(await agentNft.balanceOf(user1.address)).eq(0);
      expect(await agentNft.getERC6551Registry()).eq(ERC6551_REGISTRY_ADDRESS);
    });
    it("can deploy account implementations", async function () {
      // BlastAgentAccountThrusterA
      blastAccountImplementation = await deployContract(deployer, "BlastAgentAccountThrusterA", [BLAST_ADDRESS, deployer.address,ENTRY_POINT_ADDRESS,badcode,ERC6551_REGISTRY_ADDRESS,AddressZero]) as BlastAgentAccountThrusterA;
      await expectDeployed(blastAccountImplementation.address);
      l1DataFeeAnalyzer.register("deploy BlastAgentAccountThrusterA impl", blastAccountImplementation.deployTransaction);
    });
    it("can deploy AgentFactory02", async function () {
      // to deployer
      factory = await deployContract(deployer, "AgentFactory02", [deployer.address, BLAST_ADDRESS, gasCollector.address, agentNft.address]) as AgentFactory02;
      await expectDeployed(factory.address);
      expect(await factory.owner()).eq(deployer.address);
      l1DataFeeAnalyzer.register("deploy AgentFactory02", factory.deployTransaction);
      // to owner
      factory = await deployContract(deployer, "AgentFactory02", [owner.address, BLAST_ADDRESS, gasCollector.address, agentNft.address]) as AgentFactory02;
      await expectDeployed(factory.address);
      expect(await factory.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy AgentFactory02", factory.deployTransaction);
    });
    it("owner can whitelist", async function () {
      let whitelist = [
        {
          factory: factory.address,
          shouldWhitelist: true
        }
      ];
      let tx = await agentNft.connect(owner).setWhitelist(whitelist);
      for(let i = 0; i < whitelist.length; i++) {
        let whitelistItem = whitelist[i]
        await expect(tx).to.emit(agentNft, "FactoryWhitelisted").withArgs(whitelistItem.factory, whitelistItem.shouldWhitelist);
        expect(await agentNft.factoryIsWhitelisted(whitelistItem.factory)).eq(whitelistItem.shouldWhitelist);
      }
    });
    it("owner can postAgentCreationSettings", async function () {
      let params = {
        agentImplementation: blastAccountImplementation.address,
        initializationCalls: [],
        isPaused: false,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      let tx = await factory.connect(owner).postAgentCreationSettings(params)
      expect(await factory.getAgentCreationSettingsCount()).eq(1)
      let res = await factory.getAgentCreationSettings(1)
      expect(res.agentImplementation).eq(params.agentImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isPaused).eq(params.isPaused)
      expect(res.giveTokenList).deep.eq(params.giveTokenList)
      expect(res.giveTokenAmounts).deep.eq(params.giveTokenAmounts)
      await expect(tx).to.emit(factory, "AgentCreationSettingsPosted").withArgs(1)
      await expect(tx).to.emit(factory, "AgentCreationSettingsPaused").withArgs(1, params.isPaused)
    })
  });

  describe("agent", function () {
    it("can create agent pt 1", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let agentRes = await factory.connect(user1).callStatic['createAgent(uint256)'](1);
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      //await expect(agentNft.getAgentID(agentRes.agentAddress)).to.be.revertedWithCustomError(agentNft, "AgentDoesNotExist");
      expect(await agentNft.getAgentID(agentRes.agentAddress)).eq(0);
      expect(await agentNft.isAddressAgent(agentRes.agentAddress)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createAgent(uint256)'](1);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, factory.address, agentRes.agentID);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(factory.address, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      expect(await agentNft.getAgentID(agentInfo.agentAddress)).eq(agentID);
      expect(await agentNft.isAddressAgent(agentInfo.agentAddress)).eq(true);
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(blastAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BlastAgentAccountThrusterA", agentInfo.agentAddress) as BlastAgentAccountThrusterA;
      l1DataFeeAnalyzer.register("createAgent", tx);
      expect(await weth.balanceOf(tbaccount2.address)).eq(0)
      expect(await usdb.balanceOf(tbaccount2.address)).eq(0)
    });
    it("non owner cannot initialize", async function () {
      await expect(tbaccount2.connect(user2).initialize(WETH_ADDRESS, USDB_ADDRESS)).to.be.revertedWithCustomError(tbaccount2, "NotAuthorized")
    })
    it("can initialize", async function () {
      expect(await tbaccount2.tokenId()).eq(0);
      let tx = await tbaccount2.connect(user1).initialize(WETH_ADDRESS, USDB_ADDRESS, {value: WeiPerEther})
      expect(await tbaccount2.tokenId()).gt(0);
    })


/*

// weth/blast
0x88316456
0000000000000000000000004200000000000000000000000000000000000023
000000000000000000000000f6d86a117b761ec5e441ed8c3b190dbda745623e
0000000000000000000000000000000000000000000000000000000000000bb8
00000000000000000000000000000000000000000000000000000000000173f4
0000000000000000000000000000000000000000000000000000000000017bb0
000000000000000000000000000000000000000000000000000106137e2079bd
000000000000000000000000000000000000000000000000425d309f15ab0567
0000000000000000000000000000000000000000000000000000ebde57ea072a
0000000000000000000000000000000000000000000000003bba455bf9e6b810
000000000000000000000000166cc65ed6cc997eef3cfb23ff50fc2e0be8770a
0000000000000000000000000000000000000000000000000000000065de3a7c

// weth/usdb
0x88316456
0000000000000000000000004200000000000000000000000000000000000022 token0
0000000000000000000000004200000000000000000000000000000000000023 token1
0000000000000000000000000000000000000000000000000000000000000bb8 fee
fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff2764c tickLower
00000000000000000000000000000000000000000000000000000000000d89b4 tickUpper
0000000000000000000000000000000000000000000000000ddf3e0f35752e76 amount0Desired
000000000000000000000000000000000000000000000000000003964dd0e1ab amount1Desired
0000000000000000000000000000000000000000000000000c7c1e40e34fdd04 amount0Min
0000000000000000000000000000000000000000000000000000033a793bfe4d amount1Max
000000000000000000000000166cc65ed6cc997eef3cfb23ff50fc2e0be8770a recipient
0000000000000000000000000000000000000000000000000000000065ddad17 deadline
0x12210e8a

struct MintParams {
  address token0;
  address token1;
  uint24 fee;
  int24 tickLower;
  int24 tickUpper;
  uint256 amount0Desired;
  uint256 amount1Desired;
  uint256 amount0Min;
  uint256 amount1Min;
  address recipient;
  uint256 deadline;
}

[
  "0", nonce
  "0x0000000000000000000000000000000000000000", operator
  "0x4200000000000000000000000000000000000022", token0
  "0x4200000000000000000000000000000000000023", token1
  3000, fee
  -887220, tickLower
  887220, tickUpper
  "1985162528499486",
  "14920359341220121831930741656296756005755",
  "114744110783971615055795291526800027",
  "0",
  "0"
]
returns (
    uint96 nonce,
    address operator,
    address token0,
    address token1,
    uint24 fee,
    int24 tickLower,
    int24 tickUpper,
    uint128 liquidity,
    uint256 feeGrowthInside0LastX128,
    uint256 feeGrowthInside1LastX128,
    uint128 tokensOwed0,
    uint128 tokensOwed1
)
*/
    /*
    it("non owner cannot deposit", async function () {
      await expect(tbaccount2.connect(user2).depositRingProtocolStrategyD()).to.be.revertedWithCustomError(tbaccount2, "NotAuthorized")
    })
    it("can deposit zero amount", async function () {
      let tx = await tbaccount2.connect(user1).depositRingProtocolStrategyD()
    })
    it("owner can deposit", async function () {
      let balances0 = await getBalances(tbaccount2.address)
      expect(balances0.weth).eq(0)
      expect(balances0.usdb).eq(0)
      expect(balances0.ring).eq(0)
      expect(balances0.lptoken).eq(0)
      expect(balances0.stakingbalance).eq(0)
      expect(balances0.stakingearned).eq(0)
      let ethAmount = WeiPerEther
      let tx = await tbaccount2.connect(user1).depositRingProtocolStrategyD({value:ethAmount})
      let balances1 = await getBalances(tbaccount2.address)
      expect(balances1.weth).gt(0)
      expect(balances1.usdb).eq(0)
      expect(balances1.ring).eq(0)
      expect(balances1.lptoken).eq(0)
      expect(balances1.stakingbalance).gt(0)
      expect(balances1.stakingearned).eq(0)
    })
    it("accumulates rewards", async function () {
      await user3.sendTransaction({to:user3.address})
      let balances2 = await getBalances(tbaccount2.address)
      expect(balances2.weth).gt(0)
      expect(balances2.usdb).eq(0)
      expect(balances2.ring).eq(0)
      expect(balances2.lptoken).eq(0)
      expect(balances2.stakingbalance).gt(0)
      expect(balances2.stakingearned).gt(0)
    })
    it("non owner cannot withdraw", async function () {
      await expect(tbaccount2.connect(user2).withdrawRingProtocolStrategyD()).to.be.revertedWithCustomError(tbaccount2, "NotAuthorized")
    })
    it("owner can withdraw", async function () {
      let balances3 = await getBalances(tbaccount2.address)
      expect(balances3.weth).gt(0)
      expect(balances3.usdb).eq(0)
      expect(balances3.ring).eq(0)
      expect(balances3.lptoken).eq(0)
      expect(balances3.stakingbalance).gt(0)
      expect(balances3.stakingearned).gt(0)
      let tx = await tbaccount2.connect(user1).withdrawRingProtocolStrategyD()
      let balances4 = await getBalances(tbaccount2.address)
      expect(balances4.weth).gt(0)
      expect(balances4.usdb).gt(0)
      expect(balances4.ring).gt(0)
      expect(balances4.lptoken).eq(0)
      expect(balances4.stakingbalance).eq(0)
      expect(balances4.stakingearned).eq(0)
    })
    */
  });

  async function getBalances(account:string) {
    let res = {
      weth: await weth.balanceOf(account),
      usdb: await usdb.balanceOf(account),
      ring: await ring.balanceOf(account),
      lptoken: await lptoken.balanceOf(account),
      stakingbalance: await stakingRewards.balanceOf(STAKING_REWARDS_INDEX, account),
      stakingearned: await stakingRewards.earned(STAKING_REWARDS_INDEX, account),
    }
    console.log({
      weth: formatUnits(res.weth),
      usdb: formatUnits(res.usdb,6),
      ring: formatUnits(res.ring),
      lptoken: formatUnits(res.lptoken),
      stakingbalance: formatUnits(res.stakingbalance),
      stakingearned: formatUnits(res.stakingearned),
    })
    return res
  }

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});
