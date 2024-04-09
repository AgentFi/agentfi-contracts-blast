/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect } = chai;

import { IERC6551Registry, AccountV3, MockERC20, MockERC721, GasCollector } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { toBytes32 } from "./../scripts/utils/setStorage";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { deployContract } from "../scripts/utils/deployContract";
import L1DataFeeAnalyzer from "../scripts/utils/L1DataFeeAnalyzer";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../scripts/utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const WeiPerUsdc = BN.from(1_000_000); // 6 decimals

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";
const BLAST_POINTS_ADDRESS            = "0x2fc95838c71e76ec69ff817983BFf17c710F34E0";
const BLAST_POINTS_OPERATOR_ADDRESS   = "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";
const ENTRY_POINT_ADDRESS             = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const MULTICALL_FORWARDER_ADDRESS     = ""; // v1.0.1

const MAGIC_VALUE_0 = "0x00000000";
const MAGIC_VALUE_IS_VALID_SIGNER = "0x523e3260";
const MAGIC_VALUE_IS_VALID_SIGNATURE = "0x1626ba7e";

const multicallSighash                 = "0xac9650d8";
const updateSupportedInterfacesSighash = "0xf71a8a0f";
const dummy1Sighash                    = "0x11111111";
const dummy2Sighash                    = "0x22222222";
const dummy3Sighash                    = "0x33333333";
const dummy4Sighash                    = "0x44444444";
const testFunc1Sighash                 = "0x561f5f89";
const testFunc2Sighash                 = "0x08752360";
const testFunc3Sighash                 = "0x9a5fb5a8";
const inscribeSighash                  = "0xde52f07d";

describe("AccountBase", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  let gasCollector: GasCollector;
  let erc6551Registry: IERC6551Registry;

  let multicallForwarder: MulticallForwarder;
  let agentRegistry: AgentRegistry;
  let genesisAccountFactory: BlastooorAccountFactory;

  let agentNft: MockERC721; // the erc721 that may have token bound accounts
  let erc721Asset: MockERC721; // an erc721 that token bound accounts may hold
  let erc6551AccountImplementation: AccountV3; // the base implementation for token bound accounts
  let erc6551AccountImplementation2: AccountV3; // the base implementation for token bound accounts
  let erc6551AccountImplementation3: AccountV3; // the base implementation for token bound accounts
  let erc6551Account1: AccountV3; // an account bound to a token
  let erc6551AccountLocked1: AccountV3; // an account bound to a token
  let erc6551AccountLocked2: AccountV3; // an account bound to a token
  let erc6551Account2: AccountV3; // an account bound to a token
  let erc6551Account3: AccountV3; // an account bound to a token
  let erc6551AccountNested1: AccountV3; // an account bound to a token
  let erc6551AccountNested2: AccountV3; // an account bound to a token
  let erc6551AccountNested3: AccountV3; // an account bound to a token
  let erc6551AccountNoContract: AccountV3; // an account bound to a token
  let erc6551AccountNoToken: AccountV3; // an account bound to a token

  let test1Callee: Test1Callee;
  let revertAccount: RevertAccount;
  let mockSandbox: MockSandbox;

  let erc20: MockERC20;

  let mockERC1271: MockERC1271;

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
    erc20 = await deployContract(deployer, "MockERC20", [`Token 1`, `TKN1`, 18]) as MockERC20;
    expect(await erc20.decimals()).eq(18)

    //nonstandardToken1 = await deployContract(deployer, "MockERC20NoReturnsSuccess", [`NonstandardToken1`, `NSTKN1`, 18]) as MockERC20NoReturnsSuccess;
    //nonstandardToken2 = await deployContract(deployer, "MockERC20NoReturnsRevert", [`NonstandardToken2`, `NSTKN2`, 18]) as MockERC20NoReturnsRevert;
    //nonstandardToken3 = await deployContract(deployer, "MockERC20NoReturnsRevertWithError", [`NonstandardToken3`, `NSTKN3`, 18]) as MockERC20NoReturnsRevertWithError;
    //nonstandardToken4 = await deployContract(deployer, "MockERC20SuccessFalse", [`NonstandardToken4`, `NSTKN4`, 18]) as MockERC20SuccessFalse;

    await expectDeployed(ERC6551_REGISTRY_ADDRESS); // expect to be run on a fork of a testnet with registry deployed
    erc6551Registry = await ethers.getContractAt("IERC6551Registry", ERC6551_REGISTRY_ADDRESS) as IERC6551Registry;
  });

  after(async function () {
    await provider.send("evm_revert", [snapshot]);
  });

  describe("setup", function () {
    it("can deploy gas collector", async function () {
      gasCollector = await deployContract(deployer, "GasCollector", [owner.address, BLAST_ADDRESS, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]);
      await expectDeployed(gasCollector.address);
      expect(await gasCollector.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy GasCollector", gasCollector.deployTransaction);
    });
    it("can deploy MulticallForwarder", async function () {
      multicallForwarder = await deployContract(deployer, "MulticallForwarder", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS]) as MulticallForwarder;
      await expectDeployed(multicallForwarder.address);
      l1DataFeeAnalyzer.register("deploy MulticallForwarder", multicallForwarder.deployTransaction);
    });
    it("can deploy MockERC1271", async function () {
      mockERC1271 = await deployContract(deployer, "MockERC1271", []) as MockERC1271;
      await expectDeployed(mockERC1271.address);
      l1DataFeeAnalyzer.register("deploy MockERC1271", mockERC1271.deployTransaction);
    });
    it("can deploy Test1Callee", async function () {
      test1Callee = await deployContract(deployer, "Test1Callee", []) as Test1Callee;
      await expectDeployed(test1Callee.address);
      l1DataFeeAnalyzer.register("deploy Test1Callee", test1Callee.deployTransaction);
    });
    it("can deploy RevertAccount", async function () {
      revertAccount = await deployContract(deployer, "RevertAccount", []) as RevertAccount;
      await expectDeployed(revertAccount.address);
      l1DataFeeAnalyzer.register("deploy RevertAccount", revertAccount.deployTransaction);
    });
    it("can deploy MockSandbox", async function () {
      mockSandbox = await deployContract(deployer, "MockSandbox", []) as MockSandbox;
      await expectDeployed(mockSandbox.address);
      l1DataFeeAnalyzer.register("deploy MockSandbox", mockSandbox.deployTransaction);
    });
  });

  const testCases = [
    { accountType: "AccountV3", },
    { accountType: "BlastooorGenesisAgentAccount", },
    { accountType: "BlastooorStrategyAccountBase", },
    { accountType: "BlastooorStrategyAgentAccount", },
  ]

  const blastableAccountTypes = ["BlastooorGenesisAgentAccount", "BlastooorStrategyAgentAccount"]
  const genesisAccountTypes = ["AccountV3", "BlastooorGenesisAgentAccount"]
  const strategyAccountTypes = ["BlastooorStrategyAccountBase", "BlastooorStrategyAgentAccount"]

  for(const testCase of testCases) {
    const accountType = testCase.accountType
    const isBlastableType = blastableAccountTypes.includes(accountType)
    const isGenesisType = genesisAccountTypes.includes(accountType)
    const isStrategyType = strategyAccountTypes.includes(accountType)

    /*
    var roleStyle = 0
    if(["AccountV3", "BlastooorGenesisAgentAccount"].includes(accountType)) {
      roleStyle = 1
    } else if(["BlastooorStrategyAccountBase", "BlastooorStrategyAgentAccount"].includes(accountType)) {
      roleStyle = 2
    }
    */

    describe(`account type ${accountType}`, function () {
      let agentID = 1;
      let agentIDotherChain = 2;
      let agentIDlocked1 = 3;
      let agentIDlocked2 = 4;
      let agentIDblastable = 5;
      let agentIDnested1 = 6;
      let agentIDnested2 = 7;
      let agentIDnested3 = 8;
      let agentIDdne= 99999;

      let salt = toBytes32(0);

      describe("setup", function () {
        it("can deploy ERC721", async function () {
          agentNft = await deployContract(deployer, "MockERC721", ["HolderERC721", "HODL"]) as MockERC721;
          await expectDeployed(agentNft.address);
        });
        it("cannot deploy account implementation with zero address entryPoint", async function () {
          if(accountType == "AccountV3") {
            await expect(deployContract(deployer, "AccountV3", [AddressZero, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero])).to.be.reverted
          }
          else if(accountType == "BlastooorGenesisAgentAccount") {
            await expect(deployContract(deployer, "BlastooorGenesisAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, AddressZero, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero])).to.be.reverted
          }
          else if(accountType == "BlastooorStrategyAccountBase") {
            await expect(deployContract(deployer, "BlastooorStrategyAccountBase", [AddressZero, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero])).to.be.reverted
          }
          else if(accountType == "BlastooorStrategyAgentAccount") {
            await expect(deployContract(deployer, "BlastooorStrategyAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, AddressZero, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero])).to.be.reverted
          }
          else {
            throw new Error(`account type ${accountType} unknown`)
          }
        })
        it("cannot deploy account implementation with zero address erc6551Registry", async function () {
          if(accountType == "AccountV3") {
            await expect(deployContract(deployer, "AccountV3", [ENTRY_POINT_ADDRESS, multicallForwarder.address, AddressZero, AddressZero])).to.be.reverted
          }
          else if(accountType == "BlastooorGenesisAgentAccount") {
            await expect(deployContract(deployer, "BlastooorGenesisAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, multicallForwarder.address, AddressZero, AddressZero])).to.be.reverted
          }
          else if(accountType == "BlastooorStrategyAccountBase") {
            await expect(deployContract(deployer, "BlastooorStrategyAccountBase", [ENTRY_POINT_ADDRESS, multicallForwarder.address, AddressZero, AddressZero])).to.be.reverted
          }
          else if(accountType == "BlastooorStrategyAgentAccount") {
            await expect(deployContract(deployer, "BlastooorStrategyAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, multicallForwarder.address, AddressZero, AddressZero])).to.be.reverted
          }
          else {
            throw new Error(`account type ${accountType} unknown`)
          }
        })
        it("cannot deploy account implementation with zero address multicallForwarder", async function () {
          if(accountType == "AccountV3") {
            await expect(deployContract(deployer, "AccountV3", [ENTRY_POINT_ADDRESS, AddressZero, ERC6551_REGISTRY_ADDRESS, AddressZero])).to.be.reverted
          }
          else if(accountType == "BlastooorGenesisAgentAccount") {
            await expect(deployContract(deployer, "BlastooorGenesisAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, AddressZero, ERC6551_REGISTRY_ADDRESS, AddressZero])).to.be.reverted
          }
          else if(accountType == "BlastooorStrategyAccountBase") {
            await expect(deployContract(deployer, "BlastooorStrategyAccountBase", [ENTRY_POINT_ADDRESS, AddressZero, ERC6551_REGISTRY_ADDRESS, AddressZero])).to.be.reverted
          }
          else if(accountType == "BlastooorStrategyAgentAccount") {
            await expect(deployContract(deployer, "BlastooorStrategyAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, AddressZero, ERC6551_REGISTRY_ADDRESS, AddressZero])).to.be.reverted
          }
          else {
            throw new Error(`account type ${accountType} unknown`)
          }
        })
        it("can deploy account implementation", async function () {
          if(accountType == "AccountV3") {
            erc6551AccountImplementation = await deployContract(deployer, "AccountV3", [ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero]) as AccountV3;
          }
          else if(accountType == "BlastooorGenesisAgentAccount") {
            erc6551AccountImplementation = await deployContract(deployer, "BlastooorGenesisAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero]) as BlastooorGenesisAgentAccount;
          }
          else if(accountType == "BlastooorStrategyAccountBase") {
            erc6551AccountImplementation = await deployContract(deployer, "BlastooorStrategyAccountBase", [ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero]) as BlastooorStrategyAccountBase;
          }
          else if(accountType == "BlastooorStrategyAgentAccount") {
            erc6551AccountImplementation = await deployContract(deployer, "BlastooorStrategyAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero]) as BlastooorGenesisAgentAccount;
          }
          else {
            throw new Error(`account type ${accountType} unknown`)
          }

          await expectDeployed(erc6551AccountImplementation.address);
          calcSighashes(erc6551AccountImplementation, accountType, true)
        });
        it("implementation begins with null state", async function () {
          // these read from code - and since its not erc1167, it reads incorrectly and reverts
          await expect(erc6551AccountImplementation.owner()).to.be.reverted;
          await expect(erc6551AccountImplementation.token()).to.be.reverted;
          await expect(erc6551AccountImplementation.isValidSigner(user1.address, "0x")).to.be.reverted;
          await expect(erc6551AccountImplementation.isValidSigner(AddressZero, "0x")).to.be.reverted;
          await expect(erc6551AccountImplementation.isValidSignature(toBytes32(0), "0x")).to.be.reverted;
          // default values
          expect(await erc6551AccountImplementation.state()).eq(0);
          //expect(await erc6551AccountImplementation.supportsInterface("0x01ffc9a7")).eq(true);
          //expect(await erc6551AccountImplementation.supportsInterface("0x6faff5f1")).eq(true);
          //expect(await erc6551AccountImplementation.supportsInterface("0x51945447")).eq(true);
          //expect(await erc6551AccountImplementation.supportsInterface("0xffffffff")).eq(false);
          //expect(await erc6551AccountImplementation.supportsInterface("0x00000000")).eq(false);
        });
      })

      describe("account creation and registration", function () {

        it("mint erc721", async function () {
          expect(await agentNft.balanceOf(user1.address)).eq(0);
          await agentNft.mint(user1.address, agentID);
          expect(await agentNft.balanceOf(user1.address)).eq(1);
        });
        it("can create account and register", async function () {
          // initially unregistered. predict address
          let predictedAddress = await erc6551Registry.account(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentID);
          expect(predictedAddress).not.eq(AddressZero);
          let isDeployed1 = await isDeployed(predictedAddress)
          expect(isDeployed1).to.be.false;
          // create account and register
          let predictedAddress2 = await erc6551Registry.callStatic.createAccount(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentID);
          expect(predictedAddress).eq(predictedAddress2);
          let tx = await erc6551Registry.createAccount(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentID);
          let isDeployed2 = await isDeployed(predictedAddress)
          expect(isDeployed2).to.be.true;
          erc6551Account1 = await ethers.getContractAt(accountType, predictedAddress)
          l1DataFeeAnalyzer.register("registry.createAccount", tx);
        });
        it("account begins with state", async function () {
          expect(await erc6551Account1.owner()).eq(user1.address);
          let tokenRes = await erc6551Account1.token();
          expect(tokenRes.chainId).eq(chainID);
          expect(tokenRes.tokenContract).eq(agentNft.address);
          expect(tokenRes.tokenId).eq(agentID);
          expect(await erc6551Account1.state()).eq(0);
          expect(await erc6551Account1.isValidSigner(user1.address, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          expect(await erc6551Account1.isValidSigner(user1.address, "0x00abcd")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          expect(await erc6551Account1.isValidSigner(user2.address, "0x")).eq(MAGIC_VALUE_0);
          expect(await erc6551Account1.isValidSigner(AddressZero, "0x")).eq(MAGIC_VALUE_0);
          //expect(await erc6551Account1.isValidSignature(toBytes32(0), "0x")).eq(MAGIC_VALUE_0);
          await expect(erc6551Account1.isValidSignature(toBytes32(0), "0x")).to.be.reverted;
          expect(await erc6551Account1.supportsInterface("0x01ffc9a7")).eq(true);
          expect(await erc6551Account1.supportsInterface("0x6faff5f1")).eq(true);
          expect(await erc6551Account1.supportsInterface("0x51945447")).eq(true);
          expect(await erc6551Account1.supportsInterface("0xffffffff")).eq(false);
          expect(await erc6551Account1.supportsInterface("0x00000000")).eq(false);
          if(isBlastableType) {
            expect(await erc6551Account1.getGuardian()).eq(AddressZero);
            expect(await erc6551Account1.getAgentAccountImplementation()).eq(erc6551AccountImplementation.address);
          }
        });
        it("account with nft on other chain has no owner on this chain", async function () {
          let chainId2 = 9999;
          let predictedAddress = await erc6551Registry.account(erc6551AccountImplementation.address, salt, chainId2, agentNft.address, agentIDotherChain);
          let tx = await erc6551Registry.createAccount(erc6551AccountImplementation.address, salt, chainId2, agentNft.address, agentIDotherChain);
          erc6551Account2 = await ethers.getContractAt(accountType, predictedAddress)

          expect(await erc6551Account2.owner()).eq(AddressZero);
          let tokenRes = await erc6551Account2.token();
          expect(tokenRes.chainId).eq(chainId2);
          expect(tokenRes.tokenContract).eq(agentNft.address);
          expect(tokenRes.tokenId).eq(agentIDotherChain);
          expect(await erc6551Account2.state()).eq(0);
          expect(await erc6551Account2.isValidSigner(AddressZero, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          expect(await erc6551Account2.isValidSigner(user1.address, "0x")).eq(MAGIC_VALUE_0);
          expect(await erc6551Account2.isValidSigner(user1.address, "0x00abcd")).eq(MAGIC_VALUE_0);
          expect(await erc6551Account2.isValidSigner(user2.address, "0x")).eq(MAGIC_VALUE_0);
          //expect(await erc6551Account2.isValidSignature(toBytes32(0), "0x")).eq(MAGIC_VALUE_0);
          await expect(erc6551Account2.isValidSignature(toBytes32(0), "0x")).to.be.reverted;
          expect(await erc6551Account2.supportsInterface("0x01ffc9a7")).eq(true);
          expect(await erc6551Account2.supportsInterface("0x6faff5f1")).eq(true);
          expect(await erc6551Account2.supportsInterface("0x51945447")).eq(true);
          expect(await erc6551Account2.supportsInterface("0xffffffff")).eq(false);
          expect(await erc6551Account2.supportsInterface("0x00000000")).eq(false);
          l1DataFeeAnalyzer.register("registry.createAccount", tx);
        });
        it("can create account with no token contract", async function () {
          // initially unregistered. predict address
          let predictedAddress = await erc6551Registry.account(erc6551AccountImplementation.address, salt, chainID, user3.address, agentID);
          expect(predictedAddress).not.eq(AddressZero);
          let isDeployed1 = await isDeployed(predictedAddress)
          expect(isDeployed1).to.be.false;
          // create account and register
          let predictedAddress2 = await erc6551Registry.callStatic.createAccount(erc6551AccountImplementation.address, salt, chainID, user3.address, agentID);
          expect(predictedAddress).eq(predictedAddress2);
          let tx = await erc6551Registry.createAccount(erc6551AccountImplementation.address, salt, chainID, user3.address, agentID);
          let isDeployed2 = await isDeployed(predictedAddress)
          expect(isDeployed2).to.be.true;
          erc6551AccountNoContract = await ethers.getContractAt(accountType, predictedAddress)
          l1DataFeeAnalyzer.register("registry.createAccount", tx);

          expect(await erc6551AccountNoContract.owner()).eq(AddressZero);
          let tokenRes = await erc6551AccountNoContract.token();
          expect(tokenRes.chainId).eq(chainID);
          expect(tokenRes.tokenContract).eq(user3.address);
          expect(tokenRes.tokenId).eq(agentID);
          expect(await erc6551AccountNoContract.state()).eq(0);
          expect(await erc6551AccountNoContract.isValidSigner(user1.address, "0x")).eq(MAGIC_VALUE_0);
          expect(await erc6551AccountNoContract.isValidSigner(user1.address, "0x00abcd")).eq(MAGIC_VALUE_0);
          expect(await erc6551AccountNoContract.isValidSigner(user2.address, "0x")).eq(MAGIC_VALUE_0);
          expect(await erc6551AccountNoContract.isValidSigner(AddressZero, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          //expect(await erc6551AccountNoContract.isValidSignature(toBytes32(0), "0x")).eq(MAGIC_VALUE_0);
          await expect(erc6551AccountNoContract.isValidSignature(toBytes32(0), "0x")).to.be.reverted;
          expect(await erc6551AccountNoContract.supportsInterface("0x01ffc9a7")).eq(true);
          expect(await erc6551AccountNoContract.supportsInterface("0x6faff5f1")).eq(true);
          expect(await erc6551AccountNoContract.supportsInterface("0x51945447")).eq(true);
          expect(await erc6551AccountNoContract.supportsInterface("0xffffffff")).eq(false);
          expect(await erc6551AccountNoContract.supportsInterface("0x00000000")).eq(false);
          if(isBlastableType) {
            expect(await erc6551AccountNoContract.getGuardian()).eq(AddressZero);
            expect(await erc6551AccountNoContract.getAgentAccountImplementation()).eq(erc6551AccountImplementation.address);
          }
        });
        it("can create account with no token", async function () {
          // initially unregistered. predict address
          let predictedAddress = await erc6551Registry.account(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentIDdne);
          expect(predictedAddress).not.eq(AddressZero);
          let isDeployed1 = await isDeployed(predictedAddress)
          expect(isDeployed1).to.be.false;
          // create account and register
          let predictedAddress2 = await erc6551Registry.callStatic.createAccount(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentIDdne);
          expect(predictedAddress).eq(predictedAddress2);
          let tx = await erc6551Registry.createAccount(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentIDdne);
          let isDeployed2 = await isDeployed(predictedAddress)
          expect(isDeployed2).to.be.true;
          erc6551AccountNoToken = await ethers.getContractAt(accountType, predictedAddress)
          l1DataFeeAnalyzer.register("registry.createAccount", tx);

          expect(await erc6551AccountNoToken.owner()).eq(AddressZero);
          let tokenRes = await erc6551AccountNoToken.token();
          expect(tokenRes.chainId).eq(chainID);
          expect(tokenRes.tokenContract).eq(agentNft.address);
          expect(tokenRes.tokenId).eq(agentIDdne);
          expect(await erc6551AccountNoToken.state()).eq(0);
          expect(await erc6551AccountNoToken.isValidSigner(user1.address, "0x")).eq(MAGIC_VALUE_0);
          expect(await erc6551AccountNoToken.isValidSigner(user1.address, "0x00abcd")).eq(MAGIC_VALUE_0);
          expect(await erc6551AccountNoToken.isValidSigner(user2.address, "0x")).eq(MAGIC_VALUE_0);
          expect(await erc6551AccountNoToken.isValidSigner(AddressZero, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          //expect(await erc6551AccountNoToken.isValidSignature(toBytes32(0), "0x")).eq(MAGIC_VALUE_0);
          await expect(erc6551AccountNoToken.isValidSignature(toBytes32(0), "0x")).to.be.reverted;
          expect(await erc6551AccountNoToken.supportsInterface("0x01ffc9a7")).eq(true);
          expect(await erc6551AccountNoToken.supportsInterface("0x6faff5f1")).eq(true);
          expect(await erc6551AccountNoToken.supportsInterface("0x51945447")).eq(true);
          expect(await erc6551AccountNoToken.supportsInterface("0xffffffff")).eq(false);
          expect(await erc6551AccountNoToken.supportsInterface("0x00000000")).eq(false);
          if(isBlastableType) {
            expect(await erc6551AccountNoToken.getGuardian()).eq(AddressZero);
            expect(await erc6551AccountNoToken.getAgentAccountImplementation()).eq(erc6551AccountImplementation.address);
          }
        });
      });

      describe("account lock", function () {
        it("mint erc721", async function () {
          await agentNft.mint(user1.address, agentIDlocked1);
          await agentNft.mint(user1.address, agentIDlocked2);
        });
        it("can create account and register 1", async function () {
          // initially unregistered. predict address
          let predictedAddress = await erc6551Registry.account(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentIDlocked1);
          expect(predictedAddress).not.eq(AddressZero);
          let isDeployed1 = await isDeployed(predictedAddress)
          expect(isDeployed1).to.be.false;
          // create account and register
          let predictedAddress2 = await erc6551Registry.callStatic.createAccount(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentIDlocked1);
          expect(predictedAddress).eq(predictedAddress2);
          let tx = await erc6551Registry.createAccount(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentIDlocked1);
          let isDeployed2 = await isDeployed(predictedAddress)
          expect(isDeployed2).to.be.true;
          erc6551AccountLocked1 = await ethers.getContractAt(accountType, predictedAddress)
          l1DataFeeAnalyzer.register("registry.createAccount", tx);
        });
        it("can create account and register 2", async function () {
          // initially unregistered. predict address
          let predictedAddress = await erc6551Registry.account(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentIDlocked2);
          expect(predictedAddress).not.eq(AddressZero);
          let isDeployed1 = await isDeployed(predictedAddress)
          expect(isDeployed1).to.be.false;
          // create account and register
          let predictedAddress2 = await erc6551Registry.callStatic.createAccount(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentIDlocked2);
          expect(predictedAddress).eq(predictedAddress2);
          let tx = await erc6551Registry.createAccount(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentIDlocked2);
          let isDeployed2 = await isDeployed(predictedAddress)
          expect(isDeployed2).to.be.true;
          erc6551AccountLocked2 = await ethers.getContractAt(accountType, predictedAddress)
          l1DataFeeAnalyzer.register("registry.createAccount", tx);
        });
        it("begins unlocked", async function () {
          expect(await erc6551AccountLocked1.isLocked()).eq(false)
          expect(await erc6551AccountLocked2.isLocked()).eq(false)
          expect(await erc6551AccountLocked1.lockedUntil()).eq(0)
          expect(await erc6551AccountLocked2.lockedUntil()).eq(0)
        });
        it("can do things while unlocked", async function () {
          await expect(erc6551AccountLocked1.connect(user1).execute(user1.address, 0, "0x", 0)).to.not.be.reverted
          await expect(erc6551AccountLocked1.connect(user1).executeBatch([])).to.not.be.reverted
          await expect(erc6551AccountLocked1.connect(user1).lock(0)).to.not.be.reverted
          await expect(erc6551AccountLocked1.connect(user1).setPermissions([],[])).to.not.be.reverted
          if(isBlastableType) {
            //await expect(erc6551AccountLocked1.connect(user1).blastConfigure()).to.not.be.reverted
            await expect(erc6551AccountLocked1.connect(user1).setRoles([])).to.not.be.reverted
            // reverts with different error because we're running on forked network. "must withdraw non-zero amount"
            //await expect(erc6551AccountLocked1.connect(user1).claimMaxGas()).to.not.be.reverted
            //await expect(erc6551AccountLocked1.connect(user1).claimAllGas()).to.not.be.reverted
            try { await erc6551AccountLocked1.connect(user1).claimMaxGas() } catch(e) {}
            try { await erc6551AccountLocked1.connect(user1).claimAllGas() } catch(e) {}
          }
          if(isGenesisType) {
            await expect(erc6551AccountLocked1.connect(user1).setOverrides([],[])).to.not.be.reverted
          }
          else if(accountType == "BlastooorStrategyAgentAccount") {
            await expect(erc6551AccountLocked1.connect(user1).setOverrides([])).to.not.be.reverted
          }
        });
        it("non owner cannot lock", async function () {
          await expect(erc6551AccountLocked1.connect(user2).lock(1)).to.be.revertedWithCustomError(erc6551AccountLocked1, "NotAuthorized")
          await expect(erc6551AccountLocked2.connect(user2).lock(1)).to.be.revertedWithCustomError(erc6551AccountLocked2, "NotAuthorized")
        });
        it("cannot lock if no token", async function () {
          await expect(erc6551AccountNoToken.connect(user2).lock(1)).to.be.revertedWithCustomError(erc6551AccountLocked1, "NotAuthorized")
          await expect(erc6551AccountNoContract.connect(user2).lock(1)).to.be.revertedWithCustomError(erc6551AccountLocked2, "NotAuthorized")
        });
        it("cannot lock for excessive duration", async function () {
          let block = await provider.getBlock()
          const ONE_YEAR = 60 * 60 * 24 * 365;
          let lockTime = block.timestamp + ONE_YEAR * 2

          await expect(erc6551AccountLocked1.connect(user1).lock(lockTime)).to.be.revertedWithCustomError(erc6551AccountLocked1, "ExceedsMaxLockTime")
          await expect(erc6551AccountLocked2.connect(user1).lock(lockTime)).to.be.revertedWithCustomError(erc6551AccountLocked2, "ExceedsMaxLockTime")
        });
        it("can lock for short period", async function () {
          let block = await provider.getBlock()
          let lockTime = block.timestamp + 15
          let tx = await erc6551AccountLocked1.connect(user1).lock(lockTime)
          await expect(tx).to.emit(erc6551AccountLocked1, "LockUpdated").withArgs(lockTime)
          expect(await erc6551AccountLocked1.isLocked()).eq(true)
          expect(await erc6551AccountLocked1.lockedUntil()).eq(lockTime)
        });
        it("cannot do things while locked", async function () {
          await expect(erc6551AccountLocked1.connect(user1).execute(user1.address, 0, "0x", 0)).to.be.revertedWithCustomError(erc6551AccountLocked1, "AccountLocked")
          await expect(erc6551AccountLocked1.connect(user1).executeBatch([])).to.be.revertedWithCustomError(erc6551AccountLocked1, "AccountLocked")
          await expect(erc6551AccountLocked1.connect(user1).lock(0)).to.be.revertedWithCustomError(erc6551AccountLocked1, "AccountLocked")
          await expect(erc6551AccountLocked1.connect(user1).setPermissions([],[])).to.be.revertedWithCustomError(erc6551AccountLocked1, "AccountLocked")
          if(isBlastableType) {
            await expect(erc6551AccountLocked1.connect(user1).blastConfigure()).to.be.revertedWithCustomError(erc6551AccountLocked1, "AccountLocked")
            await expect(erc6551AccountLocked1.connect(user1).setRoles([])).to.be.revertedWithCustomError(erc6551AccountLocked1, "AccountLocked")
            await expect(erc6551AccountLocked1.connect(user1).claimMaxGas()).to.be.revertedWithCustomError(erc6551AccountLocked1, "AccountLocked")
            await expect(erc6551AccountLocked1.connect(user1).claimAllGas()).to.be.revertedWithCustomError(erc6551AccountLocked1, "AccountLocked")
          }
          if(isGenesisType) {
            await expect(erc6551AccountLocked1.connect(user1).setOverrides([],[])).to.be.revertedWithCustomError(erc6551AccountLocked1, "AccountLocked")
          }
          else if(accountType == "BlastooorStrategyAgentAccount") {
            await expect(erc6551AccountLocked1.connect(user1).setOverrides([])).to.be.revertedWithCustomError(erc6551AccountLocked1, "AccountLocked")
          }
        });
        it("some functions dont need to be locked", async function () {
          // these have no effect so no worry about lock
          if(isBlastableType) {
            // reverts with different error because we're running on forked network. "must withdraw non-zero amount"
            try { await erc6551AccountLocked1.connect(user1).quoteClaimAllGas() } catch(e) {}
            try { await erc6551AccountLocked1.connect(user1).quoteClaimMaxGas() } catch(e) {}
            try { await erc6551AccountLocked1.connect(user1).quoteClaimAllGasWithRevert() } catch(e) {}
            try { await erc6551AccountLocked1.connect(user1).quoteClaimMaxGasWithRevert() } catch(e) {}
          }
        });
        it("can do things after lock expires", async function () {
          for(let i = 0; i < 20; ++i) {
            await user1.sendTransaction({to:user2.address})
          }
          expect(await erc6551AccountLocked1.isLocked()).eq(false)

          await expect(erc6551AccountLocked1.connect(user1).execute(user1.address, 0, "0x", 0)).to.not.be.reverted
          await expect(erc6551AccountLocked1.connect(user1).executeBatch([])).to.not.be.reverted
          await expect(erc6551AccountLocked1.connect(user1).lock(0)).to.not.be.reverted
          await expect(erc6551AccountLocked1.connect(user1).setPermissions([],[])).to.not.be.reverted
          if(isBlastableType) {
            await expect(erc6551AccountLocked1.connect(user1).blastConfigure()).to.not.be.reverted
            await expect(erc6551AccountLocked1.connect(user1).setRoles([])).to.not.be.reverted
            // reverts with different error because we're running on forked network. "must withdraw non-zero amount"
            try { await erc6551AccountLocked1.connect(user1).claimMaxGas() } catch(e) {}
            try { await erc6551AccountLocked1.connect(user1).claimAllGas() } catch(e) {}
          }
          if(isGenesisType) {
            await expect(erc6551AccountLocked1.connect(user1).setOverrides([],[])).to.not.be.reverted
          }
          else if(accountType == "BlastooorStrategyAgentAccount") {
            await expect(erc6551AccountLocked1.connect(user1).setOverrides([])).to.not.be.reverted
          }
        });
        it("can lock for months", async function () {
          let block = await provider.getBlock()
          let lockTime = block.timestamp + 60 * 60 * 24 * 30 * 3
          let tx = await erc6551AccountLocked2.connect(user1).lock(lockTime)
          await expect(tx).to.emit(erc6551AccountLocked2, "LockUpdated").withArgs(lockTime)
          expect(await erc6551AccountLocked2.isLocked()).eq(true)
          expect(await erc6551AccountLocked2.lockedUntil()).eq(lockTime)
        });
      })

      describe("account receiving", function () {
        it("can receive ETH", async function () {
          let bal1 = await provider.getBalance(erc6551Account1.address);
          expect(bal1).eq(0);
          await user1.sendTransaction({
            to: erc6551Account1.address,
            value: 0,
            data: "0x"
          });
          let bal2 = await provider.getBalance(erc6551Account1.address);
          expect(bal2).eq(0);
          let transferAmount = WeiPerEther.mul(10);
          await user1.sendTransaction({
            to: erc6551Account1.address,
            value: transferAmount,
            data: "0x"
          });
          let bal3 = await provider.getBalance(erc6551Account1.address);
          expect(bal3).eq(transferAmount);
        });
        it("can receive ETH via fallback", async function () {
          let bal1 = await provider.getBalance(erc6551Account1.address);
          await user1.sendTransaction({
            to: erc6551Account1.address,
            value: 0,
            data: "0xabcd"
          });
          let bal2 = await provider.getBalance(erc6551Account1.address);
          expect(bal2).eq(bal1);
          let transferAmount = WeiPerEther.mul(15);
          await user1.sendTransaction({
            to: erc6551Account1.address,
            value: transferAmount,
            data: "0xdeff"
          });
          let bal3 = await provider.getBalance(erc6551Account1.address);
          expect(bal3).eq(transferAmount.add(bal2));
        });
        it("can receive ERC20", async function () {
          let bal1 = await erc20.balanceOf(erc6551Account1.address);
          expect(bal1).eq(0);
          await erc20.mint(user1.address, WeiPerEther.mul(1000));
          let transferAmount = WeiPerEther.mul(800);
          await erc20.connect(user1).transfer(erc6551Account1.address, transferAmount);
          let bal2 = await erc20.balanceOf(erc6551Account1.address);
          expect(bal2).eq(transferAmount);
        });
        it("can receive ERC721", async function () {
          // mint
          erc721Asset = await deployContract(deployer, "MockERC721", ["AssetERC721", "ASS"]) as MockERC721;
          await erc721Asset.mint(user1.address, 1);
          await erc721Asset.mint(user1.address, 2);
          expect(await erc721Asset.balanceOf(erc6551Account1.address)).eq(0);
          expect(await erc721Asset.ownerOf(1)).eq(user1.address);
          expect(await erc721Asset.ownerOf(2)).eq(user1.address);
          // transferFrom()
          await erc721Asset.connect(user1).transferFrom(user1.address, erc6551Account1.address, 1);
          expect(await erc721Asset.balanceOf(erc6551Account1.address)).eq(1);
          expect(await erc721Asset.ownerOf(1)).eq(erc6551Account1.address);
          // safeTransferFrom()
          await erc721Asset.connect(user1)['safeTransferFrom(address,address,uint256)'](user1.address, erc6551Account1.address, 2);
          expect(await erc721Asset.balanceOf(erc6551Account1.address)).eq(2);
          expect(await erc721Asset.ownerOf(2)).eq(erc6551Account1.address);
        });
        it("cannot transfer agent nft to agent account", async function () {
          // only handles ownership cycle if one layer deep. can be greater
          // only triggers on safeTransferFrom
          await expect(agentNft.connect(user1)['safeTransferFrom(address,address,uint256)'](user1.address, erc6551Account1.address, agentID)).to.be.revertedWithCustomError(erc6551Account1, "OwnershipCycle");
          await expect(agentNft.connect(user1)['safeTransferFrom(address,address,uint256,bytes)'](user1.address, erc6551Account1.address, agentID, "0x")).to.be.revertedWithCustomError(erc6551Account1, "OwnershipCycle");
        })
        it("can receive ERC1155", async function () {
          // mint
          let erc1155 = await deployContract(deployer, "MockERC1155", ["uri here"]) as MockERC1155;
          expect(await erc1155.balanceOf(erc6551Account1.address, 1)).eq(0);
          expect(await erc1155.balanceOf(user1.address, 1)).eq(0);
          expect(await erc1155.balanceOf(erc6551Account1.address, 2)).eq(0);
          expect(await erc1155.balanceOf(user1.address, 2)).eq(0);
          await erc1155.mint(user1.address, 1, 7, "0x");
          await erc1155.mint(user1.address, 2, 5, "0x");
          expect(await erc1155.balanceOf(erc6551Account1.address, 1)).eq(0);
          expect(await erc1155.balanceOf(user1.address, 1)).eq(7);
          expect(await erc1155.balanceOf(erc6551Account1.address, 2)).eq(0);
          expect(await erc1155.balanceOf(user1.address, 2)).eq(5);
          // safeTransferFrom
          await erc1155.connect(user1).safeTransferFrom(user1.address, erc6551Account1.address, 1, 1, "0x");
          expect(await erc1155.balanceOf(erc6551Account1.address, 1)).eq(1);
          expect(await erc1155.balanceOf(user1.address, 1)).eq(6);
          // safeBatchTransferFrom
          await erc1155.connect(user1).safeBatchTransferFrom(user1.address, erc6551Account1.address, [1,2], [4,3], "0x");
          expect(await erc1155.balanceOf(erc6551Account1.address, 1)).eq(5);
          expect(await erc1155.balanceOf(user1.address, 1)).eq(2);
          expect(await erc1155.balanceOf(erc6551Account1.address, 2)).eq(3);
          expect(await erc1155.balanceOf(user1.address, 2)).eq(2);
        });
      });

      describe("account execution", function () {
        it("non owner cannot execute", async function () {
          // no data
          await expect(erc6551Account1.connect(user2).execute(user2.address, 0, "0x", 0)).to.be.revertedWithCustomError(erc6551Account1, "NotAuthorized");
          // erc20 transfer
          let calldata = erc20.interface.encodeFunctionData("transfer", [user2.address, 0]);
          await expect(erc6551Account1.connect(user2).execute(erc20.address, 0, calldata, 0)).to.be.revertedWithCustomError(erc6551Account1, "NotAuthorized");
          // batch
          await expect(erc6551Account1.connect(user2).executeBatch([])).to.be.revertedWithCustomError(erc6551Account1, "NotAuthorized");
        });
        it("cannot execute if no token", async function () {
          await expect(erc6551AccountNoToken.connect(user2).execute(user2.address, 0, "0x", 0)).to.be.revertedWithCustomError(erc6551AccountLocked1, "NotAuthorized")
          await expect(erc6551AccountNoContract.connect(user2).execute(user2.address, 0, "0x", 0)).to.be.revertedWithCustomError(erc6551AccountLocked2, "NotAuthorized")
          await expect(erc6551AccountNoToken.connect(user2).executeBatch([])).to.be.revertedWithCustomError(erc6551AccountLocked1, "NotAuthorized")
          await expect(erc6551AccountNoContract.connect(user2).executeBatch([])).to.be.revertedWithCustomError(erc6551AccountLocked2, "NotAuthorized")
        });
        /*
        it("owner cannot execute not call", async function () {
          let calldata = erc20.interface.encodeFunctionData("transfer", [user2.address, 0]);
          await expect(erc6551Account1.connect(user1).execute(erc20.address, 0, calldata, 1)).to.be.revertedWithCustomError(erc6551Account1, "OnlyCallsAllowed");
          await expect(erc6551Account1.connect(user1).execute(erc20.address, 0, calldata, 2)).to.be.revertedWithCustomError(erc6551Account1, "OnlyCallsAllowed");
          await expect(erc6551Account1.connect(user1).execute(erc20.address, 0, calldata, 3)).to.be.revertedWithCustomError(erc6551Account1, "OnlyCallsAllowed");
        });
        */
        it("reverts unsuccessful call", async function () {
          await expect(erc6551Account1.connect(user1).execute(user2.address, WeiPerEther.mul(9999), "0x", 0)).to.be.reverted;
        });
        it("owner can send ETH", async function () {
          let state1 = await erc6551Account1.state();
          let bal1 = await provider.getBalance(user2.address);
          let transferAmount = WeiPerEther.div(3);
          let tx = await erc6551Account1.connect(user1).execute(user2.address, transferAmount, "0x", 0);
          let bal2 = await provider.getBalance(user2.address);
          expect(bal2.sub(bal1)).eq(transferAmount);
          let state2 = await erc6551Account1.state();
          expect(state2).not.eq(state1);
          l1DataFeeAnalyzer.register("execute transfer ETH", tx);
        });
        it("owner can send ERC20", async function () {
          let state1 = await erc6551Account1.state();
          let bal11 = await erc20.balanceOf(erc6551Account1.address);
          let bal12 = await erc20.balanceOf(user2.address);
          let transferAmount = WeiPerEther.mul(25);
          let calldata = erc20.interface.encodeFunctionData("transfer", [user2.address, transferAmount]);
          let tx = await erc6551Account1.connect(user1).execute(erc20.address, 0, calldata, 0);
          let bal21 = await erc20.balanceOf(erc6551Account1.address);
          let bal22 = await erc20.balanceOf(user2.address);
          expect(bal22.sub(bal12)).eq(transferAmount);
          expect(bal11.sub(bal21)).eq(transferAmount);
          let state2 = await erc6551Account1.state();
          expect(state2).not.eq(state1);
          l1DataFeeAnalyzer.register("execute transfer ERC20", tx);
        });
        it("owner can send ERC721", async function () {
          let state1 = await erc6551Account1.state();
          let assetTokenId = 2;
          expect(await erc721Asset.ownerOf(assetTokenId)).eq(erc6551Account1.address);
          let calldata = erc721Asset.interface.encodeFunctionData("transferFrom", [erc6551Account1.address, user2.address, assetTokenId]);
          let tx = await erc6551Account1.connect(user1).execute(erc721Asset.address, 0, calldata, 0);
          expect(await erc721Asset.ownerOf(assetTokenId)).eq(user2.address);
          let state2 = await erc6551Account1.state();
          expect(state2).not.eq(state1);
          l1DataFeeAnalyzer.register("execute transfer ERC721", tx);
        });
        it("owner can executeBatch()", async function () {
          let state1 = await erc6551Account1.state();
          let balEth1 = await provider.getBalance(user2.address);
          let transferAmountEth = WeiPerEther.div(3);
          let balErc11 = await erc20.balanceOf(erc6551Account1.address);
          let balErc12 = await erc20.balanceOf(user2.address);
          let transferAmountErc = WeiPerEther.mul(2);

          let batch = [
            {
              to: user2.address,
              value: transferAmountEth,
              data: "0x",
              operation: 0
            },
            {
              to: erc20.address,
              value: 0,
              data: erc20.interface.encodeFunctionData("transfer", [user2.address, transferAmountErc]),
              operation: 0,
            }
          ]
          let tx = await erc6551Account1.connect(user1).executeBatch(batch);

          let balEth2 = await provider.getBalance(user2.address);
          expect(balEth2.sub(balEth1)).eq(transferAmountEth);
          let balErc21 = await erc20.balanceOf(erc6551Account1.address);
          let balErc22 = await erc20.balanceOf(user2.address);
          expect(balErc22.sub(balErc12)).eq(transferAmountErc);
          expect(balErc11.sub(balErc21)).eq(transferAmountErc);
          let state2 = await erc6551Account1.state();
          expect(state2).not.eq(state1);
          l1DataFeeAnalyzer.register("execute batch", tx);
        });
        //it("owner can send ERC1155", async function () {});
        /*
        it("can multicall execute", async function () {
          let state1 = await erc6551Account1.state();
          let ethBal11 = await provider.getBalance(erc6551Account1.address);
          let ethBal12 = await provider.getBalance(user2.address);
          let erc20Bal11 = await erc20.balanceOf(erc6551Account1.address);
          let erc20Bal12 = await erc20.balanceOf(user2.address);
          let ethTransferAmount = WeiPerEther.div(25);
          let erc20TransferAmount = WeiPerEther.mul(500);
          let txdata0 = erc6551Account1.interface.encodeFunctionData("execute", [user2.address, ethTransferAmount, "0x", 0])
          let erc20Calldata = erc20.interface.encodeFunctionData("transfer", [user2.address, erc20TransferAmount]);
          let txdata1 = erc6551Account1.interface.encodeFunctionData("execute", [erc20.address, 0, erc20Calldata, 0]);
          let txdatas = [txdata0, txdata1];
          let tx = await erc6551Account1.connect(user1).multicall(txdatas);
          let ethBal21 = await provider.getBalance(erc6551Account1.address);
          let ethBal22 = await provider.getBalance(user2.address);
          let erc20Bal21 = await erc20.balanceOf(erc6551Account1.address);
          let erc20Bal22 = await erc20.balanceOf(user2.address);
          expect(ethBal22.sub(ethBal12)).eq(ethTransferAmount);
          expect(ethBal11.sub(ethBal21)).eq(ethTransferAmount);
          expect(erc20Bal22.sub(erc20Bal12)).eq(erc20TransferAmount);
          expect(erc20Bal11.sub(erc20Bal21)).eq(erc20TransferAmount);
          let state2 = await erc6551Account1.state();
          expect(state2.sub(state1)).eq(2);
          l1DataFeeAnalyzer.register("execute multicall", tx);
        });
        */
        it("is payable", async function () {
          let state1 = await erc6551Account1.state();
          let ethBal11 = await provider.getBalance(erc6551Account1.address);
          let ethPayableAmount = WeiPerEther.mul(3);
          let tx = await erc6551Account1.connect(user1).execute(user2.address, 0, "0x", 0, {value: ethPayableAmount});
          let ethBal21 = await provider.getBalance(erc6551Account1.address);
          expect(ethBal21.sub(ethBal11)).eq(ethPayableAmount);
          let state2 = await erc6551Account1.state();
          expect(state2).not.eq(state1);
          l1DataFeeAnalyzer.register("execute payable", tx);
        });
        it("is reenterable", async function () {
          let state1 = await erc6551Account1.state();
          let ethBal11 = await provider.getBalance(erc6551Account1.address);
          let ethPayableAmount = WeiPerEther.mul(4);
          let tx = await erc6551Account1.connect(user1).execute(erc6551Account1.address, 0, "0x", 0, {value: ethPayableAmount});
          let ethBal21 = await provider.getBalance(erc6551Account1.address);
          expect(ethBal21.sub(ethBal11)).eq(ethPayableAmount);
          let state2 = await erc6551Account1.state();
          expect(state2).not.eq(state1);
          l1DataFeeAnalyzer.register("execute reenterable", tx);
        });
      });

      describe("account ownership", function () {
        it("is tied to nft owner", async function () {
          expect(await agentNft.ownerOf(agentID)).eq(user1.address);
          expect(await erc6551Account1.owner()).eq(user1.address);
          await agentNft.connect(user1).transferFrom(user1.address, user2.address, agentID);
          expect(await agentNft.ownerOf(agentID)).eq(user2.address);
          expect(await erc6551Account1.owner()).eq(user2.address);
        });
        it("old owner cannot execute", async function () {
          await expect(erc6551Account1.connect(user1).execute(user1.address, 0, "0x", 0)).to.be.revertedWithCustomError(erc6551Account1, "NotAuthorized");
        });
        it("new owner can execute", async function () {
          let state1 = await erc6551Account1.state();
          await erc6551Account1.connect(user2).execute(user3.address, WeiPerEther.mul(2), "0x", 0);
          let state2 = await erc6551Account1.state();
          expect(state2).not.eq(state1);
        });
      });

      if(isBlastableType) {
        describe("blastConfigure()", function () {
          let erc6551AccountBlastable:any;

          it("can blastConfigure 1", async function () {
            //console.log('configure 1')
            await expect(erc6551Account1.connect(user2).blastConfigure()).to.not.be.reverted
            //console.log('configure 2')
            await expect(erc6551Account1.connect(user2).blastConfigure()).to.not.be.reverted
            //console.log('configure 3')
          })
          // todo: figure out why this test takes so long to run. 22 seconds ??? but passes
          // took a long time due to infinite loop finding owner
          it("cannot blastConfigure by non owner", async function () {
            //console.log('here 1')
            //let time1 = new Date().valueOf()
            await expect(erc6551Account1.connect(user3).blastConfigure()).to.be.reverted
            //let time2 = new Date().valueOf()
            //console.log('here 2')
            //console.log(`elapsed time: ${(time2-time1)/1000} s`)
          })

          it("can deploy implementation with zero address points operator", async function () {
            if(accountType == "BlastooorGenesisAgentAccount") {
              erc6551AccountImplementation2 = await deployContract(deployer, "BlastooorGenesisAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, AddressZero, ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero]) as BlastooorGenesisAgentAccount;
            }
            else if(accountType == "BlastooorStrategyAgentAccount") {
              erc6551AccountImplementation2 = await deployContract(deployer, "BlastooorStrategyAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, AddressZero, ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero]) as BlastooorGenesisAgentAccount;
            }
            else {
              throw new Error(`account type ${accountType} unknown`)
            }
          })
          it("mint erc721", async function () {
            await agentNft.mint(user1.address, agentIDblastable);
          });
          it("can deploy account", async function () {
            // initially unregistered. predict address
            let predictedAddress = await erc6551Registry.account(erc6551AccountImplementation2.address, salt, chainID, agentNft.address, agentIDblastable);
            expect(predictedAddress).not.eq(AddressZero);
            let isDeployed1 = await isDeployed(predictedAddress)
            expect(isDeployed1).to.be.false;
            // create account and register
            let predictedAddress2 = await erc6551Registry.callStatic.createAccount(erc6551AccountImplementation2.address, salt, chainID, agentNft.address, agentIDblastable);
            expect(predictedAddress).eq(predictedAddress2);
            let tx = await erc6551Registry.createAccount(erc6551AccountImplementation2.address, salt, chainID, agentNft.address, agentIDblastable);
            let isDeployed2 = await isDeployed(predictedAddress)
            expect(isDeployed2).to.be.true;
            erc6551AccountBlastable = await ethers.getContractAt(accountType, predictedAddress)
            l1DataFeeAnalyzer.register("registry.createAccount", tx);
          })
          it("can blastConfigure 2", async function () {
            await expect(erc6551AccountBlastable.connect(user1).blastConfigure()).to.not.be.reverted
            await expect(erc6551AccountBlastable.connect(user1).blastConfigure()).to.not.be.reverted
          })
        })
      }

      describe("nested accounts", function () {
        // create three agents such that agent1 owns agent2 and agent3
        // agent1 and agent2 have the same implementation contract
        // agent3 has a different implementation address, which will break the _rootTokenOwner() chain
        it("mint erc721 1", async function () {
          await agentNft.mint(user1.address, agentIDnested1);
        });
        it("can deploy account 1", async function () {
          // initially unregistered. predict address
          let predictedAddress = await erc6551Registry.account(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentIDnested1);
          expect(predictedAddress).not.eq(AddressZero);
          let isDeployed1 = await isDeployed(predictedAddress)
          expect(isDeployed1).to.be.false;
          // create account and register
          let predictedAddress2 = await erc6551Registry.callStatic.createAccount(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentIDnested1);
          expect(predictedAddress).eq(predictedAddress2);
          let tx = await erc6551Registry.createAccount(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentIDnested1);
          let isDeployed2 = await isDeployed(predictedAddress)
          expect(isDeployed2).to.be.true;
          erc6551AccountNested1 = await ethers.getContractAt(accountType, predictedAddress)
          l1DataFeeAnalyzer.register("registry.createAccount", tx);
        })
        it("mint erc721 2", async function () {
          await agentNft.mint(erc6551AccountNested1.address, agentIDnested2);
        });
        it("can deploy account 2", async function () {
          // initially unregistered. predict address
          let predictedAddress = await erc6551Registry.account(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentIDnested2);
          expect(predictedAddress).not.eq(AddressZero);
          let isDeployed1 = await isDeployed(predictedAddress)
          expect(isDeployed1).to.be.false;
          // create account and register
          let predictedAddress2 = await erc6551Registry.callStatic.createAccount(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentIDnested2);
          expect(predictedAddress).eq(predictedAddress2);
          let tx = await erc6551Registry.createAccount(erc6551AccountImplementation.address, salt, chainID, agentNft.address, agentIDnested2);
          let isDeployed2 = await isDeployed(predictedAddress)
          expect(isDeployed2).to.be.true;
          erc6551AccountNested2 = await ethers.getContractAt(accountType, predictedAddress)
          l1DataFeeAnalyzer.register("registry.createAccount", tx);
        })
        it("mint erc721 3", async function () {
          await agentNft.mint(erc6551AccountNested1.address, agentIDnested3);
        });
        it("can deploy alternate account implementation", async function () {
          if(accountType == "AccountV3") {
            erc6551AccountImplementation3 = await deployContract(deployer, "AccountV3", [ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero]) as AccountV3;
          }
          else if(accountType == "BlastooorGenesisAgentAccount") {
            erc6551AccountImplementation3 = await deployContract(deployer, "BlastooorGenesisAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero]) as BlastooorGenesisAgentAccount;
          }
          else if(accountType == "BlastooorStrategyAccountBase") {
            erc6551AccountImplementation3 = await deployContract(deployer, "BlastooorStrategyAccountBase", [ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero]) as BlastooorStrategyAccountBase;
          }
          else if(accountType == "BlastooorStrategyAgentAccount") {
            erc6551AccountImplementation3 = await deployContract(deployer, "BlastooorStrategyAgentAccount", [BLAST_ADDRESS, gasCollector.address, BLAST_POINTS_ADDRESS, BLAST_POINTS_OPERATOR_ADDRESS, ENTRY_POINT_ADDRESS, multicallForwarder.address, ERC6551_REGISTRY_ADDRESS, AddressZero]) as BlastooorGenesisAgentAccount;
          }
          else {
            throw new Error(`account type ${accountType} unknown`)
          }

          await expectDeployed(erc6551AccountImplementation3.address);
        });
        it("can deploy account 3", async function () {
          // initially unregistered. predict address
          let predictedAddress = await erc6551Registry.account(erc6551AccountImplementation3.address, salt, chainID, agentNft.address, agentIDnested3);
          expect(predictedAddress).not.eq(AddressZero);
          let isDeployed1 = await isDeployed(predictedAddress)
          expect(isDeployed1).to.be.false;
          // create account and register
          let predictedAddress2 = await erc6551Registry.callStatic.createAccount(erc6551AccountImplementation3.address, salt, chainID, agentNft.address, agentIDnested3);
          expect(predictedAddress).eq(predictedAddress2);
          let tx = await erc6551Registry.createAccount(erc6551AccountImplementation3.address, salt, chainID, agentNft.address, agentIDnested3);
          let isDeployed2 = await isDeployed(predictedAddress)
          expect(isDeployed2).to.be.true;
          erc6551AccountNested3 = await ethers.getContractAt(accountType, predictedAddress)
          l1DataFeeAnalyzer.register("registry.createAccount", tx);
        })


        it("root owner can sign on a nested account", async function () {
          expect(await erc6551AccountNested1.owner()).eq(user1.address);
          expect(await erc6551AccountNested2.owner()).eq(erc6551AccountNested1.address);
          expect(await erc6551AccountNested3.owner()).eq(erc6551AccountNested1.address);

          expect(await erc6551AccountNested1.isValidSigner(user1.address, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          expect(await erc6551AccountNested1.isValidSigner(user1.address, "0x00abcd")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          expect(await erc6551AccountNested1.isValidSigner(user2.address, "0x")).eq(MAGIC_VALUE_0);
          expect(await erc6551AccountNested1.isValidSigner(AddressZero, "0x")).eq(MAGIC_VALUE_0);

          expect(await erc6551AccountNested2.isValidSigner(user1.address, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          expect(await erc6551AccountNested2.isValidSigner(user1.address, "0x00abcd")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          expect(await erc6551AccountNested2.isValidSigner(user2.address, "0x")).eq(MAGIC_VALUE_0);
          expect(await erc6551AccountNested2.isValidSigner(AddressZero, "0x")).eq(MAGIC_VALUE_0);

          expect(await erc6551AccountNested3.isValidSigner(user1.address, "0x")).eq(MAGIC_VALUE_0);
          expect(await erc6551AccountNested3.isValidSigner(user1.address, "0x00abcd")).eq(MAGIC_VALUE_0);
          expect(await erc6551AccountNested3.isValidSigner(user2.address, "0x")).eq(MAGIC_VALUE_0);
          expect(await erc6551AccountNested3.isValidSigner(AddressZero, "0x")).eq(MAGIC_VALUE_0);

          //expect(await erc6551AccountNested1.isValidSignature(toBytes32(0), "0x")).eq(MAGIC_VALUE_0);
          await expect(erc6551AccountNested1.isValidSignature(toBytes32(0), "0x")).to.be.reverted;
          await expect(erc6551AccountNested2.isValidSignature(toBytes32(0), "0x")).to.be.reverted;
          await expect(erc6551AccountNested3.isValidSignature(toBytes32(0), "0x")).to.be.reverted;
        });

        it("root owner can execute on a nested account", async function () {
          await expect(erc6551AccountNested1.connect(user1).execute(user1.address, 0, "0x", 0)).to.not.be.reverted;
          await expect(erc6551AccountNested2.connect(user1).execute(user1.address, 0, "0x", 0)).to.not.be.reverted;
          await expect(erc6551AccountNested3.connect(user1).execute(user1.address, 0, "0x", 0)).to.be.revertedWithCustomError(erc6551AccountNested3, "NotAuthorized")
          await expect(erc6551AccountNested1.connect(user2).execute(user1.address, 0, "0x", 0)).to.be.revertedWithCustomError(erc6551AccountNested1, "NotAuthorized")
          await expect(erc6551AccountNested2.connect(user2).execute(user1.address, 0, "0x", 0)).to.be.revertedWithCustomError(erc6551AccountNested2, "NotAuthorized")
          await expect(erc6551AccountNested3.connect(user2).execute(user1.address, 0, "0x", 0)).to.be.revertedWithCustomError(erc6551AccountNested3, "NotAuthorized")
        });
        it("root owner can executeBatch on a nested account", async function () {
          let batch = [
            {
              to: user2.address,
              value: 0,
              data: "0x",
              operation: 0
            }
          ]
          await expect(erc6551AccountNested1.connect(user1).executeBatch([])).to.not.be.reverted;
          await expect(erc6551AccountNested2.connect(user1).executeBatch([])).to.not.be.reverted;
          await expect(erc6551AccountNested3.connect(user1).executeBatch([])).to.be.revertedWithCustomError(erc6551AccountNested3, "NotAuthorized")
          await expect(erc6551AccountNested1.connect(user2).executeBatch([])).to.be.revertedWithCustomError(erc6551AccountNested1, "NotAuthorized")
          await expect(erc6551AccountNested2.connect(user2).executeBatch([])).to.be.revertedWithCustomError(erc6551AccountNested2, "NotAuthorized")
          await expect(erc6551AccountNested3.connect(user2).executeBatch([])).to.be.revertedWithCustomError(erc6551AccountNested3, "NotAuthorized")
        });
        it("root owner can lock nested account", async function () {
          await expect(erc6551AccountNested1.connect(user1).lock(0)).to.not.be.reverted;
          await expect(erc6551AccountNested2.connect(user1).lock(0)).to.not.be.reverted;
          await expect(erc6551AccountNested3.connect(user1).lock(0)).to.be.revertedWithCustomError(erc6551AccountNested3, "NotAuthorized")
          await expect(erc6551AccountNested1.connect(user2).lock(0)).to.be.revertedWithCustomError(erc6551AccountNested1, "NotAuthorized")
          await expect(erc6551AccountNested2.connect(user2).lock(0)).to.be.revertedWithCustomError(erc6551AccountNested2, "NotAuthorized")
          await expect(erc6551AccountNested3.connect(user2).lock(0)).to.be.revertedWithCustomError(erc6551AccountNested3, "NotAuthorized")
        });
      })

      describe("isValidSignature", function () {
        it("it can isValidSignature on an erc1271", async function () {
          let tx1 = await agentNft.connect(user2).transferFrom(user2.address, mockERC1271.address, agentID);
          expect(await agentNft.ownerOf(agentID)).eq(mockERC1271.address)
          expect(await erc6551Account1['isValidSigner(address,bytes)'](user2.address, "0x")).eq(MAGIC_VALUE_0);
          expect(await erc6551Account1['isValidSigner(address,bytes)'](user2.address, "0x00abcd")).eq(MAGIC_VALUE_0);
          expect(await erc6551Account1['isValidSigner(address,bytes)'](mockERC1271.address, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          expect(await erc6551Account1['isValidSigner(address,bytes)'](mockERC1271.address, "0x00abcd")).eq(MAGIC_VALUE_IS_VALID_SIGNER);


          if(false) { // returns false in some cases
            expect(await erc6551Account1.isValidSignature(toBytes32(0), "0x")).eq(MAGIC_VALUE_0);
            expect(await erc6551Account1.isValidSignature(toBytes32(123), "0x9988776655")).eq(MAGIC_VALUE_0);
          } else { // hard fails in some cases
            await expect(erc6551Account1.isValidSignature(toBytes32(0), "0x")).to.be.reverted;
            await expect(erc6551Account1.isValidSignature(toBytes32(123), "0x9988776655")).to.be.reverted;
          }
          // passes valid signature
          var signature = createMockSignatureForContract(mockERC1271);
          expect(await erc6551Account1.isValidSignature(toBytes32(0), signature)).eq(MAGIC_VALUE_IS_VALID_SIGNATURE);
        })
        it("return nft", async function () {
          let calldata = agentNft.interface.encodeFunctionData("transferFrom", [mockERC1271.address, user2.address, agentID])
          await mockERC1271.externalCall(agentNft.address, calldata)
        })
      })

      describe("setPermissions", function () {
        it("non owner cannot set permissions", async function () {
          await expect(erc6551Account1.connect(user3).setPermissions([],[])).to.be.revertedWithCustomError(erc6551Account1, "NotAuthorized")
        })
        it("cannot set permissions if no token", async function () {
          await expect(erc6551AccountNoToken.connect(user2).setPermissions([],[])).to.be.revertedWithCustomError(erc6551AccountLocked1, "NotAuthorized")
          await expect(erc6551AccountNoContract.connect(user2).setPermissions([],[])).to.be.revertedWithCustomError(erc6551AccountLocked2, "NotAuthorized")
        });
        it("cannot set permissions with length mismatch", async function () {
          await expect(erc6551Account1.connect(user2).setPermissions([user2.address],[])).to.be.revertedWithCustomError(erc6551Account1, "InvalidInput")
        })
        it("owner can set permissions", async function () {
          let callers = [user4.address, user5.address]
          let permissions = [true, false]
          for(let i = 0; i < callers.length; ++i) {
            expect(await erc6551Account1.permissions(user2.address, callers[i])).eq(false)
          }
          let tx = await erc6551Account1.connect(user2).setPermissions(callers, permissions)
          for(let i = 0; i < callers.length; ++i) {
            expect(await erc6551Account1.permissions(user2.address, callers[i])).eq(permissions[i])
            await expect(tx).to.emit(erc6551Account1, "PermissionUpdated").withArgs(user2.address, callers[i], permissions[i]);
          }
        })
        it("root owner can set permissions", async function () {
          let callers = [user4.address, user5.address]
          let permissions = [true, false]
          for(let i = 0; i < callers.length; ++i) {
            expect(await erc6551AccountNested2.permissions(user1.address, callers[i])).eq(false)
          }
          let tx = await erc6551AccountNested2.connect(user1).setPermissions(callers, permissions)
          for(let i = 0; i < callers.length; ++i) {
            expect(await erc6551AccountNested2.permissions(user1.address, callers[i])).eq(permissions[i])
            await expect(tx).to.emit(erc6551AccountNested2, "PermissionUpdated").withArgs(user1.address, callers[i], permissions[i]);
          }
        })
        it("permissioned user can sign", async function () {
          expect(await erc6551Account1.owner()).eq(user2.address);
          expect(await erc6551AccountNested1.owner()).eq(user1.address);
          expect(await erc6551AccountNested2.owner()).eq(erc6551AccountNested1.address);
          expect(await erc6551AccountNested3.owner()).eq(erc6551AccountNested1.address);

          expect(await erc6551Account1.isValidSigner(user2.address, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          expect(await erc6551Account1.isValidSigner(user2.address, "0x00abcd")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          expect(await erc6551Account1.isValidSigner(user4.address, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          expect(await erc6551Account1.isValidSigner(user4.address, "0x00abcd")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          expect(await erc6551Account1.isValidSigner(user5.address, "0x")).eq(MAGIC_VALUE_0);
          expect(await erc6551Account1.isValidSigner(user3.address, "0x")).eq(MAGIC_VALUE_0);
          expect(await erc6551Account1.isValidSigner(AddressZero, "0x")).eq(MAGIC_VALUE_0);

          expect(await erc6551AccountNested2.isValidSigner(user1.address, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          expect(await erc6551AccountNested2.isValidSigner(user1.address, "0x00abcd")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          expect(await erc6551AccountNested2.isValidSigner(user4.address, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          expect(await erc6551AccountNested2.isValidSigner(user4.address, "0x00abcd")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
          expect(await erc6551AccountNested2.isValidSigner(user5.address, "0x")).eq(MAGIC_VALUE_0);
          expect(await erc6551AccountNested2.isValidSigner(user2.address, "0x")).eq(MAGIC_VALUE_0);
          expect(await erc6551AccountNested2.isValidSigner(AddressZero, "0x")).eq(MAGIC_VALUE_0);
        })
        it("permissioned user can execute", async function () {
          await erc6551Account1.connect(user4).execute(user4.address, 0, "0x", 0)
          await erc6551AccountNested2.connect(user4).execute(user4.address, 0, "0x", 0)
        })
        it("permissioned user can executeBatch", async function () {
          await erc6551Account1.connect(user4).executeBatch([])
          await erc6551AccountNested2.connect(user4).executeBatch([])
        })
      })

      if(accountType == "AccountV3" || accountType == "BlastooorGenesisAgentAccount") {
        describe("setOverrides 1", function () {
          it("non owner cannot set overrides", async function () {
            await expect(erc6551Account1.connect(user3).setOverrides([],[])).to.be.revertedWithCustomError(erc6551Account1, "NotAuthorized")
          })
          it("cannot set overrides if no token", async function () {
            await expect(erc6551AccountNoToken.connect(user2).setOverrides([],[])).to.be.revertedWithCustomError(erc6551AccountLocked1, "NotAuthorized")
            await expect(erc6551AccountNoContract.connect(user2).setOverrides([],[])).to.be.revertedWithCustomError(erc6551AccountLocked2, "NotAuthorized")
          });
          it("cannot set overrides with length mismatch", async function () {
            await expect(erc6551Account1.connect(user2).setOverrides([],[user2.address])).to.be.revertedWithCustomError(erc6551Account1, "InvalidInput")
          })
          it("owner can set overrides", async function () {
            let selectors = [testFunc1Sighash, testFunc2Sighash, testFunc3Sighash]
            let implementations = [test1Callee.address, test1Callee.address, user4.address]
            for(let i = 0; i < selectors.length; ++i) {
              expect(await erc6551Account1.overrides(user2.address, selectors[i])).eq(AddressZero)
            }
            let tx = await erc6551Account1.connect(user2).setOverrides(selectors, implementations)
            for(let i = 0; i < selectors.length; ++i) {
              expect(await erc6551Account1.overrides(user2.address, selectors[i])).eq(implementations[i])
              await expect(tx).to.emit(erc6551Account1, "OverrideUpdated").withArgs(user2.address, selectors[i], implementations[i]);
            }
          })
          it("root owner can set overrides", async function () {
            let selectors = [testFunc1Sighash, testFunc2Sighash, testFunc3Sighash]
            let implementations = [test1Callee.address, test1Callee.address, user4.address]
            for(let i = 0; i < selectors.length; ++i) {
              expect(await erc6551AccountNested2.overrides(user1.address, selectors[i])).eq(AddressZero)
            }
            let tx = await erc6551AccountNested2.connect(user1).setOverrides(selectors, implementations)
            for(let i = 0; i < selectors.length; ++i) {
              expect(await erc6551AccountNested2.overrides(user1.address, selectors[i])).eq(implementations[i])
              await expect(tx).to.emit(erc6551AccountNested2, "OverrideUpdated").withArgs(user1.address, selectors[i], implementations[i]);
            }
          })
          it("can call overrides", async function () {
            await user1.sendTransaction({ to: erc6551Account1.address, data: testFunc1Sighash })
            let sandbox = await mockSandbox.sandbox(erc6551Account1.address)
          })
        })
      }
      else if(accountType == "BlastooorStrategyAgentAccount") {
        describe("setOverrides 2", function () {
          it("non owner cannot set overrides", async function () {
            await expect(erc6551Account1.connect(user3).setOverrides([])).to.be.revertedWithCustomError(erc6551Account1, "NotAuthorized")
          })
          it("cannot set overrides if no token", async function () {
            await expect(erc6551AccountNoToken.connect(user2).setOverrides([])).to.be.revertedWithCustomError(erc6551AccountLocked1, "NotAuthorized")
            await expect(erc6551AccountNoContract.connect(user2).setOverrides([])).to.be.revertedWithCustomError(erc6551AccountLocked2, "NotAuthorized")
          });
          it("owner can set overrides", async function () {
            let selectors = [testFunc1Sighash, testFunc2Sighash, testFunc3Sighash]
            let implementations = [test1Callee.address, test1Callee.address, user4.address]
            let overrides = [
              {
                implementation: test1Callee.address,
                functionParams: [
                  { selector: testFunc1Sighash, isProtected: false },
                  { selector: testFunc2Sighash, isProtected: true },
                ]
              },
              {
                implementation: user4.address,
                functionParams: [
                  { selector: testFunc3Sighash, isProtected: false },
                ]
              },
            ]
            for(let i = 0; i < overrides.length; ++i) {
              for(let j = 0; j < overrides[i].functionParams.length; ++j) {
                let res = await erc6551Account1.overrides(overrides[i].functionParams[j].selector)
                expect(res.implementation).eq(AddressZero)
                expect(res.isProtected).eq(false)
              }
            }
            let tx = await erc6551Account1.connect(user2).setOverrides(overrides)
            for(let i = 0; i < overrides.length; ++i) {
              for(let j = 0; j < overrides[i].functionParams.length; ++j) {
                let res = await erc6551Account1.overrides(overrides[i].functionParams[j].selector)
                expect(res.implementation).eq(overrides[i].implementation)
                expect(res.isProtected).eq(overrides[i].functionParams[j].isProtected)
                await expect(tx).to.emit(erc6551Account1, "OverrideUpdated").withArgs(overrides[i].functionParams[j].selector, overrides[i].implementation, overrides[i].functionParams[j].isProtected);
              }
            }
          })
          it("root owner can set overrides", async function () {
            let selectors = [testFunc1Sighash, testFunc2Sighash, testFunc3Sighash]
            let implementations = [test1Callee.address, test1Callee.address, user4.address]
            let overrides = [
              {
                implementation: test1Callee.address,
                functionParams: [
                  { selector: testFunc1Sighash, isProtected: false },
                  { selector: testFunc2Sighash, isProtected: true },
                ]
              },
              {
                implementation: user4.address,
                functionParams: [
                  { selector: testFunc3Sighash, isProtected: false },
                ]
              },
            ]
            for(let i = 0; i < overrides.length; ++i) {
              for(let j = 0; j < overrides[i].functionParams.length; ++j) {
                let res = await erc6551AccountNested2.overrides(overrides[i].functionParams[j].selector)
                expect(res.implementation).eq(AddressZero)
                expect(res.isProtected).eq(false)
              }
            }
            let tx = await erc6551AccountNested2.connect(user1).setOverrides(overrides)
            for(let i = 0; i < overrides.length; ++i) {
              for(let j = 0; j < overrides[i].functionParams.length; ++j) {
                let res = await erc6551AccountNested2.overrides(overrides[i].functionParams[j].selector)
                expect(res.implementation).eq(overrides[i].implementation)
                expect(res.isProtected).eq(overrides[i].functionParams[j].isProtected)
                await expect(tx).to.emit(erc6551AccountNested2, "OverrideUpdated").withArgs(overrides[i].functionParams[j].selector, overrides[i].implementation, overrides[i].functionParams[j].isProtected);
              }
            }
          })
          it("can call overrides", async function () {
            await user1.sendTransaction({ to: erc6551Account1.address, data: testFunc1Sighash })
          })
        })
      }

      describe("account receiving pt 2", function () {
        it("does not stop unsafe transferFrom agent nft to agent account", async function () {
          // does not trigger on unsafe transferFrom
          expect(await agentNft.ownerOf(agentID)).eq(user2.address);
          expect(await erc6551Account1.owner()).eq(user2.address)
          let tx = await agentNft.connect(user2).transferFrom(user2.address, erc6551Account1.address, agentID)
          expect(await agentNft.ownerOf(agentID)).eq(erc6551Account1.address)
          expect(await erc6551Account1.owner()).eq(erc6551Account1.address)
        });
      })

    })
  }

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});

function createMockSignatureForContract(c:any) {
  var signature = c.address.toLowerCase()
  signature = signature.substring(2,signature.length)
  while(signature.length < 64) signature = '0' + signature // 32 bytes
  signature = '0x'+signature
  while(signature.length < 132) signature += '0' // 65 bytes
  return signature
}
