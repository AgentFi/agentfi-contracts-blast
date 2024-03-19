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
    .reduce(
      (acc, k) => {
        acc[k] = res[k];
        return acc;
      },
      {} as Record<string, any>,
    );
}

const BLAST_ADDRESS = "0x4300000000000000000000000000000000000002";
const BLAST_POINTS_ADDRESS = "0x2536FE9ab3F511540F2f9e2eC2A805005C3Dd800";
const BLAST_POINTS_OPERATOR_ADDRESS =
  "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";
const GAS_COLLECTOR_ADDRESS = "0xf237c20584DaCA970498917470864f4d027de4ca"; // v1.0.0

describe("Balancer Fetch Forked Mainnet Test", function () {
  let deployer: SignerWithAddress;
  let chainID: number;
  let networkSettings: any;
  let snapshot: BN;

  let agentFetcher: AgentFetcher;

  before(async function () {
    const blockNumber = await provider.getBlockNumber();
    if (blockNumber !== 1011250) {
      // Note: Block height chosen at random, done to make tests deterministic
      throw new Error(
        "Tests expected to run against forked blast network at block 1011250",
      );
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
    ];
    agentFetcher = (await deployContract(
      deployer,
      "BalanceFetcher",
      args,
    )) as AgentFetcher;
    await expectDeployed(agentFetcher.address);
  });

  after(async function () {
    await provider.send("evm_revert", [snapshot]);
  });

  describe("Fetch agents", function () {
    it("Can handle invalid pool", async function () {
      const owner = "0x000000000000000000000000000000000000dead";
      const pool = "0x000000000000000000000000000000000000dead";
      await expect(agentFetcher.callStatic
        .fetchPositionV2(owner, pool)).to.be.reverted;
    });

    it("Can handle no position", async function () {
      const owner = "0x000000000000000000000000000000000000dead";
      const pool = "0x3b5d3f610Cc3505f4701E9FB7D0F0C93b7713adD";
      let res = await agentFetcher.callStatic
        .fetchPositionV2(owner, pool)
        .then((r) => r.map(convertToStruct));

      expect(res).deep.eq([
        {
          owner,
          pool,
          token: "0x4300000000000000000000000000000000000003",
          balance: BN.from("0"),
        },
        {
          owner,
          pool,
          token: "0x4300000000000000000000000000000000000004",
          balance: BN.from("0"),
        },
      ]);
    });

    it("Can fetch Blasterswap position", async function () {
      const owner = "0x1698d95911b2C523628f11959f827472Ca8Ac9a7";
      const pool = "0x3b5d3f610Cc3505f4701E9FB7D0F0C93b7713adD";
      let res = await agentFetcher.callStatic
        .fetchPositionV2(owner, pool)
        .then((r) => r.map(convertToStruct));

      expect(res).deep.eq([
        {
          owner,
          pool,
          token: "0x4300000000000000000000000000000000000003",
          balance: BN.from("1822914602261345881165"),
        },
        {
          owner,
          pool,
          token: "0x4300000000000000000000000000000000000004",
          balance: BN.from("531601971339504774"),
        },
      ]);
    });

    it("Can fetch Ring Protocol position", async function () {
      const owner = "0xaC7b6B1Deca1321ff871327E9d1256272019D201";
      const pool = "0x9be8a40c9cf00fe33fd84eaedaa5c4fe3f04cbc3";
      let res = await agentFetcher.callStatic
        .fetchPositionV2(owner, pool)
        .then((r) => r.map(convertToStruct));

      expect(res).deep.eq([
        {
          owner,
          pool,
          token: "0x66714DB8F3397c767d0A602458B5b4E3C0FE7dd1", // Few Wrapped Wrapped Ether
          balance: BN.from("237928240622992453"),
        },
        {
          owner,
          pool,
          token: "0x866f2C06B83Df2ed7Ca9C2D044940E7CD55a06d6", // Few Wrapped USDB
          balance: BN.from("815698702331247132488"),
        },
      ]);
    });

    it("Can fetch Thruster Protocol position", async function () {
      const owner = "0xc78e8e153d926047a07ed9a8ecdf837061f11b86";
      const pool = "0x12c69bfa3fb3cba75a1defa6e976b87e233fc7df";
      let res = await agentFetcher.callStatic
        .fetchPositionV2(owner, pool)
        .then((r) => r.map(convertToStruct));

      expect(res).deep.eq([
        {
          owner,
          pool,
          token: "0x4300000000000000000000000000000000000003",
          balance: BN.from("938838451588216200860"),
        },
        {
          owner,
          pool,
          token: "0x4300000000000000000000000000000000000004",
          balance: BN.from("274025193351624672"),
        },
      ]);
    });

    it("Can fetch multiple positions", async function () {
      const owners = [
        "0x000000000000000000000000000000000000dead",
        "0xc78e8e153d926047a07ed9a8ecdf837061f11b86",
        "0xaC7b6B1Deca1321ff871327E9d1256272019D201"
      ];

      const pools = [
        "0x12c69bfa3fb3cba75a1defa6e976b87e233fc7df",
        "0x9be8a40c9cf00fe33fd84eaedaa5c4fe3f04cbc3",
      ];

      let res = await agentFetcher.callStatic
        .fetchPositionsV2(owners, pools)
        .then((r) => r.map(convertToStruct));

      expect(res).deep.eq([
        {
          owner: "0x000000000000000000000000000000000000dead",
          pool: "0x12c69bfa3fb3cba75a1defa6e976b87e233fc7df",
          token: "0x4300000000000000000000000000000000000003",
          balance: BN.from("0"),
        },
        {
          owner: "0x000000000000000000000000000000000000dead",
          pool: "0x12c69bfa3fb3cba75a1defa6e976b87e233fc7df",
          token: "0x4300000000000000000000000000000000000004",
          balance: BN.from("0"),
        },
        {
          owner: "0x000000000000000000000000000000000000dead",
          pool: "0x9be8a40c9cf00fe33fd84eaedaa5c4fe3f04cbc3",
          token: "0x66714DB8F3397c767d0A602458B5b4E3C0FE7dd1",
          balance: BN.from("0"),
        },
        {
          owner: "0x000000000000000000000000000000000000dead",
          pool: "0x9be8a40c9cf00fe33fd84eaedaa5c4fe3f04cbc3",
          token: "0x866f2C06B83Df2ed7Ca9C2D044940E7CD55a06d6",
          balance: BN.from("0"),
        },
        {
          owner: "0xC78E8E153D926047A07ED9A8eCdf837061F11B86",
          pool: "0x12c69BFA3fb3CbA75a1DEFA6e976B87E233fc7df",
          token: "0x4300000000000000000000000000000000000003",
          balance: BN.from("938838451588216200860"),
        },
        {
          owner: "0xC78E8E153D926047A07ED9A8eCdf837061F11B86",
          pool: "0x12c69BFA3fb3CbA75a1DEFA6e976B87E233fc7df",
          token: "0x4300000000000000000000000000000000000004",
          balance: BN.from("274025193351624672"),
        },
        {
          owner: "0xC78E8E153D926047A07ED9A8eCdf837061F11B86",
          pool: "0x9BE8a40C9cf00fe33fd84EAeDaA5C4fe3f04CbC3",
          token: "0x66714DB8F3397c767d0A602458B5b4E3C0FE7dd1",
          balance: BN.from("0"),
        },
        {
          owner: "0xC78E8E153D926047A07ED9A8eCdf837061F11B86",
          pool: "0x9BE8a40C9cf00fe33fd84EAeDaA5C4fe3f04CbC3",
          token: "0x866f2C06B83Df2ed7Ca9C2D044940E7CD55a06d6",
          balance: BN.from("0"),
        },
        {
          owner: "0xaC7b6B1Deca1321ff871327E9d1256272019D201",
          pool: "0x12c69BFA3fb3CbA75a1DEFA6e976B87E233fc7df",
          token: "0x4300000000000000000000000000000000000003",
          balance: BN.from("0"),
        },
        {
          owner: "0xaC7b6B1Deca1321ff871327E9d1256272019D201",
          pool: "0x12c69BFA3fb3CbA75a1DEFA6e976B87E233fc7df",
          token: "0x4300000000000000000000000000000000000004",
          balance: BN.from("0"),
        },
        {
          owner: "0xaC7b6B1Deca1321ff871327E9d1256272019D201",
          pool: "0x9BE8a40C9cf00fe33fd84EAeDaA5C4fe3f04CbC3",
          token: "0x66714DB8F3397c767d0A602458B5b4E3C0FE7dd1",
          balance: BN.from("237928240622992453"),
        },
        {
          owner: "0xaC7b6B1Deca1321ff871327E9d1256272019D201",
          pool: "0x9BE8a40C9cf00fe33fd84EAeDaA5C4fe3f04CbC3",
          token: "0x866f2C06B83Df2ed7Ca9C2D044940E7CD55a06d6",
          balance: BN.from("815698702331247132488"),
        },
      ]);
    });
  });
});
