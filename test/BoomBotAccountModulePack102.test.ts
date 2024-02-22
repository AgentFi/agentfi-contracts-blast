
/* global describe it before ethers */
import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;
import fs from "fs";

import { Agents, ERC20HolderModule, ERC721HolderModule, FallbackModule, RevertModule, Test1Module, Test2Module, Test3Module, ModulePack101, ModulePack102, AgentFactory01, MockERC20, MockERC721, MockERC1155, RevertAccount, IBlast, GasCollector, BalanceFetcher, MockBlast } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { toBytes32 } from "./../scripts/utils/setStorage";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { leftPad } from "../scripts/utils/strings";
import { deployContract } from "../scripts/utils/deployContract";
import L1DataFeeAnalyzer from "../scripts/utils/L1DataFeeAnalyzer";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../scripts/utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const WeiPerUsdc = BN.from(1_000_000); // 6 decimals
const AddressOne = "0x0000000000000000000000000000000000000001"
const AddressTwo = "0x0000000000000000000000000000000000000002"

const ERC6551_REGISTRY_ADDRESS = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS            = "0x4300000000000000000000000000000000000002";

const MAGIC_VALUE_0 = "0x00000000";
const MAGIC_VALUE_IS_VALID_SIGNER = "0x523e3260";

const multicallSighash                 = "0xac9650d8";
const diamondCutSighash                = "0x1f931c1c";
const updateSupportedInterfacesSighash = "0xf71a8a0f";
const dummy1Sighash                    = "0x11111111";
const dummy2Sighash                    = "0x22222222";
const dummy3Sighash                    = "0x33333333";
const dummy4Sighash                    = "0x44444444";
const testFunc1Sighash                 = "0x561f5f89";
const testFunc2Sighash                 = "0x08752360";
const testFunc3Sighash                 = "0x9a5fb5a8";
const inscribeSighash                  = "0xde52f07d";

describe("BoomBotDiamondAccountModulePack102", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  let gasCollector: GasCollector;
  let balanceFetcher: BalanceFetcher;
  let agentNft: Agents;
  let boomAgentAccountImplementation: BoomBotDiamondAccount; // the base implementation for agentfi accounts
  let dataStore: DataStore;
  let tbaccount1: BoomBotDiamondAccount; // an account bound to a token
  let tbaccount2: BoomBotDiamondAccount; // an account bound to a token
  let bbaccount1: any; // an account bound to a token
  let accountProxy: any;
  // modules
  let modulePack100: ModulePack100;
  let modulePack101: ModulePack101;
  let modulePack102: ModulePack102;
  let erc2535Module: ERC2535Module;
  let erc6551AccountModule: ERC6551AccountModule;
  let multicallModule: MulticallModule;
  let erc20HolderModule: ERC20HolderModule;
  let erc721HolderModule: ERC721HolderModule;
  let fallbackModule: FallbackModule;
  let revertModule: RevertModule;
  let test1Module: Test1Module;
  let test2Module: Test2Module;
  let test3Module: Test3Module;
  let revertAccount: RevertAccount;
  // diamond cuts
  let diamondCutInit: any[] = [];
  let agentInitializationCode1: any;
  let agentInitializationCode2: any;
  // factory
  let factory: AgentFactory01;
  let iblast: any;
  let mockblast: MockBlast;

  let erc20a: MockERC20;
  let erc20b: MockERC20;
  let erc20c: MockERC20;
  let erc721Asset: MockERC721; // an erc721 that token bound accounts may hold
  let erc1155: MockERC1155;

  //let token1: MockERC20;
  //let token2: MockERC20;
  //let token3: MockERC20;
  //let tokens:any[] = [];
  //let nonstandardToken1: MockERC20NoReturnsSuccess;
  //let nonstandardToken2: MockERC20NoReturnsRevert;
  //let nonstandardToken3: MockERC20NoReturnsRevertWithError;
  //let nonstandardToken4: MockERC20SuccessFalse;

  let chainID: number;
  let networkSettings: any;
  let snapshot: BN;

  let abi = getCombinedAbi([
    "artifacts/contracts/accounts/BoomBotDiamondAccount.sol/BoomBotDiamondAccount.json",
    "artifacts/contracts/modules/ModulePack102.sol/ModulePack102.json",
    "artifacts/contracts/mocks/modules/FallbackModule.sol/FallbackModule.json",
    "artifacts/contracts/mocks/modules/RevertModule.sol/RevertModule.json",
    "artifacts/contracts/mocks/modules/Test1Module.sol/Test1Module.json",
    "artifacts/contracts/mocks/modules/Test2Module.sol/Test2Module.json",
    "artifacts/contracts/mocks/modules/Test3Module.sol/Test3Module.json",
    "artifacts/contracts/libraries/Calls.sol/Calls.json",
    "artifacts/contracts/libraries/Errors.sol/Errors.json",
    "artifacts/contracts/libraries/modules/ERC2535Library.sol/ERC2535Library.json",
    "artifacts/contracts/libraries/modules/ERC165Library.sol/ERC165Library.json",
  ])

  let l1DataFeeAnalyzer = new L1DataFeeAnalyzer();

  before(async function () {
    [deployer, owner, user1, user2, user3, user4, user5] = await ethers.getSigners();
    chainID = (await provider.getNetwork()).chainId;
    networkSettings = getNetworkSettings(chainID);
    if(!networkSettings.isTestnet) throw new Error("Do not run tests on production networks");
    snapshot = await provider.send("evm_snapshot", []);
    await deployer.sendTransaction({to:deployer.address}); // for some reason this helps solidity-coverage

    //while(tokens.length < 21) {
      //let token = await deployContract(deployer, "MockERC20", [`Token${tokens.length+1}`, `TKN${tokens.length+1}`, 18]) as MockERC20;
      //tokens.push(token);
    //}
    //[token1, token2, token3] = tokens;
    erc20a = await deployContract(deployer, "MockERC20", [`Token A`, `TKNA`, 18]) as MockERC20;
    erc20b = await deployContract(deployer, "MockERC20", [`Token B`, `TKNB`, 18]) as MockERC20;
    erc20c = await deployContract(deployer, "MockERC20", [`Token C`, `TKNC`, 18]) as MockERC20;

    //nonstandardToken1 = await deployContract(deployer, "MockERC20NoReturnsSuccess", [`NonstandardToken1`, `NSTKN1`, 18]) as MockERC20NoReturnsSuccess;
    //nonstandardToken2 = await deployContract(deployer, "MockERC20NoReturnsRevert", [`NonstandardToken2`, `NSTKN2`, 18]) as MockERC20NoReturnsRevert;
    //nonstandardToken3 = await deployContract(deployer, "MockERC20NoReturnsRevertWithError", [`NonstandardToken3`, `NSTKN3`, 18]) as MockERC20NoReturnsRevertWithError;
    //nonstandardToken4 = await deployContract(deployer, "MockERC20SuccessFalse", [`NonstandardToken4`, `NSTKN4`, 18]) as MockERC20SuccessFalse;

    await expectDeployed(ERC6551_REGISTRY_ADDRESS); // expect to be run on a fork of a testnet with registry deployed

    iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, owner) as IBlast;
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
      //boomAgentAccountImplementation = await deployContract(deployer, "BoomBotDiamondAccount", []) as BoomBotDiamondAccount;
      boomAgentAccountImplementation = await deployContract(deployer, "BoomBotDiamondAccount", [BLAST_ADDRESS, owner.address]) as BoomBotDiamondAccount;
      await expectDeployed(boomAgentAccountImplementation.address);
      l1DataFeeAnalyzer.register("deploy BoomBotDiamondAccount impl", agentNft.deployTransaction);
    });
    it("can deploy data store", async function () {
      // to deployer
      dataStore = await deployContract(deployer, "DataStore", [deployer.address, BLAST_ADDRESS, gasCollector.address]);
      await expectDeployed(dataStore.address);
      expect(await dataStore.owner()).eq(deployer.address);
      l1DataFeeAnalyzer.register("deploy DataStore", dataStore.deployTransaction);
      // to owner
      dataStore = await deployContract(deployer, "DataStore", [owner.address, BLAST_ADDRESS, gasCollector.address]);
      await expectDeployed(dataStore.address);
      expect(await dataStore.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy DataStore", dataStore.deployTransaction);
    })
    it("can deploy modules", async function () {
      // ModulePack100
      modulePack100 = await deployContract(deployer, "ModulePack100", []) as ERC2535Module;
      await expectDeployed(modulePack100.address);
      l1DataFeeAnalyzer.register("deploy ModulePack100 impl", modulePack100.deployTransaction);
      // ModulePack101
      modulePack101 = await deployContract(deployer, "ModulePack101", [BLAST_ADDRESS, owner.address]) as ModulePack101;
      await expectDeployed(modulePack101.address);
      l1DataFeeAnalyzer.register("deploy ModulePack101 impl", modulePack101.deployTransaction);
      // ModulePack102
      modulePack102 = await deployContract(deployer, "ModulePack102", [BLAST_ADDRESS, owner.address]) as ModulePack102;
      await expectDeployed(modulePack102.address);
      l1DataFeeAnalyzer.register("deploy ModulePack102 impl", modulePack102.deployTransaction);
      /*
      // ERC2535Module
      erc2535Module = await deployContract(deployer, "ERC2535Module", []) as ERC2535Module;
      await expectDeployed(erc2535Module.address);
      l1DataFeeAnalyzer.register("deploy ERC2535Module impl", erc2535Module.deployTransaction);
      // ERC6551AccountModule
      erc6551AccountModule = await deployContract(deployer, "ERC6551AccountModule", []) as ERC6551AccountModule;
      await expectDeployed(erc6551AccountModule.address);
      l1DataFeeAnalyzer.register("deploy ERC6551AccountModule impl", erc6551AccountModule.deployTransaction);
      // MulticallModule
      multicallModule = await deployContract(deployer, "MulticallModule", []) as MulticallModule;
      await expectDeployed(multicallModule.address);
      l1DataFeeAnalyzer.register("deploy MulticallModule impl", multicallModule.deployTransaction);
      // ERC20HolderModule
      erc20HolderModule = await deployContract(deployer, "ERC20HolderModule", []) as ERC20HolderModule;
      await expectDeployed(erc20HolderModule.address);
      l1DataFeeAnalyzer.register("deploy ERC20HolderModule impl", erc20HolderModule.deployTransaction);
      // ERC721HolderModule
      erc721HolderModule = await deployContract(deployer, "ERC721HolderModule", []) as ERC721HolderModule;
      await expectDeployed(erc721HolderModule.address);
      l1DataFeeAnalyzer.register("deploy ERC721HolderModule impl", erc721HolderModule.deployTransaction);
      */
      // FallbackModule
      fallbackModule = await deployContract(deployer, "FallbackModule", []) as FallbackModule;
      await expectDeployed(fallbackModule.address);
      l1DataFeeAnalyzer.register("deploy FallbackModule impl", fallbackModule.deployTransaction);
      // RevertModule
      revertModule = await deployContract(deployer, "RevertModule", []) as RevertModule;
      await expectDeployed(revertModule.address);
      l1DataFeeAnalyzer.register("deploy RevertModule impl", revertModule.deployTransaction);
      // Test1Module
      test1Module = await deployContract(deployer, "Test1Module", []) as Test1Module;
      await expectDeployed(test1Module.address);
      l1DataFeeAnalyzer.register("deploy Test1Module impl", test1Module.deployTransaction);
      // Test2Module
      test2Module = await deployContract(deployer, "Test2Module", []) as Test2Module;
      await expectDeployed(test2Module.address);
      l1DataFeeAnalyzer.register("deploy Test2Module impl", test2Module.deployTransaction);
      // Test3Module
      test3Module = await deployContract(deployer, "Test3Module", []) as Test3Module;
      await expectDeployed(test3Module.address);
      l1DataFeeAnalyzer.register("deploy Test3Module impl", test3Module.deployTransaction);
    });
    it("can deploy AgentFactory01", async function () {
      // to deployer
      factory = await deployContract(deployer, "AgentFactory01", [deployer.address, BLAST_ADDRESS, gasCollector.address, agentNft.address]) as AgentFactory01;
      await expectDeployed(factory.address);
      expect(await factory.owner()).eq(deployer.address);
      l1DataFeeAnalyzer.register("deploy AgentFactory01", factory.deployTransaction);
      // to owner
      factory = await deployContract(deployer, "AgentFactory01", [owner.address, BLAST_ADDRESS, gasCollector.address, agentNft.address]) as AgentFactory01;
      await expectDeployed(factory.address);
      expect(await factory.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy AgentFactory01", factory.deployTransaction);
    });
    it("can deploy BalanceFetcher", async function () {
      balanceFetcher = await deployContract(deployer, "BalanceFetcher", [owner.address, BLAST_ADDRESS, gasCollector.address]) as BalanceFetcher;
      await expectDeployed(balanceFetcher.address);
      l1DataFeeAnalyzer.register("deploy BalanceFetcher", balanceFetcher.deployTransaction);
    });
  });

  describe("agent creation via factory", function () {
    it("can get factory sighashes", async function () {
      let sighashes = calcSighashes(factory, 'AgentFactory01')
    })
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
      //let sighashes = calcSighashes(modulePack100, 'ModulePack100', true)
      //sighashes.push(inscribeSighash)
      //let sighashes = calcSighashes(modulePack101, 'ModulePack101', true)
      let sighashes0 = calcSighashes(modulePack102, 'ModulePack102', true)
      let sighashes = [
        '0x660d0d67', // dataStore()
        '0x1f931c1c', // diamondCut((address,uint8,bytes4[])[],address,bytes)
        '0x51945447', // execute(address,uint256,bytes,uint8)
        '0xcdffacc6', // facetAddress(bytes4)
        '0x52ef6b2c', // facetAddresses()
        '0xadfca15e', // facetFunctionSelectors(address)
        '0x7a0ed627', // facets()
        '0x1626ba7e', // isValidSignature(bytes32,bytes)
        '0x523e3260', // isValidSigner(address,bytes)
        '0xd5f50582', // isValidSigner(address)
        '0xac9650d8', // multicall(bytes[])
        '0xbc197c81', // onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)
        '0xf23a6e61', // onERC1155Received(address,address,uint256,uint256,bytes)
        '0x150b7a02', // onERC721Received(address,address,uint256,bytes)
        '0x8da5cb5b', // owner()
        '0xa2d2dd3c', // reentrancyGuardState()
        '0xc19d93fb', // state()
        '0x01ffc9a7', // supportsInterface(bytes4)
        '0xfc0c546a', // token()
        '0xf71a8a0f', // updateSupportedInterfaces(bytes4[],bool[])
        '0xde52f07d', // inscribe()
      ]
      let diamondCut = [
        {
          facetAddress: modulePack102.address,
          action: FacetCutAction.Add,
          functionSelectors: sighashes,
        },
      ]
      diamondCutInit = diamondCut
      let interfaceIDs = [
        "0x01ffc9a7", // ERC165
        "0x1f931c1c", // DiamondCut
        "0x48e2b093", // DiamondLoupe
        "0x6faff5f1", // ERC6551Account
        "0x51945447", // ERC6551Executable
      ]
      let support = interfaceIDs.map(id=>true)
      agentInitializationCode1 = boomAgentAccountImplementation.interface.encodeFunctionData("initialize", [diamondCut, dataStore.address]);
      agentInitializationCode2 = modulePack102.interface.encodeFunctionData("updateSupportedInterfaces", [interfaceIDs, support]);
      let params = {
        agentImplementation: boomAgentAccountImplementation.address,
        initializationCalls: [
          agentInitializationCode1,
          agentInitializationCode2,
        ],
        isPaused: false
      }
      let tx = await factory.connect(owner).postAgentCreationSettings(params)
      expect(await factory.getAgentCreationSettingsCount()).eq(1)
      let res = await factory.getAgentCreationSettings(1)
      expect(res.agentImplementation).eq(params.agentImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isPaused).eq(params.isPaused)
      await expect(tx).to.emit(factory, "AgentCreationSettingsPosted").withArgs(1)
      await expect(tx).to.emit(factory, "AgentCreationSettingsPaused").withArgs(1, params.isPaused)
    })
    it("owner can whitelist modules", async function () {
      let modules = [
        {
          module: modulePack102.address,
          shouldWhitelist: true,
        },
        {
          module: revertModule.address,
          shouldWhitelist: true,
        },
      ]
      let tx = await dataStore.connect(owner).setModuleWhitelist(modules)
      for(let m of modules) {
        expect(await dataStore.moduleIsWhitelisted(m.module)).to.eq(m.shouldWhitelist)
        expect(await dataStore.moduleCanBeInstalled(m.module)).to.eq(m.shouldWhitelist)
        await expect(tx).to.emit(dataStore, "ModuleWhitelisted").withArgs(m.module, m.shouldWhitelist)
      }
    });
    it("can create agent pt 1", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let agentRes = await factory.connect(user1).callStatic['createAgent(uint256)'](1, {gasLimit: 10_000_000});
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createAgent(uint256)'](1, {gasLimit: 10_000_000});
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, factory.address, agentRes.agentID);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(factory.address, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(boomAgentAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BoomBotDiamondAccount", agentInfo.agentAddress) as BoomBotDiamondAccount;
      l1DataFeeAnalyzer.register("createAgent", tx);
    });
    it("can get agent 1 code", async function () {
      let agentcode = await provider.getCode(tbaccount2.address)
      //console.log(agentcode)
    })
    it("cannot create agent with bad init code pt 1", async function () {
      // revert with reason
      let agentInitializationCode32 = revertModule.interface.encodeFunctionData("revertWithReason", [])
      let agentInitializationCode31 = modulePack102.interface.encodeFunctionData("diamondCut", [[{
        facetAddress: revertModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [agentInitializationCode32]
      }], AddressZero, "0x"])
      let txdatas3 = [agentInitializationCode31, agentInitializationCode32]
      let agentInitializationCode33 = modulePack102.interface.encodeFunctionData("multicall", [txdatas3])
      let params = {
        agentImplementation: boomAgentAccountImplementation.address,
        initializationCalls: [agentInitializationCode1, agentInitializationCode33],
        isPaused: false
      }
      let tx = await factory.connect(owner).postAgentCreationSettings(params)
      expect(await factory.getAgentCreationSettingsCount()).eq(2)
      await expect(factory.connect(user1)['createAgent(uint256)'](2)).to.be.revertedWithCustomError;//(newAccount, "RevertWithReason")
    })
    it("cannot create agent with bad init code pt 2", async function () {
      // revert without reason
      let agentInitializationCode42 = revertModule.interface.encodeFunctionData("revertWithoutReason", [])
      let agentInitializationCode41 = modulePack102.interface.encodeFunctionData("diamondCut", [[{
        facetAddress: revertModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [agentInitializationCode42]
      }], AddressZero, "0x"])
      let txdatas4 = [agentInitializationCode41, agentInitializationCode42]
      let agentInitializationCode43 = modulePack102.interface.encodeFunctionData("multicall", [txdatas4])
      let params = {
        agentImplementation: boomAgentAccountImplementation.address,
        initializationCalls: [agentInitializationCode1, agentInitializationCode43],
        isPaused: false
      }
      let tx = await factory.connect(owner).postAgentCreationSettings(params)
      expect(await factory.getAgentCreationSettingsCount()).eq(3)
      await expect(factory.connect(user1)['createAgent(uint256)'](3)).to.be.revertedWithCustomError;//(factory, "CallFailed");
    })
    it("cannot create agent with bad init code pt 3", async function () {
      await expect(user1.sendTransaction({
        to: revertModule.address,
        data: "0x"
      })).to.be.reverted;
      await expect(user1.sendTransaction({
        to: revertModule.address,
        data: "0xabcd"
      })).to.be.reverted;
    })
    it("cannot create agent with bad init code pt 4", async function () {
      revertAccount = await deployContract(deployer, "RevertAccount", []) as RevertAccount;
      await expect(user1.sendTransaction({
        to: revertAccount.address,
        data: "0x"
      })).to.be.reverted;
      await expect(user1.sendTransaction({
        to: revertAccount.address,
        data: "0xabcd"
      })).to.be.reverted;
    })
  });

  describe("agent initial state", function () {
    let agentID = 1;
    let agentOwner: any;
    let agentInfo: any;

    it("can get basic info", async function () {
      // get info
      expect(await agentNft.exists(agentID)).eq(true);
      agentInfo = await agentNft.getAgentInfo(agentID);
      tbaccount1 = await ethers.getContractAt("BoomBotDiamondAccount", agentInfo.agentAddress) as BoomBotDiamondAccount;
      bbaccount1 = await ethers.getContractAt(abi, agentInfo.agentAddress);
      calcSighashes(bbaccount1, 'BoomBotDiamondAccount', true)
      console.log(bbaccount1)
      agentOwner = user1;
      //console.log(agentInfo)
      //console.log(agentInfo.agentAddress)
      await expectDeployed(agentInfo.agentAddress)
      //console.log(await provider.getCode(agentInfo.agentAddress))
      //console.log(agentInfo.implementationAddress)
      await expectDeployed(agentInfo.implementationAddress)
      //console.log(await provider.getCode(agentInfo.implementationAddress))
    });
    it("account begins with correct state", async function () {
      // get owner
      expect(await bbaccount1.owner()).eq(agentOwner.address);
      // get token
      let tokenRes = await bbaccount1.token();
      expect(tokenRes.chainId).eq(chainID);
      expect(tokenRes.tokenContract).eq(agentNft.address);
      expect(tokenRes.tokenId).eq(agentID);
      // other info
      expect(await bbaccount1.state()).eq(0);
      expect(await bbaccount1['isValidSigner(address,bytes)'](agentOwner.address, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
      expect(await bbaccount1['isValidSigner(address,bytes)'](agentOwner.address, "0x00abcd")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
      expect(await bbaccount1['isValidSigner(address,bytes)'](deployer.address, "0x")).eq(MAGIC_VALUE_0);
      expect(await bbaccount1['isValidSigner(address,bytes)'](AddressZero, "0x")).eq(MAGIC_VALUE_0);
      expect(await bbaccount1.isValidSignature(toBytes32(0), "0x")).eq(MAGIC_VALUE_0);
      expect(await bbaccount1.supportsInterface("0x01ffc9a7")).eq(true); // ERC165
      expect(await bbaccount1.supportsInterface("0x1f931c1c")).eq(true); // DiamondCut
      expect(await bbaccount1.supportsInterface("0x48e2b093")).eq(true); // DiamondLoupe
      expect(await bbaccount1.supportsInterface("0x6faff5f1")).eq(true); // ERC6551Account
      expect(await bbaccount1.supportsInterface("0x51945447")).eq(true); // ERC6551Executable
      expect(await bbaccount1.supportsInterface("0xffffffff")).eq(false);
      expect(await bbaccount1.supportsInterface("0x00000000")).eq(false);
    });
    it("has the correct modules", async function () {
      let diamondAccount = await ethers.getContractAt("ModulePack102", bbaccount1.address) as ModulePack102;
      /*
      // facets()
      let facets = await diamondAccount.facets();
      console.log(facets)
      expect(facets.length).eq(3);
      expect(facets[0].facetAddress).eq(erc2535Module.address);
      expect(facets[1].facetAddress).eq(diamondLoupeModule.address);
      expect(facets[2].facetAddress).eq(erc6551AccountModule.address);
      // facetAddresses()
      facets = await diamondAccount.facetAddresses();
      console.log(facets)
      expect(facets.length).eq(3);
      expect(facets[0]).eq(diamondCutModule.address);
      expect(facets[1]).eq(diamondLoupeModule.address);
      expect(facets[2]).eq(erc6551AccountModule.address);
      */
      // facets(), facetAddresses()
      let facets = await diamondAccount.facets();
      let facetAddresses = await diamondAccount.facetAddresses();
      let sighashes = calcSighashes(boomAgentAccountImplementation, 'BoomBotDiamondAccount')
      diamondCutInit = [
        {
          facetAddress: diamondAccount.address,
          action: FacetCutAction.Add,
          functionSelectors: sighashes,
        },
        ...diamondCutInit
      ]
      //console.log(facets)
      //console.log(facetAddresses)
      //console.log(`diamondCutInit`)
      //console.log(diamondCutInit)
      //console.log(`facets`)
      //console.log(facets)
      //console.log('')
      expect(facets.length).eq(diamondCutInit.length);
      for(let i = 0; i < diamondCutInit.length; i++) {
        expect(facets[i].facetAddress).eq(diamondCutInit[i].facetAddress);
        expect(facetAddresses[i]).eq(diamondCutInit[i].facetAddress);
        assert.sameMembers(facets[i].functionSelectors, diamondCutInit[i].functionSelectors);
        // facetFunctionSelectors()
        let selectors = await diamondAccount.facetFunctionSelectors(facetAddresses[i]);
        assert.sameMembers(selectors, diamondCutInit[i].functionSelectors);
        // facetAddress()
        for(let j = 0; j < diamondCutInit[i].functionSelectors.length; j++) {
          let selector = diamondCutInit[i].functionSelectors[j];
          let facetAddress = await diamondAccount.facetAddress(selector);
          expect(facetAddress).eq(diamondCutInit[i].facetAddress);
        }
      }
    });
    it("cannot initialize address zero datastore", async function () {
      // proxies are initialized by the factory. the implementation was not initialized
      await expect(boomAgentAccountImplementation.connect(user3).initialize([], AddressZero)).to.be.revertedWithCustomError(boomAgentAccountImplementation, "AddressZero");
    });
    it("can be initialized once", async function () {
      // proxies are initialized by the factory. the implementation was not initialized
      await boomAgentAccountImplementation.connect(user3).initialize([], dataStore.address);
    });
    it("cannot be initialized twice", async function () {
      await expect(tbaccount1.connect(user1).initialize([], dataStore.address)).to.be.revertedWithCustomError(tbaccount1, "AlreadyInitialized");
      await expect(boomAgentAccountImplementation.connect(user1).initialize([], dataStore.address)).to.be.revertedWithCustomError(boomAgentAccountImplementation, "AlreadyInitialized");
    });
  });

  describe("account ownership", function () {
    let agentID = 1;
    let agentOwner: any;
    let agentInfo: any;

    before("get basic info", async function () {
      // get info
      agentInfo = await agentNft.getAgentInfo(agentID);
      agentOwner = user1;
    });
    it("is nft owner", async function () {
      expect(await agentNft.ownerOf(agentID)).eq(user1.address);
      expect(await bbaccount1.owner()).eq(user1.address);
    });
    it("owner can execute", async function () {
      let state1 = await bbaccount1.state();
      await bbaccount1.connect(user1).execute(user3.address, 0, "0x", 0);
      let state2 = await bbaccount1.state();
      expect(state2.sub(state1)).eq(1);
    });
    it("is tied to nft owner", async function () {
      expect(await agentNft.ownerOf(agentID)).eq(user1.address);
      expect(await bbaccount1.owner()).eq(user1.address);
      await agentNft.connect(user1).transferFrom(user1.address, user2.address, agentID);
      expect(await agentNft.ownerOf(agentID)).eq(user2.address);
      expect(await bbaccount1.owner()).eq(user2.address);
    });
    it("old owner cannot execute", async function () {
      await expect(bbaccount1.connect(user1).execute(user1.address, 0, "0x", 0)).to.be.revertedWithCustomError(bbaccount1, "ERC6551InvalidSigner");
    });
    it("new owner can execute", async function () {
      let state1 = await bbaccount1.state();
      await bbaccount1.connect(user2).execute(user3.address, 0, "0x", 0);
      let state2 = await bbaccount1.state();
      expect(state2.sub(state1)).eq(1);
    });
    it("is tied to nft owner pt 2", async function () {
      expect(await agentNft.ownerOf(agentID)).eq(user2.address);
      expect(await bbaccount1.owner()).eq(user2.address);
      await agentNft.connect(user2).transferFrom(user2.address, user1.address, agentID);
      expect(await agentNft.ownerOf(agentID)).eq(user1.address);
      expect(await bbaccount1.owner()).eq(user1.address);
    });
  });

  describe("account receiving", function () {
    it("can receive ETH", async function () {
      let bal1 = await provider.getBalance(tbaccount1.address);
      expect(bal1).eq(0);
      await user1.sendTransaction({
        to: tbaccount1.address,
        value: 0,
        data: "0x"
      });
      let bal2 = await provider.getBalance(tbaccount1.address);
      expect(bal2).eq(0);
      let transferAmount = WeiPerEther.mul(10);
      await user1.sendTransaction({
        to: tbaccount1.address,
        value: transferAmount,
        data: "0x"
      });
      let bal3 = await provider.getBalance(tbaccount1.address);
      expect(bal3).eq(transferAmount);
    });
    it("can receive ERC20", async function () {
      let bal1 = await erc20a.balanceOf(tbaccount1.address);
      expect(bal1).eq(0);
      await erc20a.mint(user1.address, WeiPerEther.mul(1000));
      let transferAmount = WeiPerEther.mul(800);
      await erc20a.connect(user1).transfer(tbaccount1.address, transferAmount);
      let bal2 = await erc20a.balanceOf(tbaccount1.address);
      expect(bal2).eq(transferAmount);
    });
    it("can receive ERC721", async function () {
      // mint
      erc721Asset = await deployContract(deployer, "MockERC721", ["AssetERC721", "ASS"]) as MockERC721;
      await erc721Asset.mint(user1.address, 1);
      await erc721Asset.mint(user1.address, 2);
      expect(await erc721Asset.balanceOf(tbaccount1.address)).eq(0);
      expect(await erc721Asset.ownerOf(1)).eq(user1.address);
      expect(await erc721Asset.ownerOf(2)).eq(user1.address);
      // transferFrom()
      await erc721Asset.connect(user1).transferFrom(user1.address, tbaccount1.address, 1);
      expect(await erc721Asset.balanceOf(tbaccount1.address)).eq(1);
      expect(await erc721Asset.ownerOf(1)).eq(tbaccount1.address);
      // safeTransferFrom()
      await erc721Asset.connect(user1)['safeTransferFrom(address,address,uint256)'](user1.address, tbaccount1.address, 2);
      expect(await erc721Asset.balanceOf(tbaccount1.address)).eq(2);
      expect(await erc721Asset.ownerOf(2)).eq(tbaccount1.address);
    });
    it("can receive ERC1155", async function () {
      // mint
      erc1155 = await deployContract(deployer, "MockERC1155", ["uri here"]) as MockERC1155;
      expect(await erc1155.balanceOf(tbaccount1.address, 1)).eq(0);
      expect(await erc1155.balanceOf(user1.address, 1)).eq(0);
      expect(await erc1155.balanceOf(tbaccount1.address, 2)).eq(0);
      expect(await erc1155.balanceOf(user1.address, 2)).eq(0);
      await erc1155.mint(user1.address, 1, 7, "0x");
      await erc1155.mint(user1.address, 2, 5, "0x");
      expect(await erc1155.balanceOf(tbaccount1.address, 1)).eq(0);
      expect(await erc1155.balanceOf(user1.address, 1)).eq(7);
      expect(await erc1155.balanceOf(tbaccount1.address, 2)).eq(0);
      expect(await erc1155.balanceOf(user1.address, 2)).eq(5);
      // safeTransferFrom
      await erc1155.connect(user1).safeTransferFrom(user1.address, tbaccount1.address, 1, 1, "0x");
      expect(await erc1155.balanceOf(tbaccount1.address, 1)).eq(1);
      expect(await erc1155.balanceOf(user1.address, 1)).eq(6);
      // safeBatchTransferFrom
      await erc1155.connect(user1).safeBatchTransferFrom(user1.address, tbaccount1.address, [1,2], [4,3], "0x");
      expect(await erc1155.balanceOf(tbaccount1.address, 1)).eq(5);
      expect(await erc1155.balanceOf(user1.address, 1)).eq(2);
      expect(await erc1155.balanceOf(tbaccount1.address, 2)).eq(3);
      expect(await erc1155.balanceOf(user1.address, 2)).eq(2);
    });
  });

  describe("account execution", function () {
    it("non owner cannot execute", async function () {
      // no data
      await expect(bbaccount1.connect(user2).execute(user2.address, 0, "0x", 0)).to.be.revertedWithCustomError(bbaccount1, "ERC6551InvalidSigner");
      // erc20 transfer
      let calldata = erc20a.interface.encodeFunctionData("transfer", [user2.address, 0]);
      await expect(bbaccount1.connect(user2).execute(erc20a.address, 0, calldata, 0)).to.be.revertedWithCustomError(bbaccount1, "ERC6551InvalidSigner");
    });
    it("owner cannot execute not call", async function () {
      let calldata = erc20a.interface.encodeFunctionData("transfer", [user2.address, 0]);
      await expect(bbaccount1.connect(user1).execute(erc20a.address, 0, calldata, 1)).to.be.revertedWithCustomError(bbaccount1, "OnlyCallsAllowed");
      await expect(bbaccount1.connect(user1).execute(erc20a.address, 0, calldata, 2)).to.be.revertedWithCustomError(bbaccount1, "OnlyCallsAllowed");
      await expect(bbaccount1.connect(user1).execute(erc20a.address, 0, calldata, 3)).to.be.revertedWithCustomError(bbaccount1, "OnlyCallsAllowed");
    });
    it("reverts unsuccessful call", async function () {
      await expect(bbaccount1.connect(user1).execute(user2.address, WeiPerEther.mul(9999), "0x", 0)).to.be.reverted;
      await expect(bbaccount1.connect(user1).execute(revertModule.address, 0, revertModule.interface.encodeFunctionData("revertWithReason", []), 0)).to.be.revertedWithCustomError//(bbaccount1, "RevertWithReason");
      await expect(bbaccount1.connect(user1).execute(revertModule.address, 0, revertModule.interface.encodeFunctionData("revertWithoutReason", []), 0)).to.be.reverted;
    });
    it("owner can send ETH", async function () {
      let state1 = await bbaccount1.state();
      let bal1 = await provider.getBalance(user2.address);
      let transferAmount = WeiPerEther.div(3);
      let tx = await bbaccount1.connect(user1).execute(user2.address, transferAmount, "0x", 0);
      let bal2 = await provider.getBalance(user2.address);
      expect(bal2.sub(bal1)).eq(transferAmount);
      let state2 = await bbaccount1.state();
      expect(state2.sub(state1)).eq(1);
      l1DataFeeAnalyzer.register("execute transfer ETH", tx);
    });
    it("owner can send ERC20", async function () {
      let state1 = await bbaccount1.state();
      let bal11 = await erc20a.balanceOf(bbaccount1.address);
      let bal12 = await erc20a.balanceOf(user2.address);
      let transferAmount = WeiPerEther.mul(25);
      let calldata = erc20a.interface.encodeFunctionData("transfer", [user2.address, transferAmount]);
      let tx = await bbaccount1.connect(user1).execute(erc20a.address, 0, calldata, 0);
      let bal21 = await erc20a.balanceOf(bbaccount1.address);
      let bal22 = await erc20a.balanceOf(user2.address);
      expect(bal22.sub(bal12)).eq(transferAmount);
      expect(bal11.sub(bal21)).eq(transferAmount);
      let state2 = await bbaccount1.state();
      expect(state2.sub(state1)).eq(1);
      l1DataFeeAnalyzer.register("execute transfer ERC20", tx);
    });
    it("owner can send ERC721", async function () {
      let state1 = await bbaccount1.state();
      let tokenId = 2;
      expect(await erc721Asset.ownerOf(tokenId)).eq(bbaccount1.address);
      let calldata = erc721Asset.interface.encodeFunctionData("transferFrom", [bbaccount1.address, user2.address, tokenId]);
      let tx = await bbaccount1.connect(user1).execute(erc721Asset.address, 0, calldata, 0);
      expect(await erc721Asset.ownerOf(tokenId)).eq(user2.address);
      let state2 = await bbaccount1.state();
      expect(state2.sub(state1)).eq(1);
      l1DataFeeAnalyzer.register("execute transfer ERC721", tx);
    });
    //it("owner can send ERC1155", async function () {});
    it("can multicall execute", async function () {
      let state1 = await bbaccount1.state();
      let ethBal11 = await provider.getBalance(bbaccount1.address);
      let ethBal12 = await provider.getBalance(user2.address);
      let erc20Bal11 = await erc20a.balanceOf(bbaccount1.address);
      let erc20Bal12 = await erc20a.balanceOf(user2.address);
      let ethTransferAmount = WeiPerEther.div(25);
      let erc20TransferAmount = WeiPerEther.mul(500);
      let txdata0 = bbaccount1.interface.encodeFunctionData("execute", [user2.address, ethTransferAmount, "0x", 0])
      let erc20Calldata = erc20a.interface.encodeFunctionData("transfer", [user2.address, erc20TransferAmount]);
      let txdata1 = bbaccount1.interface.encodeFunctionData("execute", [erc20a.address, 0, erc20Calldata, 0]);
      let txdatas = [txdata0, txdata1];
      let tx = await bbaccount1.connect(user1).multicall(txdatas);
      let ethBal21 = await provider.getBalance(bbaccount1.address);
      let ethBal22 = await provider.getBalance(user2.address);
      let erc20Bal21 = await erc20a.balanceOf(bbaccount1.address);
      let erc20Bal22 = await erc20a.balanceOf(user2.address);
      expect(ethBal22.sub(ethBal12)).eq(ethTransferAmount);
      expect(ethBal11.sub(ethBal21)).eq(ethTransferAmount);
      expect(erc20Bal22.sub(erc20Bal12)).eq(erc20TransferAmount);
      expect(erc20Bal11.sub(erc20Bal21)).eq(erc20TransferAmount);
      let state2 = await bbaccount1.state();
      expect(state2.sub(state1)).eq(2);
      l1DataFeeAnalyzer.register("execute multicall", tx);
    });
    it("is payable", async function () {
      let state1 = await bbaccount1.state();
      let ethBal11 = await provider.getBalance(bbaccount1.address);
      let ethPayableAmount = WeiPerEther.mul(3);
      let tx = await bbaccount1.connect(user1).execute(user2.address, 0, "0x", 0, {value: ethPayableAmount});
      let ethBal21 = await provider.getBalance(bbaccount1.address);
      expect(ethBal21.sub(ethBal11)).eq(ethPayableAmount);
      let state2 = await bbaccount1.state();
      expect(state2.sub(state1)).eq(1);
      l1DataFeeAnalyzer.register("execute payable", tx);
    });
    it("is reenterable", async function () {
      let state1 = await bbaccount1.state();
      let ethBal11 = await provider.getBalance(bbaccount1.address);
      let ethPayableAmount = WeiPerEther.mul(4);
      let tx = await bbaccount1.connect(user1).execute(bbaccount1.address, 0, "0x", 0, {value: ethPayableAmount});
      let ethBal21 = await provider.getBalance(bbaccount1.address);
      expect(ethBal21.sub(ethBal11)).eq(ethPayableAmount);
      let state2 = await bbaccount1.state();
      expect(state2.sub(state1)).eq(1);
      l1DataFeeAnalyzer.register("execute reenterable", tx);
    });
  });

  describe("install modules", function () {
    it("can get combined abi", async function () {
      //console.log('abi');
      //console.log(abi);
      accountProxy = await ethers.getContractAt(abi, bbaccount1.address);
      //console.log('accountProxy')
      //console.log(accountProxy)
    });
    it("all mutator functions should be payable", async function () {
      let nonpayables = [];
      for(let i = 0; i < abi.length; ++i) {
        if(abi[i].type != "function") continue;
        if(abi[i].stateMutability == "nonpayable") nonpayables.push(abi[i].name || "receive/fallback?");
      }
      if(nonpayables.length > 0) throw(`Nonpayable functions: ${nonpayables.join(",")}`);
    });
    it("should have no sighash collisions", async function () {
      let abi2 = getCombinedAbi([
        "artifacts/contracts/accounts/BoomBotDiamondAccount.sol/BoomBotDiamondAccount.json",
        "artifacts/contracts/modules/ModulePack102.sol/ModulePack102.json",
        "artifacts/contracts/mocks/modules/FallbackModule.sol/FallbackModule.json",
        "artifacts/contracts/mocks/modules/RevertModule.sol/RevertModule.json",
        "artifacts/contracts/mocks/modules/Test1Module.sol/Test1Module.json",
        "artifacts/contracts/mocks/modules/Test2Module.sol/Test2Module.json",
        "artifacts/contracts/mocks/modules/Test3Module.sol/Test3Module.json",
        "artifacts/contracts/libraries/Calls.sol/Calls.json",
        "artifacts/contracts/libraries/Errors.sol/Errors.json",
        "artifacts/contracts/libraries/modules/ERC2535Library.sol/ERC2535Library.json",
        "artifacts/contracts/libraries/modules/ERC165Library.sol/ERC165Library.json",
      ])
      let routerContract = await ethers.getContractAt(abi2, user1.address)
      let sighashesToSignatures:any = {};
      let collisions:string[] = [];
      for(let i = 0; i < abi2.length; ++i) {
        if(abi2[i].type != "function") continue;
        let signature = getSignature(abi2[i]);
        let sighash = routerContract.interface.getSighash(signature);
        //console.log(`${signature} -> ${sighash}`);
        if(sighashesToSignatures.hasOwnProperty(sighash)) {
          if(!collisions.includes(sighash)) collisions.push(sighash);
        } else sighashesToSignatures[sighash] = [];
        sighashesToSignatures[sighash].push(signature);
      }
      //console.log('sighashes')
      //console.log(sighashesToSignatures)
      if(collisions.length > 0) {
        let collisionsString = "Sighash collisions detected:" + collisions.map((sighash:string) => `${sighash}: ${sighashesToSignatures[sighash].join(", ")}`);
        throw(collisionsString);
      }
    })
    /*
    it("should have no sighash collisions", async function () {
      // note that this is also checked at compile time
      // but only if function is declared or inherited in ITokenFlowRouter
      let abi = artifacts.ITokenFlowRouter.abi;
      let sighashesToSignatures:any = {};
      let collisions:string[] = [];
      for(let i = 0; i < abi.length; ++i) {
        if(abi[i].type != "function") continue;
        let signature = getSignature(abi[i]);
        let sighash = routerContract.interface.getSighash(signature);
        //console.log(`${signature} -> ${sighash}`);
        if(sighashesToSignatures.hasOwnProperty(sighash)) {
          if(!collisions.includes(sighash)) collisions.push(sighash);
        } else sighashesToSignatures[sighash] = [];
        sighashesToSignatures[sighash].push(signature);
      }
      if(collisions.length > 0) {
        let collisionsString = "Sighash collisions detected:" + collisions.map((sighash:string) => `${sighash}: ${sighashesToSignatures[sighash].join(", ")}`);
        throw(collisionsString);
      }
    });
    */
    // some functions should be allowed to be nonpayable
    // acceptOwnership,multicall,renounceOwnership,transferOwnership,approve,safeTransferFrom,safeTransferFrom,setApprovalForAll,transferFrom
    /*
    it("all mutator functions should be payable pt 2", async function () {
      let abi2 = getCombinedAbi([
        "artifacts/contracts/router/AgentFactory01.sol/AgentFactory01.json",
        "artifacts/contracts/tokens/Agents.sol/Agents.json",
        "artifacts/contracts/utils/Blastable.sol/Blastable.json",
        "artifacts/contracts/utils/DataStore.sol/DataStore.json",
        "artifacts/contracts/utils/BalanceFetcher.sol/BalanceFetcher.json",
        "artifacts/contracts/utils/Ownable2Step.sol/Ownable2Step.json",
        "artifacts/contracts/utils/ContractFactory.sol/ContractFactory.json",
      ])
      console.log(abi2)
      console.log(abi2.filter(item=>item.name=="multicall"))
      let nonpayables = [];
      for(let i = 0; i < abi2.length; ++i) {
        if(abi2[i].type != "function") continue;
        if(abi2[i].stateMutability == "nonpayable") nonpayables.push(abi2[i].name || "receive/fallback?");
      }
      if(nonpayables.length > 0) throw(`Nonpayable functions: ${nonpayables.join(",")}`);
    });
    */
    it("cannot be called by non owner", async function () {
      await expect(accountProxy.connect(user2).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [dummy1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "ERC6551InvalidSigner");
    });
    it("cannot use invalid FacetCutAction", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: 3,
        functionSelectors: [dummy1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "DelegateCallFailed");
    });
    it("cannot add zero functions", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: []
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "LengthZero");
    });
    it("cannot add zero address facet", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Add,
        functionSelectors: [dummy1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "AddressZero");
    });
    it("can whitelist more modules", async function () {
      let modules = [
        {
          module: fallbackModule.address,
          shouldWhitelist: true,
        },
        {
          module: test1Module.address,
          shouldWhitelist: true,
        },
        {
          module: test2Module.address,
          shouldWhitelist: true,
        },
        {
          module: test3Module.address,
          shouldWhitelist: true,
        },
        {
          module: user2.address,
          shouldWhitelist: false,
        },
      ]
      let tx = await dataStore.connect(owner).setModuleWhitelist(modules)
      for(let m of modules) {
        expect(await dataStore.moduleIsWhitelisted(m.module)).to.eq(m.shouldWhitelist)
        expect(await dataStore.moduleCanBeInstalled(m.module)).to.eq(m.shouldWhitelist)
        await expect(tx).to.emit(dataStore, "ModuleWhitelisted").withArgs(m.module, m.shouldWhitelist)
      }
    })
    it("cannot add function that already exists", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [diamondCutSighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "AddFunctionDuplicate");
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [multicallSighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "AddFunctionDuplicate");
    });
    it("cannot init to non contract", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [dummy1Sighash]
      }], user1.address, "0x")).to.be.revertedWithCustomError(accountProxy, "NotAContract");
    });
    it("cannot add if init fails", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [dummy1Sighash]
      }], revertModule.address, revertModule.interface.encodeFunctionData("revertWithReason()"))).to.be.revertedWithCustomError(accountProxy, "RevertWithReason");
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [dummy1Sighash]
      }], revertModule.address, revertModule.interface.encodeFunctionData("revertWithoutReason()"))).to.be.revertedWithCustomError(accountProxy, "DelegateCallFailed");
    });
    it("can add functions from a known facet", async function () {
      let tx = await accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [dummy1Sighash]
      }], AddressZero, "0x");
      await expect(tx).to.emit(accountProxy, "DiamondCut");
    });
    it("can add functions from a new facet", async function () {
      let tx = await accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [dummy2Sighash]
      }], fallbackModule.address, dummy1Sighash, {value: 1}); // and delegatecall
      await expect(tx).to.emit(accountProxy, "DiamondCut");
    });
  });

  describe("remove modules", function () {
    before("add modules", async function () {
      // add test1Module
      await accountProxy.connect(user1).diamondCut([{
        facetAddress: test1Module.address,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(test1Module)
      }], AddressZero, "0x", {value: 1});
      let test1Selectors = [testFunc1Sighash, testFunc2Sighash, testFunc3Sighash];
      let result = await accountProxy.facetFunctionSelectors(test1Module.address)
      assert.sameMembers(result, test1Selectors);
      await expect(await accountProxy.testFunc1()).to.emit(accountProxy, "Test1Event").withArgs(1);
      await expect(await accountProxy.testFunc2()).to.emit(accountProxy, "Test1Event").withArgs(2);
      await expect(await accountProxy.testFunc3()).to.emit(accountProxy, "Test1Event").withArgs(3);
    });
    it("cannot be called by non owner", async function () {
      await expect(accountProxy.connect(user2).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [dummy1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "ERC6551InvalidSigner");
    });
    it("cannot use invalid FacetCutAction", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: 3,
        functionSelectors: [dummy1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "DelegateCallFailed");
    });
    it("cannot remove zero functions", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: []
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "LengthZero");
    });
    it("cannot remove nonzero address facet", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: accountProxy.address,
        action: FacetCutAction.Remove,
        functionSelectors: [dummy1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "AddressNotZero");
    });
    it("cannot remove function that doesn't exist", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [dummy3Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "RemoveFunctionDoesNotExist");
    });
    it("cannot init to non contract", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [testFunc1Sighash]
      }], user1.address, "0x")).to.be.revertedWithCustomError(accountProxy, "NotAContract");
    });
    it("cannot remove if init fails", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [testFunc1Sighash]
      }], revertModule.address, revertModule.interface.encodeFunctionData("revertWithReason()"))).to.be.revertedWithCustomError(accountProxy, "RevertWithReason");
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [testFunc1Sighash]
      }], revertModule.address, revertModule.interface.encodeFunctionData("revertWithoutReason()"))).to.be.revertedWithCustomError(accountProxy, "DelegateCallFailed");
    });
    it("can remove functions", async function () {
      let tx = await accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [testFunc1Sighash]
      }], AddressZero, "0x", {value: 1});
      await expect(tx).to.emit(accountProxy, "DiamondCut");
      let test1Selectors = [testFunc2Sighash, testFunc3Sighash];
      let result = await accountProxy.facetFunctionSelectors(test1Module.address)
      assert.sameMembers(result, test1Selectors);
    });
    it("cannot remove function twice", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [testFunc1Sighash]
      }], user1.address, "0x")).to.be.revertedWithCustomError(accountProxy, "RemoveFunctionDoesNotExist");
    });
    it("can remove multiple functions", async function () {
      let tx = await accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [testFunc2Sighash, testFunc3Sighash]
      }], AddressZero, "0x", {value: 1});
      await expect(tx).to.emit(accountProxy, "DiamondCut");
      let test1Selectors:string[] = [];
      let result = await accountProxy.facetFunctionSelectors(test1Module.address)
      assert.sameMembers(result, test1Selectors);
    });
    it("cannot remove an immutable function", async function () {
      // add immutable function => facet address == diamond address
      await dataStore.connect(owner).setModuleWhitelist([{
        module: accountProxy.address,
        shouldWhitelist: true,
      }])
      await accountProxy.connect(user1).diamondCut([{
        facetAddress: accountProxy.address,
        action: FacetCutAction.Add,
        functionSelectors: [dummy3Sighash]
      }], AddressZero, "0x", {value: 1});
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [dummy3Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "RemoveFunctionImmutable");
    });
    it("can remove facets", async function () {
      // add facets
      await accountProxy.connect(user1).diamondCut([{
        facetAddress: test1Module.address,
        action: FacetCutAction.Add,
        functionSelectors: [testFunc1Sighash]
      },{
        facetAddress: test2Module.address,
        action: FacetCutAction.Add,
        functionSelectors: [testFunc2Sighash]
      }], AddressZero, "0x", {value: 1});
      let facets0 = await accountProxy.facetAddresses();
      //accountProxy = await ethers.getContractAt(artifacts.Test2Module.abi, accountProxy.address) as Test2Module;
      let result11 = await accountProxy.facetFunctionSelectors(test1Module.address)
      assert.sameMembers(result11, [testFunc1Sighash]);
      let result12 = await accountProxy.facetFunctionSelectors(test2Module.address)
      assert.sameMembers(result12, [testFunc2Sighash]);
      let facets1 = await accountProxy.facetAddresses();
      //expect(facets1.length).eq(6);
      //expect(facets0.length-facets1.length).eq(1);
      // remove facets
      await accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [testFunc1Sighash]
      },{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [testFunc2Sighash]
      }], AddressZero, "0x", {value: 1});
      let result21 = await accountProxy.facetFunctionSelectors(test1Module.address)
      assert.sameMembers(result21, []);
      let result22 = await accountProxy.facetFunctionSelectors(test2Module.address)
      assert.sameMembers(result22, []);
      let facets2 = await accountProxy.facetAddresses();
      //expect(facets2.length).eq(4);
      expect(facets1.length-facets2.length).eq(2);
    });
  });

  describe("replace modules", function () {
    before("add modules", async function () {
      // add test1Module
      await accountProxy.connect(user1).diamondCut([{
        facetAddress: test1Module.address,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(test1Module)
      }], AddressZero, "0x", {value: 1});
      let test1Selectors = [testFunc1Sighash, testFunc2Sighash, testFunc3Sighash];
      let result = await accountProxy.facetFunctionSelectors(test1Module.address)
      assert.sameMembers(result, test1Selectors);
      await expect(await accountProxy.testFunc1()).to.emit(accountProxy, "Test1Event").withArgs(1);
      await expect(await accountProxy.testFunc2()).to.emit(accountProxy, "Test1Event").withArgs(2);
      await expect(await accountProxy.testFunc3()).to.emit(accountProxy, "Test1Event").withArgs(3);
    });
    it("cannot be called by non owner", async function () {
      await expect(accountProxy.connect(user2).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [testFunc1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "ERC6551InvalidSigner");
    });
    it("cannot use invalid FacetCutAction", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: 3,
        functionSelectors: [testFunc1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "DelegateCallFailed");
    });
    it("cannot replace zero functions", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: []
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "LengthZero");
    });
    it("cannot replace zero address facet", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Replace,
        functionSelectors: [testFunc1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "AddressZero");
    });
    it("cannot replace function that doesn't exist", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [dummy4Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "RemoveFunctionDoesNotExist");
    });
    it("cannot replace function with same facet", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: test1Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [testFunc1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "ReplaceFunctionSame");
    });
    it("cannot init to non contract", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [testFunc1Sighash]
      }], user1.address, "0x")).to.be.revertedWithCustomError(accountProxy, "NotAContract");
    });
    it("cannot replace if init fails", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [testFunc1Sighash]
      }], revertModule.address, revertModule.interface.encodeFunctionData("revertWithReason()"))).to.be.revertedWithCustomError(accountProxy, "RevertWithReason");
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [testFunc1Sighash]
      }], revertModule.address, revertModule.interface.encodeFunctionData("revertWithoutReason()"))).to.be.revertedWithCustomError(accountProxy, "DelegateCallFailed");
    });
    it("can replace functions", async function () {
      let tx = await accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [testFunc1Sighash]
      }], AddressZero, "0x", {value: 1});
      await expect(tx).to.emit(accountProxy, "DiamondCut");
      let test1Selectors = [testFunc2Sighash, testFunc3Sighash];
      let result1 = await accountProxy.facetFunctionSelectors(test1Module.address)
      assert.sameMembers(result1, test1Selectors);
      let test2Selectors = [testFunc1Sighash];
      let result2 = await accountProxy.facetFunctionSelectors(test2Module.address)
      assert.sameMembers(result2, test2Selectors);
      await expect(await accountProxy.testFunc1()).to.emit(accountProxy, "Test2Event").withArgs(1);
      await expect(await accountProxy.testFunc2()).to.emit(accountProxy, "Test1Event").withArgs(2);
      await expect(await accountProxy.testFunc3()).to.emit(accountProxy, "Test1Event").withArgs(3);
    });
    it("can replace multiple functions", async function () {
      let facets1 = await accountProxy.facetAddresses();
      //expect(facets1.length).eq(6);
      let tx = await accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [testFunc2Sighash, testFunc3Sighash]
      }], AddressZero, "0x", {value: 1});
      await expect(tx).to.emit(accountProxy, "DiamondCut");
      let test1Selectors:string[] = [];
      let result1 = await accountProxy.facetFunctionSelectors(test1Module.address)
      assert.sameMembers(result1, test1Selectors);
      let test2Selectors = [testFunc1Sighash, testFunc2Sighash, testFunc3Sighash];
      let result2 = await accountProxy.facetFunctionSelectors(test2Module.address)
      assert.sameMembers(result2, test2Selectors);
      await expect(await accountProxy.testFunc1()).to.emit(accountProxy, "Test2Event").withArgs(1);
      await expect(await accountProxy.testFunc2()).to.emit(accountProxy, "Test2Event").withArgs(2);
      await expect(await accountProxy.testFunc3()).to.emit(accountProxy, "Test2Event").withArgs(3);
      let facets2 = await accountProxy.facetAddresses();
      //expect(facets2.length).eq(5);
      expect(facets1.length-facets2.length).eq(1);
    });
    it("cannot replace an immutable function", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [dummy3Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "RemoveFunctionImmutable");
    });
  });

  describe("account execution pt 2", function () {
    it("cannot call function that does not exist", async function () {
      //await expect(accountProxy.connect(user1).execute(user2.address, WeiPerEther.mul(9999), "0x", 0)).to.be.reverted;
      //await expect(accountProxy.connect(user1).execute(revertModule.address, 0, revertModule.interface.encodeFunctionData("revertWithReason", []), 0)).to.be.revertedWithCustomError(accountProxy, "RevertWithReason");
      //await expect(bbaccount1.connect(user1).execute(revertModule.address, 0, revertModule.interface.encodeFunctionData("revertWithoutReason", []), 0)).to.be.reverted;
      await expect(user1.sendTransaction({
        to: accountProxy.address,
        data: dummy4Sighash
      })).to.be.revertedWithCustomError(accountProxy, "FunctionDoesNotExist");
      await expect(accountProxy.testFunc4()).to.be.revertedWithCustomError(accountProxy, "FunctionDoesNotExist");
      let txdata = test3Module.interface.encodeFunctionData("testFunc4", []);
      await expect(accountProxy.multicall([])).to.not.be.reverted;
      await expect(accountProxy.multicall([txdata])).to.be.revertedWithCustomError(accountProxy, "FunctionDoesNotExist");
    });
    it("non owner cannot updateSupportedInterfaces", async function () {
      await expect(accountProxy.connect(user2).updateSupportedInterfaces([], [])).to.be.revertedWithCustomError(accountProxy, "ERC6551InvalidSigner");
    });
    it("cannot updateSupportedInterfaces with length mismatch", async function () {
      //await accountProxy.connect(user1).updateSupportedInterfaces([], [true])
      await expect(accountProxy.connect(user1).updateSupportedInterfaces([], [true])).to.be.revertedWithCustomError(accountProxy, "LengthMismatch")
    });
    it("can updateSupportedInterfaces", async function () {
      expect(await accountProxy.supportsInterface(dummy1Sighash)).to.be.false;
      expect(await accountProxy.supportsInterface(dummy2Sighash)).to.be.false;
      let tx = await accountProxy.connect(user1).updateSupportedInterfaces([dummy1Sighash, dummy2Sighash], [true, false]);
      await expect(tx).to.emit(accountProxy, "InterfaceSupportUpdated").withArgs(dummy1Sighash, true);
      await expect(tx).to.emit(accountProxy, "InterfaceSupportUpdated").withArgs(dummy2Sighash, false);
      expect(await accountProxy.supportsInterface(dummy1Sighash)).to.be.true;
      expect(await accountProxy.supportsInterface(dummy2Sighash)).to.be.false;
    });
  });

  describe("quoter", function () {
    it("can fetch claimable gas for accountProxy pt 1", async function () {
      let account = tbaccount2.address
      let bal0 = await provider.getBalance(account)
      let bal1 = 0
      let bal2 = 0
      let tokens = [AddressZero, AddressOne, AddressTwo]
      let tx = await balanceFetcher.fetchBalances(account, tokens)
      let res = await balanceFetcher.callStatic.fetchBalances(account, tokens)
      expect(res).deep.eq([bal0, bal1, bal2])
    })
    it("can fetch claimable gas for module pack 102", async function () {
      let account = modulePack102.address
      let bal0 = await provider.getBalance(account)
      let bal1 = 0
      let bal2 = 0
      let tokens = [AddressZero, AddressOne, AddressTwo]
      let tx = await balanceFetcher.fetchBalances(account, tokens)
      let res = await balanceFetcher.callStatic.fetchBalances(account, tokens)
      expect(res).deep.eq([bal0, bal1, bal2])
    })
    it("can deploy mockblast", async function () {
      mockblast = await deployContract(deployer, "MockBlast", []);
      await expectDeployed(mockblast.address);
      l1DataFeeAnalyzer.register("deploy MockBlast", mockblast.deployTransaction);
      await user1.sendTransaction({
        to: mockblast.address,
        value: WeiPerEther
      })
    })
    it("can deploy account implementations", async function () {
      //boomAgentAccountImplementation = await deployContract(deployer, "BoomBotDiamondAccount", []) as BoomBotDiamondAccount;
      boomAgentAccountImplementation = await deployContract(deployer, "BoomBotDiamondAccount", [mockblast.address, owner.address]) as BoomBotDiamondAccount;
      await expectDeployed(boomAgentAccountImplementation.address);
      l1DataFeeAnalyzer.register("deploy BoomBotDiamondAccount impl", agentNft.deployTransaction);
    });
    it("can deploy modules", async function () {
      // ModulePack102
      modulePack102 = await deployContract(deployer, "ModulePack102", [mockblast.address, owner.address]) as ModulePack102;
      await expectDeployed(modulePack102.address);
      l1DataFeeAnalyzer.register("deploy ModulePack102 impl", modulePack102.deployTransaction);
    })
    it("owner can whitelist modules", async function () {
      let modules = [
        {
          module: modulePack102.address,
          shouldWhitelist: true,
        },
      ]
      let tx = await dataStore.connect(owner).setModuleWhitelist(modules)
      for(let m of modules) {
        expect(await dataStore.moduleIsWhitelisted(m.module)).to.eq(m.shouldWhitelist)
        expect(await dataStore.moduleCanBeInstalled(m.module)).to.eq(m.shouldWhitelist)
        await expect(tx).to.emit(dataStore, "ModuleWhitelisted").withArgs(m.module, m.shouldWhitelist)
      }
    });
    it("can fetch claimable gas for module pack 102 pt 2", async function () {
      let account = modulePack102.address
      let bal0 = await provider.getBalance(account)
      let bal1 = 0
      let bal2 = 0
      let tokens = [AddressZero, AddressOne, AddressTwo]
      let tx = await balanceFetcher.fetchBalances(account, tokens)
      let res = await balanceFetcher.callStatic.fetchBalances(account, tokens)
      expect(res).deep.eq([bal0, bal1, bal2])
    })
    it("cannot claim gas directly on module", async function () {
      await expect(modulePack102.connect(user1).claimAllGas()).to.be.reverted
      await expect(modulePack102.connect(user1).claimMaxGas()).to.be.reverted
    })
    it("owner can postAgentCreationSettings pt 4", async function () {
      //let sighashes = calcSighashes(modulePack100, 'ModulePack100', true)
      //sighashes.push(inscribeSighash)
      //let sighashes = calcSighashes(modulePack101, 'ModulePack101', true)
      //let sighashes0 = calcSighashes(modulePack102, 'ModulePack102', true)
      let sighashes2 = [
        //'0x175e1a7d', // blast()
        '0x645dd1fa', // claimAllGas()
        '0xb2b8c93f', // claimMaxGas()
        '0x660d0d67', // dataStore()
        '0x1f931c1c', // diamondCut((address,uint8,bytes4[])[],address,bytes)
        '0x51945447', // execute(address,uint256,bytes,uint8)
        '0xcdffacc6', // facetAddress(bytes4)
        '0x52ef6b2c', // facetAddresses()
        '0xadfca15e', // facetFunctionSelectors(address)
        '0x7a0ed627', // facets()
        '0x1626ba7e', // isValidSignature(bytes32,bytes)
        '0x523e3260', // isValidSigner(address,bytes)
        '0xd5f50582', // isValidSigner(address)
        '0xac9650d8', // multicall(bytes[])
        '0xbc197c81', // onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)
        '0xf23a6e61', // onERC1155Received(address,address,uint256,uint256,bytes)
        '0x150b7a02', // onERC721Received(address,address,uint256,bytes)
        '0x8da5cb5b', // owner()
        '0x7cb81437', // quoteClaimAllGas()
        '0xc3eb9fc5', // quoteClaimAllGasWithRevert()
        '0x97370879', // quoteClaimMaxGas()
        '0x1f15cbde', // quoteClaimMaxGasWithRevert()
        '0xa2d2dd3c', // reentrancyGuardState()
        '0xc19d93fb', // state()
        '0x01ffc9a7', // supportsInterface(bytes4)
        '0xfc0c546a', // token()
        '0xf71a8a0f', // updateSupportedInterfaces(bytes4[],bool[])
        '0xde52f07d', // inscribe()
      ]
      let diamondCut = [
        {
          facetAddress: modulePack102.address,
          action: FacetCutAction.Add,
          functionSelectors: sighashes2,
        },
      ]
      diamondCutInit = diamondCut
      let interfaceIDs = [
        "0x01ffc9a7", // ERC165
        "0x1f931c1c", // DiamondCut
        "0x48e2b093", // DiamondLoupe
        "0x6faff5f1", // ERC6551Account
        "0x51945447", // ERC6551Executable
      ]
      let support = interfaceIDs.map(id=>true)
      agentInitializationCode1 = boomAgentAccountImplementation.interface.encodeFunctionData("initialize", [diamondCut, dataStore.address]);
      agentInitializationCode2 = modulePack102.interface.encodeFunctionData("updateSupportedInterfaces", [interfaceIDs, support]);

      let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
      let agentInitializationCode3 = modulePack102.interface.encodeFunctionData("execute", [mockblast.address, 0, blastcalldata3, 0]);
      let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
      let agentInitializationCode4 = modulePack102.interface.encodeFunctionData("execute", [mockblast.address, 0, blastcalldata4, 0]);

      let params = {
        agentImplementation: boomAgentAccountImplementation.address,
        initializationCalls: [
          agentInitializationCode1,
          agentInitializationCode2,
          agentInitializationCode3,
          agentInitializationCode4,
        ],
        isPaused: false
      }
      let tx = await factory.connect(owner).postAgentCreationSettings(params)
      expect(await factory.getAgentCreationSettingsCount()).eq(4)
      let res = await factory.getAgentCreationSettings(4)
      expect(res.agentImplementation).eq(params.agentImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isPaused).eq(params.isPaused)
      await expect(tx).to.emit(factory, "AgentCreationSettingsPosted").withArgs(4)
      await expect(tx).to.emit(factory, "AgentCreationSettingsPaused").withArgs(4, params.isPaused)
    })
    it("can create agent pt 2", async function () {
      let ts = await agentNft.totalSupply();
      let bal = await agentNft.balanceOf(user1.address);
      let agentID = ts.add(1);
      let agentRes = await factory.connect(user1).callStatic['createAgent(uint256)'](4, {gasLimit: 10_000_000});
      expect(agentRes.agentID).eq(agentID);
      expect(await agentNft.exists(agentID)).eq(false);
      let isDeployed1 = await isDeployed(agentRes.agentAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createAgent(uint256)'](4, {gasLimit: 10_000_000});
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(AddressZero, factory.address, agentRes.agentID);
      await expect(tx).to.emit(agentNft, "Transfer").withArgs(factory.address, user1.address, agentRes.agentID);
      expect(await agentNft.totalSupply()).eq(ts.add(1));
      expect(await agentNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await agentNft.exists(agentID)).eq(true);
      expect(await agentNft.ownerOf(agentRes.agentID)).eq(user1.address);
      let agentInfo = await agentNft.getAgentInfo(agentID);
      //expect(agentInfo.agentAddress).eq(agentRes.agentAddress); // may change
      let isDeployed2 = await isDeployed(agentInfo.agentAddress)
      expect(isDeployed2).to.be.true;
      expect(agentInfo.implementationAddress).eq(boomAgentAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt(abi, agentInfo.agentAddress) as BoomBotDiamondAccount;
      l1DataFeeAnalyzer.register("createAgent", tx);
    });
    it("has the correct modules", async function () {
      let diamondAccount = await ethers.getContractAt("ModulePack102", tbaccount2.address) as ModulePack102;
      // facets(), facetAddresses()
      let facets = await diamondAccount.facets();
      let facetAddresses = await diamondAccount.facetAddresses();
      let sighashes = calcSighashes(boomAgentAccountImplementation, 'BoomBotDiamondAccount')
      diamondCutInit = [
        {
          facetAddress: diamondAccount.address,
          action: FacetCutAction.Add,
          functionSelectors: sighashes,
        },
        ...diamondCutInit
      ]
      expect(facets.length).eq(diamondCutInit.length);
      for(let i = 0; i < diamondCutInit.length; i++) {
        expect(facets[i].facetAddress).eq(diamondCutInit[i].facetAddress);
        expect(facetAddresses[i]).eq(diamondCutInit[i].facetAddress);
        assert.sameMembers(facets[i].functionSelectors, diamondCutInit[i].functionSelectors);
        // facetFunctionSelectors()
        let selectors = await diamondAccount.facetFunctionSelectors(facetAddresses[i]);
        assert.sameMembers(selectors, diamondCutInit[i].functionSelectors);
        // facetAddress()
        for(let j = 0; j < diamondCutInit[i].functionSelectors.length; j++) {
          let selector = diamondCutInit[i].functionSelectors[j];
          let facetAddress = await diamondAccount.facetAddress(selector);
          expect(facetAddress).eq(diamondCutInit[i].facetAddress);
        }
      }
    });
    it("can fetch claimable gas for accountProxy pt 2", async function () {
      let account = tbaccount2.address
      let bal0 = await provider.getBalance(account)
      let bal1 = 2255
      let bal2 = 1500
      let tokens = [AddressZero, AddressOne, AddressTwo]
      let tx = await balanceFetcher.fetchBalances(account, tokens)
      let res = await balanceFetcher.callStatic.fetchBalances(account, tokens)
      expect(res).deep.eq([bal0, bal1, bal2])
    })
    it("non owner cannot claim gas", async function () {
      await expect(tbaccount2.connect(user2).claimAllGas()).to.be.revertedWithCustomError(tbaccount2, "ERC6551InvalidSigner")
      await expect(tbaccount2.connect(user2).claimMaxGas()).to.be.revertedWithCustomError(tbaccount2, "ERC6551InvalidSigner")
    })
    it("owner can claim gas", async function () {
      let res1 = await tbaccount2.connect(user1).callStatic.claimAllGas()
      let res2 = await tbaccount2.connect(user1).callStatic.claimMaxGas()
      expect(res1).eq(2255)
      expect(res2).eq(1500)
      let tx1 = await tbaccount2.connect(user1).claimAllGas()
      let tx2 = await tbaccount2.connect(user1).claimMaxGas()
    })
    it("cannot claim gas if not configured", async function () {
      let txdata = iblast.interface.encodeFunctionData("configureVoidGas")
      await tbaccount2.connect(user1).execute(mockblast.address, 0, txdata, 0)
      await expect(tbaccount2.connect(user1).claimAllGas()).to.be.revertedWith("not configured claimable gas")
      await expect(tbaccount2.connect(user1).claimMaxGas()).to.be.revertedWith("not configured claimable gas")
    })
  })

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});

function getSignature(abiElement: any) {
  function encodeInput(x:any) {
    if(!x.components || x.components.length == 0) return x.type;
    let tupleType = x.components.map((y:any)=>encodeInput(y));
    tupleType = `(${tupleType.join(",")})`;
    tupleType = `${tupleType}${x.type.replace("tuple","")}`
    return tupleType;
  }
  let signature = `${abiElement.name}(${abiElement.inputs.map((x:any)=>encodeInput(x)).join(",")})`;
  return signature;
}
