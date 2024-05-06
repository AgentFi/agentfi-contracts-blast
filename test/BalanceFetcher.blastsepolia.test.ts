/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect } = chai;

import { BalanceFetcher as AgentFetcher } from "../typechain-types";

import { expectDeployed } from "../scripts/utils/expectDeployed";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { deployContract } from "../scripts/utils/deployContract";

// Ether.js returns some funky stuff for structs (merges an object and array). Convert to an array
function convertToStruct(res: any) {
  return Object.keys(res)
    .filter((x) => Number.isNaN(parseInt(x)))
    .reduce((acc, k) => {
      acc[k] = res[k];
      return acc;
    }, {} as Record<string, any>);
}

const BLAST_ADDRESS = "0x4300000000000000000000000000000000000002";
const BLAST_POINTS_ADDRESS = "0x2fc95838c71e76ec69ff817983BFf17c710F34E0";
const BLAST_POINTS_OPERATOR_ADDRESS =
  "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";
const GAS_COLLECTOR_ADDRESS = "0xf237c20584DaCA970498917470864f4d027de4ca"; // v1.0.0
const AGENT_REGISTRY_ADDRESS = "0x40473B0D0cDa8DF6F73bFa0b5D35c2f701eCfe23"; // v1.0.1

let matchingForkBlock = false;

describe("Balancer Fetch Forked Sepolia Test", function () {
  let deployer: SignerWithAddress;
  let chainID: number;
  let networkSettings: any;
  let snapshot: BN;

  let agentFetcher: AgentFetcher;

  before(async function () {
    const blockNumber = await provider.getBlockNumber();
    if (blockNumber !== 3372360) {
      // Note: Block height chosen at random, done to make tests deterministic
      /*
      throw new Error(
        "Tests expected to run against forked blast sepolia network at block 2311403"
      );
      */
      console.log("Tests expected to run against forked blast sepolia network at block 2311403. Skipping these tests")
    }
    else {
      matchingForkBlock = true
    }

    [deployer] = await ethers.getSigners();
    chainID = (await provider.getNetwork()).chainId;
    networkSettings = getNetworkSettings(chainID);
    if (!networkSettings.isTestnet)
      throw new Error("Do not run tests on production networks");
    snapshot = await provider.send("evm_snapshot", []);
    await deployer.sendTransaction({ to: deployer.address }); // for some reason this helps solidity-coverage

    const args = [
      deployer.address,
      BLAST_ADDRESS,
      GAS_COLLECTOR_ADDRESS,
      BLAST_POINTS_ADDRESS,
      BLAST_POINTS_OPERATOR_ADDRESS,
      AGENT_REGISTRY_ADDRESS,
    ];
    agentFetcher = (await deployContract(
      deployer,
      "BalanceFetcher",
      args
    )) as AgentFetcher;
    await expectDeployed(agentFetcher.address);
  });

  after(async function () {
    await provider.send("evm_revert", [snapshot]);
  });

  const erc20s = [
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000002",
  ];

  describe("Fetch v2 pool info", function () {
    it("Can fetch pool info", async function () {
      if(!matchingForkBlock) return
      let res = await agentFetcher.fetchPoolInfoV2(
        "0x024Dd95113137f04E715B2fC8F637FBe678e9512"
      );
      expect(convertToStruct(res)).deep.eq({
        total: BN.from("22853155842902244"),
        address0: "0x798dE0520497E28E8eBfF0DF1d791c2E942eA881",
        address1: "0xa7870cf9143084ED04f4C2311f48CB24a2b4A097",
        reserve0: BN.from("490173005852234777735"),
        reserve1: BN.from("1101631077117"),
      });
    });
  });

  describe("Fetch agents", function () {
    it("Can handle empty nft collection array", async function () {
      if(!matchingForkBlock) return
      let account = "0xE89c1F56B7d46EA0Dccb8512cDE03f6Be4E94986";
      let res = await agentFetcher.callStatic
        .fetchAgents(account, [], [])
        .then((r) => r.map(convertToStruct));
      expect(res).deep.eq([
        {
          agentAddress: "0xE89c1F56B7d46EA0Dccb8512cDE03f6Be4E94986",
          implementation: "0x0000000000000000000000000000000000000000",
          owner: "0x0000000000000000000000000000000000000000",
          collection: "0x0000000000000000000000000000000000000000",
          agentID: 0,
          balances: [],
        },
      ]);
    });

    it("Can fetch agents for eoa on one nft collection", async function () {
      if(!matchingForkBlock) return
      let account = "0x7da01a06A2582193C2867E22FE62f7f649F7B9e2";
      let res = await agentFetcher.callStatic
        .fetchAgents(
          account,
          ["0x5066A1975BE96B777ddDf57b496397efFdDcB4A9", "0xD6eC1A987A276c266D17eF8673BA4F05055991C7"],
          erc20s
        )
        .then((r) => r.map(convertToStruct));

      // console.table(res);

      expect(res).deep.eq([
        {
          agentAddress: '0x7da01a06A2582193C2867E22FE62f7f649F7B9e2',
          implementation: '0x0000000000000000000000000000000000000000',
          owner: '0x0000000000000000000000000000000000000000',
          collection: '0x0000000000000000000000000000000000000000',
          agentID: BN.from("0"),
          balances: [
            BN.from("477150013525944950"),
            BN.from("0"),
            BN.from("0")
          ]
        },
        {
          agentAddress: '0xB79E35D7CCb26537345C3f73E5bce5a5CE50b0dd',
          implementation: '0x9DE8d1AfA3eF64AcC41Cd84533EE09A0Cd87fefF',
          owner: '0x7da01a06A2582193C2867E22FE62f7f649F7B9e2',
          collection: '0x5066A1975BE96B777ddDf57b496397efFdDcB4A9',
          agentID: BN.from("4640"),
          balances: [
            BN.from("0"),
            BN.from("46136704"),
            BN.from("2284228")
          ]
        },
        {
          agentAddress: '0xfe5d59E745ae8709894dd8Da77242DA54B9a5eAc',
          implementation: '0xb64763516040409536D85451E423e444528d66ff',
          owner: '0xB79E35D7CCb26537345C3f73E5bce5a5CE50b0dd',
          collection: '0xD6eC1A987A276c266D17eF8673BA4F05055991C7',
          agentID: BN.from("1"),
          balances: [
            BN.from("0"),
            BN.from("13890118"),
            BN.from("700504")
          ]
        },
        {
          agentAddress: '0x6749D809331483e167BaE4564d5b9c0990393000',
          implementation: '0xb64763516040409536D85451E423e444528d66ff',
          owner: '0xB79E35D7CCb26537345C3f73E5bce5a5CE50b0dd',
          collection: '0xD6eC1A987A276c266D17eF8673BA4F05055991C7',
          agentID: BN.from("2"),
          balances: [
            BN.from("1000003359409372"),
            BN.from("16775796"),
            BN.from("834145")
          ]
        },
        {
          agentAddress: '0xE5dA8361Bbaf5a77FdB27381528d6a37a85a6618',
          implementation: '0xb64763516040409536D85451E423e444528d66ff',
          owner: '0xB79E35D7CCb26537345C3f73E5bce5a5CE50b0dd',
          collection: '0xD6eC1A987A276c266D17eF8673BA4F05055991C7',
          agentID: BN.from("3"),
          balances: [
            BN.from("1000003359409372"),
            BN.from("17013571"),
            BN.from("823687")
          ]
        },
        {
          agentAddress: '0xf8D0fA5020735dd49AeAf5860C0A99474f4AEDDD',
          implementation: '0xb64763516040409536D85451E423e444528d66ff',
          owner: '0xB79E35D7CCb26537345C3f73E5bce5a5CE50b0dd',
          collection: '0xD6eC1A987A276c266D17eF8673BA4F05055991C7',
          agentID: BN.from("4"),
          balances: [
            BN.from("1000003359409372"),
            BN.from("17066576"),
            BN.from("825026")
          ]
        },
        {
          agentAddress: '0x69048Dc6A61125C272372b6309750a716607200b',
          implementation: '0xb64763516040409536D85451E423e444528d66ff',
          owner: '0xB79E35D7CCb26537345C3f73E5bce5a5CE50b0dd',
          collection: '0xD6eC1A987A276c266D17eF8673BA4F05055991C7',
          agentID: BN.from("5"),
          balances: [
            BN.from("1000003359409372"),
            BN.from("17122902"),
            BN.from("826460")
          ]
        },
        {
          agentAddress: '0xF8A4cBD2FBeC48a34b38baEe3C432c62057eAC1A',
          implementation: '0xb64763516040409536D85451E423e444528d66ff',
          owner: '0xB79E35D7CCb26537345C3f73E5bce5a5CE50b0dd',
          collection: '0xD6eC1A987A276c266D17eF8673BA4F05055991C7',
          agentID: BN.from("6"),
          balances: [
            BN.from("1000003359409372"),
            BN.from("17066576"),
            BN.from("821864")
          ]
        }
      ]);
    });
  });
});
