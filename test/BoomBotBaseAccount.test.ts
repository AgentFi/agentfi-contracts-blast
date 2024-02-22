/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect } = chai;

import { IERC6551Registry, BlastAgentAccount, MockERC20, MockERC721, GasCollector } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { toBytes32 } from "./../scripts/utils/setStorage";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { deployContract } from "../scripts/utils/deployContract";
import L1DataFeeAnalyzer from "../scripts/utils/L1DataFeeAnalyzer";

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const WeiPerUsdc = BN.from(1_000_000); // 6 decimals

const ERC6551_REGISTRY_ADDRESS = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS            = "0x4300000000000000000000000000000000000002";
const ENTRY_POINT_ADDRESS      = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const badcode = "0x000000000000000000000000000000000baDC0DE"

const MAGIC_VALUE_0 = "0x00000000";
const MAGIC_VALUE_IS_VALID_SIGNER = "0x523e3260";

describe("BlastAgentAccount", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  let gasCollector: GasCollector;
  let erc6551Registry: IERC6551Registry;
  let erc721TBA: MockERC721; // the erc721 that may have token bound accounts
  let erc721Asset: MockERC721; // an erc721 that token bound accounts may hold
  let erc6551AccountImplementation: BlastAgentAccount; // the base implementation for token bound accounts
  let erc6551Account1: BlastAgentAccount; // an account bound to a token
  let erc6551Account2: BlastAgentAccount; // an account bound to a token
  let erc6551Account3: BlastAgentAccount; // an account bound to a token

  let erc20: MockERC20;

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
      gasCollector = await deployContract(deployer, "GasCollector", [owner.address, BLAST_ADDRESS]);
      await expectDeployed(gasCollector.address);
      expect(await gasCollector.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy GasCollector", gasCollector.deployTransaction);
    })
    //it("can read from registry", async function () {});
    it("can deploy ERC721", async function () {
      erc721TBA = await deployContract(deployer, "MockERC721", ["HolderERC721", "HODL"]) as MockERC721;
      await expectDeployed(erc721TBA.address);
    });
    it("can deploy account implementation", async function () {
      erc6551AccountImplementation = await deployContract(deployer, "BlastAgentAccount", [BLAST_ADDRESS, gasCollector.address, ENTRY_POINT_ADDRESS,badcode,ERC6551_REGISTRY_ADDRESS,AddressZero]) as BlastAgentAccount;
      await expectDeployed(erc6551AccountImplementation.address);
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
    //it("deployed ")
    //it("deployed correctly", async function () {});
    //it("", async function () {});
  });

  describe("account creation and registration", function () {
    let tokenId = 1;
    let salt = toBytes32(0);

    it("mint erc721", async function () {
      expect(await erc721TBA.balanceOf(user1.address)).eq(0);
      await erc721TBA.mint(user1.address, tokenId);
      expect(await erc721TBA.balanceOf(user1.address)).eq(1);
    });
    it("can create account and register", async function () {
      // initially unregistered. predict address
      let predictedAddress = await erc6551Registry.account(erc6551AccountImplementation.address, salt, chainID, erc721TBA.address, tokenId);
      expect(predictedAddress).not.eq(AddressZero);
      let isDeployed1 = await isDeployed(predictedAddress)
      expect(isDeployed1).to.be.false;
      // create account and register
      let predictedAddress2 = await erc6551Registry.callStatic.createAccount(erc6551AccountImplementation.address, salt, chainID, erc721TBA.address, tokenId);
      expect(predictedAddress).eq(predictedAddress2);
      let tx = await erc6551Registry.createAccount(erc6551AccountImplementation.address, salt, chainID, erc721TBA.address, tokenId);
      let isDeployed2 = await isDeployed(predictedAddress)
      expect(isDeployed2).to.be.true;
      erc6551Account1 = await ethers.getContractAt("BlastAgentAccount", predictedAddress) as BlastAgentAccount;
      l1DataFeeAnalyzer.register("registry.createAccount", tx);
    });
    it("account begins with state", async function () {
      expect(await erc6551Account1.owner()).eq(user1.address);
      let tokenRes = await erc6551Account1.token();
      expect(tokenRes.chainId).eq(chainID);
      expect(tokenRes.tokenContract).eq(erc721TBA.address);
      expect(tokenRes.tokenId).eq(tokenId);
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
    });
    it("account with nft on other chain has no owner on this chain", async function () {
      let tokenId2 = 2;
      let chainId2 = 9999;
      let predictedAddress = await erc6551Registry.account(erc6551AccountImplementation.address, salt, chainId2, erc721TBA.address, tokenId2);
      let tx = await erc6551Registry.createAccount(erc6551AccountImplementation.address, salt, chainId2, erc721TBA.address, tokenId2);
      erc6551Account2 = await ethers.getContractAt("BlastAgentAccount", predictedAddress) as BlastAgentAccount;

      expect(await erc6551Account2.owner()).eq(AddressZero);
      let tokenRes = await erc6551Account2.token();
      expect(tokenRes.chainId).eq(chainId2);
      expect(tokenRes.tokenContract).eq(erc721TBA.address);
      expect(tokenRes.tokenId).eq(tokenId2);
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
  });

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
    //it("can receive ERC1155", async function () {});
  });

  describe("account execution", function () {
    it("non owner cannot execute", async function () {
      // no data
      await expect(erc6551Account1.connect(user2).execute(user2.address, 0, "0x", 0)).to.be.revertedWithCustomError(erc6551Account1, "NotAuthorized");
      // erc20 transfer
      let calldata = erc20.interface.encodeFunctionData("transfer", [user2.address, 0]);
      await expect(erc6551Account1.connect(user2).execute(erc20.address, 0, calldata, 0)).to.be.revertedWithCustomError(erc6551Account1, "NotAuthorized");
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
      let tokenId = 2;
      expect(await erc721Asset.ownerOf(tokenId)).eq(erc6551Account1.address);
      let calldata = erc721Asset.interface.encodeFunctionData("transferFrom", [erc6551Account1.address, user2.address, tokenId]);
      let tx = await erc6551Account1.connect(user1).execute(erc721Asset.address, 0, calldata, 0);
      expect(await erc721Asset.ownerOf(tokenId)).eq(user2.address);
      let state2 = await erc6551Account1.state();
      expect(state2).not.eq(state1);
      l1DataFeeAnalyzer.register("execute transfer ERC721", tx);
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
      let tokenId = 1;
      expect(await erc721TBA.ownerOf(tokenId)).eq(user1.address);
      expect(await erc6551Account1.owner()).eq(user1.address);
      await erc721TBA.connect(user1).transferFrom(user1.address, user2.address, tokenId);
      expect(await erc721TBA.ownerOf(tokenId)).eq(user2.address);
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

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});
