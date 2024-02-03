/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;

import { MockERC20 } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { deployContract } from "../scripts/utils/deployContract";

const { ZeroAddress, WeiPerEther, MaxUint256 } = ethers
const WeiPerUsdc = 1_000_000n

describe("MockERC20", function () {
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

  let chainID: number;
  let networkSettings: any;
  let snapshot: BN;

  before(async function () {
    [deployer, owner, user1, user2, user3, user4, user5] = await ethers.getSigners();
    chainID = (await provider.getNetwork()).chainId;
    networkSettings = getNetworkSettings(chainID);
    if(!networkSettings.isTestnet) throw new Error("Do not run tests on production networks");
    snapshot = await provider.send("evm_snapshot", []);
    await deployer.sendTransaction({to:deployer.address}); // for some reason this helps solidity-coverag
  });

  after(async function () {
    await provider.send("evm_revert", [snapshot]);
  });

  describe("setup", function () {
    let name = `Token A`
    let symbol = `TKNA`
    let decimals = 6

    it("can deploy MockERC20", async function () {
      erc20a = await deployContract(deployer, "MockERC20", [name, symbol, decimals]) as MockERC20;
      await expectDeployed(erc20a.address);
    });
    it("initializes properly", async function () {
      expect(await erc20a.totalSupply()).eq(0);
      expect(await erc20a.balanceOf(user1.address)).eq(0);
      expect(await erc20a.name()).eq(name);
      expect(await erc20a.symbol()).eq(symbol);
      expect(await erc20a.decimals()).eq(decimals);
    });
  });
});
