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

const UNIVERSAL_ROUTER_ADDRESS = "0x334e3F7f5A9740627fA47Fa9Aa51cE0ccbD765cF";
const FEW_ROUTER_ADDRESS       = "0x02F1e7A518e3E286C8E305E39cA7D4f25e0a44Aa";
const STAKING_REWARDS_ADDRESS  = "0x366Ac78214aFE145Ca35d4A6513F4eD9e8909Fe8";
const WETH_ADDRESS             = "0x4200000000000000000000000000000000000023";
const USDC_ADDRESS             = "0xF19A5b56b419170Aa2ee49E5c9195F5902D39BF1";
const FWWETH_ADDRESS           = "0x798dE0520497E28E8eBfF0DF1d791c2E942eA881";
const FWUSDC_ADDRESS           = "0xa7870cf9143084ED04f4C2311f48CB24a2b4A097";
const LP_TOKEN_ADDRESS         = "0x024Dd95113137f04E715B2fC8F637FBe678e9512";
const RING_ADDRESS             = "0x0BD5539E33a1236bA69228271e60f3bFf8fDB7DB";
const STAKING_REWARDS_INDEX    = 2;

/*
address public constant universalRouter = 0x334e3F7f5A9740627fA47Fa9Aa51cE0ccbD765cF;
address public constant fewRouter       = 0x02F1e7A518e3E286C8E305E39cA7D4f25e0a44Aa;
address public constant stakingRewards  = 0x366Ac78214aFE145Ca35d4A6513F4eD9e8909Fe8;

//address public constant weth            = 0x4200000000000000000000000000000000000023;
address public constant usdc            = 0xF19A5b56b419170Aa2ee49E5c9195F5902D39BF1;
//address public constant usdt            = 0xD8F542D710346DF26F28D6502A48F49fB2cFD19B;
//address public constant dai             = 0x9C6Fc5bF860A4a012C9De812002dB304AD04F581;
//address public constant bolt            = 0x1B0cC80F4E2A7d205518A1Bf36de5bED686662FE;
//address public constant rgb             = 0x7647a41596c1Ca0127BaCaa25205b310A0436B4C;

address public constant fwweth          = 0x798dE0520497E28E8eBfF0DF1d791c2E942eA881;
address public constant fwusdc          = 0xa7870cf9143084ED04f4C2311f48CB24a2b4A097;
//address public constant fwusdt          = 0xD8f6A67D198485335DAF4aaDeb74358BC021410d;
//address public constant fwdai           = 0x9DB240312deEFEC82687405a4CF42511032d55d8;
//address public constant fwbolt          = 0x0eF98E6F5268747B52f2B139de23981b776B314A;
//address public constant fwrgb           = 0x9BF7537cE9F808c845d5Cfe1e94c856A74Fa56d7;

address public constant lptoken         = 0x024Dd95113137f04E715B2fC8F637FBe678e9512;
*/

const MAGIC_VALUE_0 = "0x00000000";
const MAGIC_VALUE_IS_VALID_SIGNER = "0x523e3260";
const MAGIC_VALUE_IS_VALID_SIGNATURE = "0x1626ba7e";

describe("BlastAgentAccountRingProtocolD", function () {
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
  let usdc: MockERC20;
  let ring: MockERC20;
  let lptoken: MockERC20;

  let mockERC1271: MockERC1271;

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

    await expectDeployed(UNIVERSAL_ROUTER_ADDRESS);
    await expectDeployed(FEW_ROUTER_ADDRESS);
    await expectDeployed(STAKING_REWARDS_ADDRESS);
    await expectDeployed(USDC_ADDRESS);
    await expectDeployed(FWWETH_ADDRESS);
    await expectDeployed(FWUSDC_ADDRESS);
    await expectDeployed(LP_TOKEN_ADDRESS);
    await expectDeployed(RING_ADDRESS);

    stakingRewards = await ethers.getContractAt("IFixedStakingRewards", STAKING_REWARDS_ADDRESS) as IFixedStakingRewards;

    weth = await ethers.getContractAt("MockERC20", WETH_ADDRESS) as MockERC20;
    usdc = await ethers.getContractAt("MockERC20", USDC_ADDRESS) as MockERC20;
    ring = await ethers.getContractAt("MockERC20", RING_ADDRESS) as MockERC20;
    lptoken = await ethers.getContractAt("MockERC20", LP_TOKEN_ADDRESS) as MockERC20;
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
      // BlastAgentAccountRingProtocolD
      blastAccountImplementation = await deployContract(deployer, "BlastAgentAccountRingProtocolD", [BLAST_ADDRESS, deployer.address,ENTRY_POINT_ADDRESS,badcode,ERC6551_REGISTRY_ADDRESS,AddressZero]) as BlastAgentAccountRingProtocolD;
      await expectDeployed(blastAccountImplementation.address);
      l1DataFeeAnalyzer.register("deploy BlastAgentAccountRingProtocolD impl", blastAccountImplementation.deployTransaction);
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
    it("can deploy MockERC1271", async function () {
      mockERC1271 = await deployContract(deployer, "MockERC1271", []) as MockERC1271;
      await expectDeployed(mockERC1271.address);
      l1DataFeeAnalyzer.register("deploy MockERC1271", mockERC1271.deployTransaction);
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
      tbaccount2 = await ethers.getContractAt("BlastAgentAccountRingProtocolD", agentInfo.agentAddress) as BlastAgentAccountRingProtocolD;
      l1DataFeeAnalyzer.register("createAgent", tx);
      expect(await weth.balanceOf(tbaccount2.address)).eq(0)
      expect(await usdc.balanceOf(tbaccount2.address)).eq(0)
      expect(await ring.balanceOf(tbaccount2.address)).eq(0)
    });
    it("non owner cannot initialize", async function () {
      await expect(tbaccount2.connect(user2).initialize(WETH_ADDRESS, USDC_ADDRESS, FWWETH_ADDRESS, FWUSDC_ADDRESS, LP_TOKEN_ADDRESS, STAKING_REWARDS_INDEX)).to.be.revertedWithCustomError(tbaccount2, "NotAuthorized")
    })
    it("can initialize", async function () {
      let tx = await tbaccount2.connect(user1).initialize(WETH_ADDRESS, USDC_ADDRESS, FWWETH_ADDRESS, FWUSDC_ADDRESS, LP_TOKEN_ADDRESS, STAKING_REWARDS_INDEX)
    })
    it("non owner cannot deposit", async function () {
      await expect(tbaccount2.connect(user2).depositRingProtocolStrategyD()).to.be.revertedWithCustomError(tbaccount2, "NotAuthorized")
    })
    it("can deposit zero amount", async function () {
      let tx = await tbaccount2.connect(user1).depositRingProtocolStrategyD()
    })
    it("owner can deposit", async function () {
      let balances0 = await getBalances(tbaccount2.address)
      expect(balances0.weth).eq(0)
      expect(balances0.usdc).eq(0)
      expect(balances0.ring).eq(0)
      expect(balances0.lptoken).eq(0)
      expect(balances0.stakingbalance).eq(0)
      expect(balances0.stakingearned).eq(0)
      let ethAmount = WeiPerEther
      let tx = await tbaccount2.connect(user1).depositRingProtocolStrategyD({value:ethAmount})
      let balances1 = await getBalances(tbaccount2.address)
      expect(balances1.weth).gt(0)
      expect(balances1.usdc).eq(0)
      expect(balances1.ring).eq(0)
      expect(balances1.lptoken).eq(0)
      expect(balances1.stakingbalance).gt(0)
      expect(balances1.stakingearned).eq(0)
    })
    it("accumulates rewards", async function () {
      await user3.sendTransaction({to:user3.address})
      let balances2 = await getBalances(tbaccount2.address)
      expect(balances2.weth).gt(0)
      expect(balances2.usdc).eq(0)
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
      expect(balances3.usdc).eq(0)
      expect(balances3.ring).eq(0)
      expect(balances3.lptoken).eq(0)
      expect(balances3.stakingbalance).gt(0)
      expect(balances3.stakingearned).gt(0)
      let tx = await tbaccount2.connect(user1).withdrawRingProtocolStrategyD()
      let balances4 = await getBalances(tbaccount2.address)
      expect(balances4.weth).gt(0)
      expect(balances4.usdc).gt(0)
      expect(balances4.ring).gt(0)
      expect(balances4.lptoken).eq(0)
      expect(balances4.stakingbalance).eq(0)
      expect(balances4.stakingearned).eq(0)
    })
  });

  async function getBalances(account:string) {
    let res = {
      weth: await weth.balanceOf(account),
      usdc: await usdc.balanceOf(account),
      ring: await ring.balanceOf(account),
      lptoken: await lptoken.balanceOf(account),
      stakingbalance: await stakingRewards.balanceOf(STAKING_REWARDS_INDEX, account),
      stakingearned: await stakingRewards.earned(STAKING_REWARDS_INDEX, account),
    }
    console.log({
      weth: formatUnits(res.weth),
      usdc: formatUnits(res.usdc,6),
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
