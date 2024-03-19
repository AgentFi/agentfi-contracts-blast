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
const BLAST_POINTS_ADDRESS = "0x2fc95838c71e76ec69ff817983BFf17c710F34E0";
const BLAST_POINTS_OPERATOR_ADDRESS =
  "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";
const GAS_COLLECTOR_ADDRESS = "0xf237c20584DaCA970498917470864f4d027de4ca"; // v1.0.0

describe("Balancer Fetch Forked Sepolia Test", function () {
  let deployer: SignerWithAddress;
  let chainID: number;
  let networkSettings: any;
  let snapshot: BN;

  let agentFetcher: AgentFetcher;

  before(async function () {
    const blockNumber = await provider.getBlockNumber();
    if (blockNumber !== 2311403) {
      // Note: Block height chosen at random, done to make tests deterministic
      throw new Error(
        "Tests expected to run against forked blast sepolia network at block 2311403",
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

  const erc20s = [
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000002",
  ];

  describe("Fetch agents", function () {
    it("Can handle empty nft collection array", async function () {
      let account = "0xE89c1F56B7d46EA0Dccb8512cDE03f6Be4E94986";
      let res = await agentFetcher.callStatic.fetchAgents(account, [], []);

      expect(res).deep.eq([]);
    });

    it("Can fetch agents for eoa on one nft collection", async function () {
      let account = "0xE89c1F56B7d46EA0Dccb8512cDE03f6Be4E94986";
      let res = await agentFetcher.callStatic
        .fetchAgents(
          account,
          ["0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b"],
          erc20s,
        )
        .then((r) => r.map(convertToStruct));

      // console.table(res);

      expect(res).deep.eq([
        {
          agentAddress: "0xEfAce6eF46De81389DcD34849564EA5179E7A43c",
          implementation: "0x25a9aD7766D2857E4EB320a9557F637Bd748b97c",
          owner: "0xE89c1F56B7d46EA0Dccb8512cDE03f6Be4E94986",
          collection: "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          tokenId: BN.from("80"),
          balances: [
            BN.from("0"),
            BN.from("15119128612598"),
            BN.from("1833481325106"),
          ],
        },
        {
          agentAddress: "0x7ef72c9f6Cf1e50a96Aed7B1EFa4ea25B710B81C",
          implementation: "0x25a9aD7766D2857E4EB320a9557F637Bd748b97c",
          owner: "0xE89c1F56B7d46EA0Dccb8512cDE03f6Be4E94986",
          collection: "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          tokenId: BN.from("92"),
          balances: [
            BN.from("0"),
            BN.from("42066658252091"),
            BN.from("4822561322368"),
          ],
        },
        {
          agentAddress: "0x5206eB38E635ac1875afeD421dA83b8Fe8FF50Ce",
          implementation: "0x25a9aD7766D2857E4EB320a9557F637Bd748b97c",
          owner: "0xE89c1F56B7d46EA0Dccb8512cDE03f6Be4E94986",
          collection: "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          tokenId: BN.from("96"),
          balances: [
            BN.from("0"),
            BN.from("57088871916603"),
            BN.from("6536652775248"),
          ],
        },
        {
          agentAddress: "0x8Fa34e3B7c5857A011aE0482A14d18Af20a54399",
          implementation: "0x68e362fC50d62af91Aba1d9184c63505C9EA02c8",
          owner: "0xEfAce6eF46De81389DcD34849564EA5179E7A43c",
          collection: "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          tokenId: BN.from("81"),
          balances: [
            BN.from("0"),
            BN.from("29299232182807"),
            BN.from("3553088039900"),
          ],
        },
        {
          agentAddress: "0xF8568528B2eD70C9cA78694f302B41B62a65A965",
          implementation: "0x68e362fC50d62af91Aba1d9184c63505C9EA02c8",
          owner: "0x7ef72c9f6Cf1e50a96Aed7B1EFa4ea25B710B81C",
          collection: "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          tokenId: BN.from("93"),
          balances: [
            BN.from("0"),
            BN.from("81520589273509"),
            BN.from("9345597134223"),
          ],
        },
        {
          agentAddress: "0xdEEBE64D24eCb86B351Bb83Baf0D62EFA78CfA8C",
          implementation: "0x68e362fC50d62af91Aba1d9184c63505C9EA02c8",
          owner: "0x5206eB38E635ac1875afeD421dA83b8Fe8FF50Ce",
          collection: "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          tokenId: BN.from("97"),
          balances: [
            BN.from("0"),
            BN.from("110632258552041"),
            BN.from("12667348917886"),
          ],
        },
        {
          agentAddress: "0x5D2f332E759c0C0397e15110cf3d72BEB0F1Ef0e",
          implementation: "0xD9F32ab36bCB6dD3005038DeB53f9ed742947b64",
          owner: "0x8Fa34e3B7c5857A011aE0482A14d18Af20a54399",
          collection: "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          tokenId: BN.from("82"),
          balances: [
            BN.from("0"),
            BN.from("47081159099995"),
            BN.from("5709484202832"),
          ],
        },
        {
          agentAddress: "0x33EA056c4ab58d2c0736B5C6906FFBAcE782C759",
          implementation: "0xC33F80Ca19c8Cbc55837F4B6c6EC5C3FE7c4400f",
          owner: "0x8Fa34e3B7c5857A011aE0482A14d18Af20a54399",
          collection: "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          tokenId: BN.from("83"),
          balances: [
            BN.from("0"),
            BN.from("33805098056991"),
            BN.from("4099509804371"),
          ],
        },
        {
          agentAddress: "0x6179dE7Bf7816387D18a706F51767Be748629eea",
          implementation: "0xD9F32ab36bCB6dD3005038DeB53f9ed742947b64",
          owner: "0xF8568528B2eD70C9cA78694f302B41B62a65A965",
          collection: "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          tokenId: BN.from("94"),
          balances: [
            BN.from("0"),
            BN.from("130996172022962"),
            BN.from("15017524539041"),
          ],
        },
        {
          agentAddress: "0x9C0CD367Fb078b4abc092E9DbaB8E93Fee4c8bc4",
          implementation: "0xC33F80Ca19c8Cbc55837F4B6c6EC5C3FE7c4400f",
          owner: "0xF8568528B2eD70C9cA78694f302B41B62a65A965",
          collection: "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          tokenId: BN.from("95"),
          balances: [
            BN.from("0"),
            BN.from("94057633479799"),
            BN.from("10782855690007"),
          ],
        },
        {
          agentAddress: "0x06e7d4775C5b26310025902536Eb5E842fbB5B2C",
          implementation: "0xD9F32ab36bCB6dD3005038DeB53f9ed742947b64",
          owner: "0xdEEBE64D24eCb86B351Bb83Baf0D62EFA78CfA8C",
          collection: "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          tokenId: BN.from("98"),
          balances: [
            BN.from("0"),
            BN.from("177775392719933"),
            BN.from("20355210659813"),
          ],
        },
        {
          agentAddress: "0x14C0f5ef52460F9d58672077e5F7E1D2D56baEB9",
          implementation: "0xC33F80Ca19c8Cbc55837F4B6c6EC5C3FE7c4400f",
          owner: "0xdEEBE64D24eCb86B351Bb83Baf0D62EFA78CfA8C",
          collection: "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          tokenId: BN.from("99"),
          balances: [
            BN.from("0"),
            BN.from("127646313568934"),
            BN.from("14615451345043"),
          ],
        },
      ]);
    });

    it("Can fetch agents for root agent", async function () {
      let res = await agentFetcher.callStatic.fetchAgents(
        "0xa9b7B191DA5749A203D8e6637C71cE4A92803F99",
        ["0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b"],
        erc20s,
      );

      expect(res.map(convertToStruct)).deep.eq([
        {
          agentAddress: "0xC541D6cb7302535390Ff10b2AFFcf95DFD190629",
          implementation: "0x68e362fC50d62af91Aba1d9184c63505C9EA02c8",
          owner: "0xa9b7B191DA5749A203D8e6637C71cE4A92803F99",
          collection: "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          tokenId: BN.from("21"),
          balances: [
            BN.from("0"),
            BN.from("157884215821716"),
            BN.from("26537060486978"),
          ],
        },
        {
          agentAddress: "0x5A117d079b2C1272bC2B13f57B80687D5002483f",
          implementation: "0xD9F32ab36bCB6dD3005038DeB53f9ed742947b64",
          owner: "0xC541D6cb7302535390Ff10b2AFFcf95DFD190629",
          collection: "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          tokenId: BN.from("22"),
          balances: [
            BN.from("0"),
            BN.from("253704472113268"),
            BN.from("42642457241509"),
          ],
        },
        {
          agentAddress: "0x0879DcE6101cF72545F59aE8d0b6A1A099464F8F",
          implementation: "0xC33F80Ca19c8Cbc55837F4B6c6EC5C3FE7c4400f",
          owner: "0xC541D6cb7302535390Ff10b2AFFcf95DFD190629",
          collection: "0xd1c6ABe9BEa98CA9875A4b3EEed3a62bC121963b",
          tokenId: BN.from("23"),
          balances: [
            BN.from("0"),
            BN.from("182163982007902"),
            BN.from("30617985363091"),
          ],
        },
      ]);
    });
  });
});
