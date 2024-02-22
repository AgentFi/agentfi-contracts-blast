/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;
import fs from "fs";

import { BalanceFetcher, MockERC20, MockGasBurner, IBlast, MockBlast, GasCollector } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { toBytes32 } from "./../scripts/utils/setStorage";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { leftPad } from "../scripts/utils/strings";
import { deployContract } from "../scripts/utils/deployContract";
import L1DataFeeAnalyzer from "../scripts/utils/L1DataFeeAnalyzer";

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const WeiPerUsdc = BN.from(1_000_000); // 6 decimals
const AddressOne = "0x0000000000000000000000000000000000000001"
const AddressTwo = "0x0000000000000000000000000000000000000002"

const ERC6551_REGISTRY_ADDRESS = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS            = "0x4300000000000000000000000000000000000002";

describe("BalanceFetcher", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  let erc20a: MockERC20;
  let erc20b: MockERC20;
  let erc20c: MockERC20;
  let usdb: MockERC20Rebasing;

  let chainID: number;
  let networkSettings: any;
  let snapshot: BN;

  let gasCollector: GasCollector;
  let balanceFetcher: BalanceFetcher;
  let gasBurner: MockGasBurner; // inherits blastable
  let gasBurner2: MockGasBurner; // inherits blastable
  let iblast: any;
  let mockblast: MockBlast;
  let preboom: PreBOOM;

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
    it("can deploy BalanceFetcher", async function () {
      balanceFetcher = await deployContract(deployer, "BalanceFetcher", [owner.address, BLAST_ADDRESS, gasCollector.address]) as BalanceFetcher;
      await expectDeployed(balanceFetcher.address);
      l1DataFeeAnalyzer.register("deploy BalanceFetcher", balanceFetcher.deployTransaction);
    });
    it("can deploy gas burner", async function () {
      gasBurner = await deployContract(deployer, "MockGasBurner", [owner.address, BLAST_ADDRESS, gasCollector.address]) as MockGasBurner;
      await expectDeployed(gasBurner.address);
      expect(await gasBurner.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy MockGasBurner", gasBurner.deployTransaction);
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
    it("can deploy gas burner 2", async function () {
      gasBurner2 = await deployContract(deployer, "MockGasBurner", [owner.address, mockblast.address, gasCollector.address]) as MockGasBurner;
      await expectDeployed(gasBurner2.address);
      expect(await gasBurner2.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy MockGasBurner", gasBurner2.deployTransaction);
    })
    it("can use gas burner", async function () {
      await gasBurner2.burnGas(10)
    })
    it("can deploy usdb", async function () {
      usdb = await deployContract(deployer, "MockERC20Rebasing", [`USD Rebasing`, `USDB`, 18, 500]) as MockERC20Rebasing;
      await expectDeployed(usdb.address);
      l1DataFeeAnalyzer.register("deploy MockERC20Rebasing", usdb.deployTransaction);
      expect(await usdb.name()).eq('USD Rebasing')
      expect(await usdb.symbol()).eq('USDB')
      expect(await usdb.decimals()).eq(18)
      expect(await usdb.fixedAPY()).eq(500)
    })
  });

  describe("fetch balances", function () {
    it("can fetch empty list", async function () {
      let account = user1.address
      let tokens = []
      let tx = await balanceFetcher.fetchBalances(account, tokens)
      let res = await balanceFetcher.callStatic.fetchBalances(account, tokens)
      expect(res).deep.eq([])
    })
    it("can fetch zeros", async function () {
      let account = user1.address
      let tokens = [erc20a.address, erc20b.address]
      let tx = await balanceFetcher.fetchBalances(account, tokens)
      let res = await balanceFetcher.callStatic.fetchBalances(account, tokens)
      expect(res).deep.eq([0,0])
    })
    it("can fetch nonzeros", async function () {
      let balEth = await provider.getBalance(user1.address)
      let bal1 = WeiPerEther
      let bal2 = WeiPerUsdc.mul(5)
      await erc20a.mint(user1.address, bal1)
      await erc20b.mint(user1.address, bal2)
      let account = user1.address
      let tokens = [AddressZero, erc20a.address, erc20b.address, erc20c.address]
      let tx = await balanceFetcher.fetchBalances(account, tokens)
      let res = await balanceFetcher.callStatic.fetchBalances(account, tokens)
      expect(res).deep.eq([balEth, bal1, bal2, 0])
    })
    it("reverts invalid token", async function () {
      await expect(balanceFetcher.fetchBalances(user1.address, [user1.address])).to.be.reverted;
    })
    it("can fetch claimable gas for eoa", async function () {
      let balEth = await provider.getBalance(user1.address)
      let bal1 = await erc20a.balanceOf(user1.address)
      let bal2 = await erc20b.balanceOf(user1.address)
      let bal3 = await erc20c.balanceOf(user1.address)
      let bal4 = 0
      let bal5 = 0
      let account = user1.address
      let tokens = [AddressZero, erc20a.address, erc20b.address, erc20c.address, AddressOne, AddressTwo]
      let tx = await balanceFetcher.fetchBalances(account, tokens)
      let res = await balanceFetcher.callStatic.fetchBalances(account, tokens)
      expect(res).deep.eq([balEth, bal1, bal2, bal3, bal4, bal5])
    })
    it("can fetch claimable gas for non blastable contract 1", async function () {
      let balEth = await provider.getBalance(ERC6551_REGISTRY_ADDRESS)
      let bal1 = await erc20a.balanceOf(ERC6551_REGISTRY_ADDRESS)
      let bal2 = await erc20b.balanceOf(ERC6551_REGISTRY_ADDRESS)
      let bal3 = await erc20c.balanceOf(ERC6551_REGISTRY_ADDRESS)
      let bal4 = 0
      let bal5 = 0
      let account = ERC6551_REGISTRY_ADDRESS
      let tokens = [AddressZero, erc20a.address, erc20b.address, erc20c.address, AddressOne, AddressTwo]
      let tx = await balanceFetcher.fetchBalances(account, tokens)
      let res = await balanceFetcher.callStatic.fetchBalances(account, tokens)
      expect(res).deep.eq([balEth, bal1, bal2, bal3, bal4, bal5])
    })
    it("can fetch claimable gas for blastable contract 1", async function () {
      let balEth = await provider.getBalance(gasBurner.address)
      let bal1 = await erc20a.balanceOf(gasBurner.address)
      let bal2 = await erc20b.balanceOf(gasBurner.address)
      let bal3 = await erc20c.balanceOf(gasBurner.address)
      let bal4 = 0 // these SHOULD be nonzero, but
      let bal5 = 0
      let account = gasBurner.address
      let tokens = [AddressZero, erc20a.address, erc20b.address, erc20c.address, AddressOne, AddressTwo]
      let tx = await balanceFetcher.fetchBalances(account, tokens)
      let res = await balanceFetcher.callStatic.fetchBalances(account, tokens)
      expect(res).deep.eq([balEth, bal1, bal2, bal3, bal4, bal5])
    })
    it("can fetch claimable gas for blastable contract 2", async function () {
      let balEth = await provider.getBalance(gasBurner2.address)
      let bal1 = await erc20a.balanceOf(gasBurner2.address)
      let bal2 = await erc20b.balanceOf(gasBurner2.address)
      let bal3 = await erc20c.balanceOf(gasBurner2.address)
      let bal4 = 0
      let bal5 = 0
      let account = gasBurner2.address
      let tokens = [AddressZero, erc20a.address, erc20b.address, erc20c.address, AddressOne, AddressTwo]
      let tx = await balanceFetcher.fetchBalances(account, tokens)
      let res = await balanceFetcher.callStatic.fetchBalances(account, tokens)
      expect(res).deep.eq([balEth, bal1, bal2, bal3, bal4, bal5])
    })
    it("can fetch usdb pt 0", async function () {
      let account = user1.address
      expect(await usdb.totalSupply()).eq(0)
      expect(await usdb.balanceOf(account)).eq(0)
      expect(await usdb.lastUpdatedTimestamp(account)).eq(0)
      let tokens = [usdb.address]
      let res = await balanceFetcher.callStatic.fetchBalances(account, tokens)
      expect(res).deep.eq([0])
    })
    it("can fetch usdb pt 1", async function () {
      let account = user1.address
      let bal1 = WeiPerEther
      await usdb.mint(user1.address, bal1)
      expect(await usdb.totalSupply()).eq(bal1)
      expect(await usdb.balanceOf(user1.address)).eq(bal1)
      expect(await usdb.lastUpdatedTimestamp(account)).gt(0)
      let tokens = [usdb.address]
      let res = await balanceFetcher.callStatic.fetchBalances(account, tokens)
      expect(res).deep.eq([bal1])
    })
    it("can fetch usdb pt 2", async function () {
      let account1 = user1.address
      let account2 = user2.address
      let bal1 = WeiPerEther
      let bal2 = WeiPerEther.div(5)
      let bal3 = bal1.sub(bal2)
      await usdb.connect(user1).transfer(user2.address, bal2)
      expect(await usdb.totalSupply()).gt(bal1)
      expect(await usdb.balanceOf(user1.address)).gt(bal3)
      expect(await usdb.balanceOf(user2.address)).eq(bal2)
      expect(await usdb.lastUpdatedTimestamp(account1)).gt(0)
      expect(await usdb.lastUpdatedTimestamp(account2)).gt(0)
      let tokens = [usdb.address]
      let res1 = await balanceFetcher.callStatic.fetchBalances(account1, tokens)
      //expect(res1).deep.eq([bal3])
      expect(res1[0]).gt(bal3)
      let res2 = await balanceFetcher.callStatic.fetchBalances(account2, tokens)
      expect(res2).deep.eq([bal2])
    })
    it("can fetch usdb pt 3", async function () {
      let account1 = user1.address
      let account2 = user2.address
      let account3 = user3.address

      let bal01 = WeiPerEther
      let bal02 = Zero
      let bal03 = Zero

      let bal12d = WeiPerEther.div(5)
      let bal11 = bal01.sub(bal12d)
      let bal12 = bal02.add(bal12d)
      let bal13 = bal03

      let bal22d = WeiPerEther.div(100)
      let bal23d = WeiPerEther.div(100).mul(3)
      let bal21 = bal11.sub(bal22d).sub(bal23d)
      let bal22 = bal12.add(bal22d)
      let bal23 = bal13.add(bal23d)

      let txdata0 = usdb.interface.encodeFunctionData("transfer", [user2.address, bal22d])
      let txdata1 = usdb.interface.encodeFunctionData("transfer", [user3.address, bal23d])
      let txdatas = [txdata0, txdata1]
      await usdb.connect(user1).multicall(txdatas)
      expect(await usdb.totalSupply()).gt(bal01)
      expect(await usdb.balanceOf(user1.address)).gt(bal21)
      expect(await usdb.balanceOf(user2.address)).gt(bal22)
      expect(await usdb.balanceOf(user3.address)).eq(bal23)
      expect(await usdb.lastUpdatedTimestamp(account1)).gt(0)
      expect(await usdb.lastUpdatedTimestamp(account2)).gt(0)
      expect(await usdb.lastUpdatedTimestamp(account3)).gt(0)
      let tokens = [usdb.address]
      let res1 = await balanceFetcher.callStatic.fetchBalances(account1, tokens)
      expect(res1[0]).gt(bal21)
      let res2 = await balanceFetcher.callStatic.fetchBalances(account2, tokens)
      expect(res2[0]).deep.gt(bal22)
      let res3 = await balanceFetcher.callStatic.fetchBalances(account3, tokens)
      expect(res3[0]).deep.eq(bal23)
    })
    it("can fetch usdb pt 4", async function () {
      let bal1 = await usdb.balanceOf(user1.address)
      await user2.sendTransaction({to: user3.address})
      let bal2 = await usdb.balanceOf(user1.address)
      expect(bal2).gt(bal1)
    })
  });

  describe("fetchBlastableGasQuotes", function () {
    it("can fetch none", async function () {
      let res = await balanceFetcher.callStatic.fetchBlastableGasQuotes([]);
      expect(res).deep.eq([])
      let tx = await balanceFetcher.fetchBlastableGasQuotes([]);
    })
    it("can fetch some", async function () {
      let addresses = [
        AddressZero, // invalid
        ERC6551_REGISTRY_ADDRESS, // not configured
        usdb.address, // configured with proper blast
        gasBurner2.address, // configured with mock blast
      ]
      let res = await balanceFetcher.callStatic.fetchBlastableGasQuotes(addresses);
      console.log('res')
      console.log(res)
      expect(res.length).eq(addresses.length)
      expect(res[0].quoteAmountAllGas).eq(0)
      expect(res[0].quoteAmountMaxGas).eq(0)
      expect(res[1].quoteAmountAllGas).eq(0)
      expect(res[1].quoteAmountMaxGas).eq(0)
      expect(res[2].quoteAmountAllGas).eq(0)
      expect(res[2].quoteAmountMaxGas).eq(0)
      expect(res[3].quoteAmountAllGas).eq(0)
      expect(res[3].quoteAmountMaxGas).eq(0)
    })
  })

  describe("preboom", function () {
    it("can deploy", async function () {
      preboom = await deployContract(deployer, "PreBOOM", [owner.address, BLAST_ADDRESS, gasCollector.address]) as PreBOOM;
      await expectDeployed(preboom.address);
      l1DataFeeAnalyzer.register("deploy PreBOOM", preboom.deployTransaction);
      expect(await preboom.name()).eq('Precursor BOOM!')
      expect(await preboom.symbol()).eq('PreBOOM')
      expect(await preboom.decimals()).eq(18)
      expect(await preboom.totalSupply()).eq(0)
      expect(await preboom.balanceOf(user1.address)).eq(0)
      expect(await preboom.isMinter(user1.address)).eq(false)
      expect(await preboom.owner()).eq(owner.address)
    })
    it("non minter cannot mint", async function () {
      await expect(preboom.connect(user1).mint(user1.address, 1)).to.be.revertedWithCustomError(preboom, "NotMinter")
    })
    it("non owner cannot set minters", async function () {
      await expect(preboom.connect(user1).setMinters([])).to.be.revertedWithCustomError(preboom, "NotContractOwner")
    })
    it("owner set minters", async function () {
      let params = [
        {
          account: user1.address,
          isMinter: true,
        },
        {
          account: user2.address,
          isMinter: false,
        }
      ]
      let tx = await preboom.connect(owner).setMinters(params)
      for(const param of params) {
        const { account, isMinter } = param
        expect(await preboom.isMinter(account)).eq(isMinter)
        await expect(tx).to.emit(preboom, "MinterSet").withArgs(account, isMinter)
      }
    })
    it("minter can mint", async function () {
      let tx = await preboom.connect(user1).mint(user2.address, 5)
      expect(await preboom.totalSupply()).eq(5)
      expect(await preboom.balanceOf(user1.address)).eq(0)
      expect(await preboom.balanceOf(user2.address)).eq(5)
    })
  })

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});
