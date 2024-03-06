/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, } = chai;

import { AgentFetcher } from "../typechain-types";

import {  expectDeployed } from "../scripts/utils/expectDeployed";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { deployContract } from "../scripts/utils/deployContract";


describe("AgentFetcher", function () {
  let deployer: SignerWithAddress;
  let chainID: number;
  let networkSettings: any;
  let snapshot: BN;

  let agentFetcher: AgentFetcher;


  before(async function () {
    const blockNumber = await provider.getBlockNumber();
    if(blockNumber !== 2311403) {
      // Note: Block height chosen at random, done to make tests deterministic
      throw new Error("Tests expected to run against forked blast sepolia network at block 2311403")
    }

    [deployer,] = await ethers.getSigners();
    chainID = (await provider.getNetwork()).chainId;
    networkSettings = getNetworkSettings(chainID);
    if(!networkSettings.isTestnet) throw new Error("Do not run tests on production networks");
    snapshot = await provider.send("evm_snapshot", []);
    await deployer.sendTransaction({ to: deployer.address }); // for some reason this helps solidity-coverage

    agentFetcher = await deployContract(deployer, "AgentFetcher", []) as AgentFetcher;
    await expectDeployed(agentFetcher.address);
  });

  after(async function () {
    await provider.send("evm_revert", [snapshot]);
  });


  describe("Fetch agents", function () {
    it("Can handle empty nft collection array", async function () {
      let account = "0xE89c1F56B7d46EA0Dccb8512cDE03f6Be4E94986";
      let res = await agentFetcher.callStatic.fetchAgents(account, [])

      expect(res).deep.eq([])
    })

    it("Can fetch agents for one nft collection", async function () {
      let account = "0xE89c1F56B7d46EA0Dccb8512cDE03f6Be4E94986";
      let res = await agentFetcher.callStatic.fetchAgents(account, ["0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b"])

      expect(res).deep.eq([
        [
          "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          BN.from(80),
        ],
        [
          "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          BN.from(92),
        ],
        [
          "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          BN.from(96),
        ]
      ])
    })
  })
});
