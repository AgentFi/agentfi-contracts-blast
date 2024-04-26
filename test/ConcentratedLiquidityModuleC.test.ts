/* global describe it before ethers */

import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, Contract, Signer } from "ethers";
import chai from "chai";
const { expect } = chai;

import { ConcentratedLiquidityModuleC } from "../typechain-types";

import { deployContract } from "../scripts/utils/deployContract";
import {
  price1ToTick,
  sqrtPriceX96ToPrice1,
  tickToPrice0,
} from "../scripts/utils/v3";
import { toBytes32 } from "../scripts/utils/setStorage";
import { calcSighash } from "../scripts/utils/diamond";

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

// TODO: remove ignore before merging and not autoformating
/* prettier-ignore */ const BLAST_ADDRESS                 = "0x4300000000000000000000000000000000000002";
/* prettier-ignore */ const BLAST_POINTS_ADDRESS          = "0x2fc95838c71e76ec69ff817983BFf17c710F34E0";
/* prettier-ignore */ const BLAST_POINTS_OPERATOR_ADDRESS = "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";
/* prettier-ignore */ const ENTRY_POINT_ADDRESS           = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
/* prettier-ignore */ const ERC6551_REGISTRY_ADDRESS      = "0x000000006551c19487814612e58FE06813775758";
/* prettier-ignore */ const GAS_COLLECTOR_ADDRESS         = "0xf237c20584DaCA970498917470864f4d027de4ca"; // v1.0.0
/* prettier-ignore */ const MULTICALL_FORWARDER_ADDRESS   = "0xAD55F8b65d5738C6f63b54E651A09cC5d873e4d8"; // v1.0.1
/* prettier-ignore */ const POOL_ADDRESS                  = "0xf00DA13d2960Cf113edCef6e3f30D92E52906537";
/* prettier-ignore */ const POSITION_MANAGER_ADDRESS      = "0x434575EaEa081b735C985FA9bf63CD7b87e227F9";
/* prettier-ignore */ const STRATEGY_COLLECTION_ADDRESS   = "0x73E75E837e4F3884ED474988c304dE8A437aCbEf"; // v1.0.1
/* prettier-ignore */ const STRATEGY_FACTORY_ADDRESS      = "0x09906C1eaC081AC4aF24D6F7e05f7566440b4601"; // v1.0.1
/* prettier-ignore */ const SWAP_ROUTER_ADDRESS           = "0x337827814155ECBf24D20231fCA4444F530C0555";
/* prettier-ignore */ const USDB_ADDRESS                  = "0x4300000000000000000000000000000000000003";
/* prettier-ignore */ const WETH_ADDRESS                  = "0x4300000000000000000000000000000000000004";

/* prettier-ignore */ const OWNER_ADDRESS                 = "0xA214a4fc09C42202C404E2976c50373fE5F5B789";
/* prettier-ignore */ const USER_ADDRESS                  = "0x3E0770C75c0D5aFb1CfA3506d4b0CaB11770a27a";

const functionParams: Record<
  string,
  { selector: string; requiredRole: string }
> = {
  // Public Functions
  "moduleName()": { selector: "0x93f0899a", requiredRole: toBytes32(0) },
  "strategyType()": { selector: "0x82ccd330", requiredRole: toBytes32(0) },

  "manager()": { selector: "0x481c6a75", requiredRole: toBytes32(0) },
  "tokenId()": { selector: "0x17d70f7c", requiredRole: toBytes32(0) },
  "position()": { selector: "0x09218e91", requiredRole: toBytes32(0) },

  "moduleC_position()": {
    selector: "0x0f52dd57",
    requiredRole: toBytes32(0),
  },

  // Admin Role
  // TODO:- Support admin rebalancing
  "moduleC_rebalance((address,uint24,uint24,int24,int24))": {
    selector: "0x28202ec4",
    requiredRole: toBytes32(1),
  },

  // Owner only
  "moduleC_collect()": {
    selector: "0xcd0307d7",
    requiredRole: toBytes32(1),
  },
  "moduleC_collectTo(address)": {
    selector: "0x7e551aee",
    requiredRole: toBytes32(1),
  },
  "moduleC_decreaseLiquidity(uint128)": {
    selector: "0x324f2989",
    requiredRole: toBytes32(1),
  },
  "moduleC_decreaseLiquidityTo(uint128,address)": {
    selector: "0x89f8aacc",
    requiredRole: toBytes32(1),
  },
  "moduleC_increaseLiquidity()": {
    selector: "0xc7507548",
    requiredRole: toBytes32(1),
  },
  "moduleC_mintBalance((address,address,address,uint24,int24,int24))": {
    selector: "0xc7631b98",
    requiredRole: toBytes32(1),
  },
  "moduleC_sendBalanceTo(address,address[])": {
    selector: "0x06f55b43",
    requiredRole: toBytes32(1),
  },
  "moduleC_withdrawBalance()": {
    selector: "0xae13d660",
    requiredRole: toBytes32(1),
  },
  "moduleC_withdrawBalanceTo(address)": {
    selector: "0xf992c894",
    requiredRole: toBytes32(1),
  },
};

export async function fixtureSetup(
  moduleName:
    | "ConcentratedLiquidityModuleC"
    | "ConcentratedLiquidityGatewayModuleC",
) {
  const [deployer] = await ethers.getSigners();
  const blockNumber = 2178591;
  // Run tests against forked network
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: process.env.BLAST_URL,
          blockNumber,
        },
      },
    ],
  });

  if ((await provider.getNetwork()).chainId !== 81457) {
    throw new Error("Need to run this on chainid 81457");
  }

  // ===== Deploy Module and new account
  const strategyAccountImplementation = await deployContract(
    deployer,
    "BlastooorStrategyAgentAccountV2",
    [
      BLAST_ADDRESS,
      GAS_COLLECTOR_ADDRESS,
      BLAST_POINTS_ADDRESS,
      BLAST_POINTS_OPERATOR_ADDRESS,
      ENTRY_POINT_ADDRESS,
      MULTICALL_FORWARDER_ADDRESS,
      ERC6551_REGISTRY_ADDRESS,
      ethers.constants.AddressZero,
    ],
  );

  const module = await deployContract(deployer, moduleName, [
    BLAST_ADDRESS,
    GAS_COLLECTOR_ADDRESS,
    BLAST_POINTS_ADDRESS,
    BLAST_POINTS_OPERATOR_ADDRESS,
  ]);

  // ======= Create Agent Creation Settings
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [OWNER_ADDRESS],
  });

  const owner = await provider.getSigner(OWNER_ADDRESS);
  const strategyFactory = await ethers.getContractAt(
    "BlastooorStrategyFactory",
    STRATEGY_FACTORY_ADDRESS,
    owner,
  );

  const strategyConfigID = 7;

  for (const [key, { selector }] of Object.entries(functionParams)) {
    // Check function selectors hashes are correct
    expect([key, calcSighash(key)]).to.deep.equal([key, selector]);
  }

  const overrides = [
    {
      implementation: module.address,
      functionParams: Object.values(functionParams),
    },
  ];

  await strategyFactory.connect(owner).postAgentCreationSettings({
    agentImplementation: strategyAccountImplementation.address,
    initializationCalls: [
      strategyAccountImplementation.interface.encodeFunctionData(
        "blastConfigure",
      ),
      strategyAccountImplementation.interface.encodeFunctionData(
        "setOverrides",
        [overrides],
      ),
      // Deposit? moduleC deposit
      // User approval is to factory, factory its to TBA
    ],
    isActive: true,
  });

  expect(await strategyFactory.getAgentCreationSettingsCount()).to.equal(
    strategyConfigID,
  );

  const GENESIS_COLLECTION_ADDRESS =
    "0x5066A1975BE96B777ddDf57b496397efFdDcB4A9"; // v1.0.0

  // ===== Transfer Gensis agent to user
  const genesisAgentId = 5;
  let genesisAgentAddress = "0xf93D295e760f05549451ae68A392F774428040B4";

  const genesisCollection = await ethers.getContractAt(
    "BlastooorGenesisAgents",
    GENESIS_COLLECTION_ADDRESS,
    owner,
  );

  // Send NFT 5 to user
  genesisCollection.transferFrom(OWNER_ADDRESS, USER_ADDRESS, genesisAgentId);
  const AGENT_REGISTRY_ADDRESS = "0x12F0A3453F63516815fe41c89fAe84d218Af0FAF"; // v1.0.1

  const agentRegistry = await ethers.getContractAt(
    "AgentRegistry",
    AGENT_REGISTRY_ADDRESS,
    owner,
  );

  expect(
    await agentRegistry
      .getTbasOfNft(GENESIS_COLLECTION_ADDRESS, genesisAgentId)
      .then((x) => x[0][0]),
  ).to.equal(genesisAgentAddress);

  const genesisAgent = await ethers.getContractAt(
    "BlastooorGenesisAgentAccount",
    genesisAgentAddress,
    owner,
  );

  // ===== Mint the strategy agent
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [USER_ADDRESS],
  });
  const signer = await provider.getSigner(USER_ADDRESS);

  await signer.sendTransaction({
    to: genesisAgentAddress,
    data: genesisAgent.interface.encodeFunctionData("execute", [
      strategyFactory.address,
      0,
      strategyFactory.interface.encodeFunctionData("createAgent(uint256)", [
        strategyConfigID,
      ]),
      0,
    ]),
    value: 0,
    gasLimit: 3_000_000,
  });

  const strategyAgentID = 398;
  const strategyAgentAddress = "0x6Bd112426637eaF6EF50213553c388E110a1695f";

  expect(
    await agentRegistry
      .getTbasOfNft(STRATEGY_COLLECTION_ADDRESS, strategyAgentID)
      .then((r) => r[0][0]),
  ).to.equal(strategyAgentAddress);

  const agent = await ethers.getContractAt(
    moduleName,
    strategyAgentAddress,
    signer,
  );

  const strategyAgent = await ethers.getContractAt(
    "BlastooorStrategyAgentAccountV2",
    strategyAgentAddress,
    signer,
  );

  // ===== Setup user

  // ===== Load already deployed contracts
  const USDB = await ethers.getContractAt("MockERC20", USDB_ADDRESS, signer);
  const WETH = await ethers.getContractAt("MockERC20", WETH_ADDRESS, signer);
  const pool = new ethers.Contract(
    POOL_ADDRESS,
    new ethers.utils.Interface([
      "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    ]),
    deployer,
  );
  const PositionManager = await ethers.getContractAt(
    "INonfungiblePositionManager",
    POSITION_MANAGER_ADDRESS,
    signer,
  );

  // ======= Create the agent

  return {
    PositionManager,
    USDB,
    WETH,
    module: agent,
    agent,
    pool,
    signer,
    strategyAgent,
    owner,
    genesisAgent,
  };
}

describe("ConcentratedLiquidityModuleC", function () {
  async function fixtureDeployed() {
    const fixture = await fixtureSetup("ConcentratedLiquidityModuleC");
    // Wrap existing ETH to WETH, leaving some gas
    await fixture.signer
      .sendTransaction({
        to: WETH_ADDRESS,
        value: "60764638839453191713",
      })
      .then((x) => x.wait());

    return fixture;
  }
  async function fixtureDeposited() {
    const fixture = await loadFixture(fixtureDeployed);
    const { signer, USDB, module, WETH } = fixture;

    await USDB.transfer(
      module.address,
      (await USDB.balanceOf(USER_ADDRESS)).div(2),
    );
    await WETH.transfer(
      module.address,
      (await WETH.balanceOf(USER_ADDRESS)).sub(ethers.utils.parseEther("10")),
    );

    await module
      .moduleC_mintBalance({
        manager: POSITION_MANAGER_ADDRESS,
        tickLower: -82920,
        tickUpper: -76020,
        fee: 3000,
        token0: USDB_ADDRESS,
        token1: WETH_ADDRESS,
      })
      .then((tx) => tx.wait());

    return fixture;
  }

  async function fixtureWithFees() {
    const fixture = await loadFixture(fixtureDeposited);

    const whale = "0xE7cbfb8c70d423202033aD4C51CE94ce9E21CfA2";
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [whale],
    });

    const signer = await provider.getSigner(whale);
    const router = await ethers.getContractAt(
      "ISwapRouter",
      SWAP_ROUTER_ADDRESS,
      signer,
    );

    const USDB = await ethers.getContractAt("MockERC20", USDB_ADDRESS, signer);
    const WETH = await ethers.getContractAt("MockERC20", WETH_ADDRESS, signer);

    await USDB.approve(router.address, ethers.constants.MaxUint256);
    await WETH.approve(router.address, ethers.constants.MaxUint256);

    // Swap back and forth to generate fees on both sides
    await router.exactInputSingle({
      amountIn: await USDB.balanceOf(whale),
      amountOutMinimum: 0,
      deadline: (await provider.getBlock("latest")).timestamp + 1000,
      fee: 3000,
      recipient: whale,
      sqrtPriceLimitX96: 0,
      tokenIn: USDB_ADDRESS,
      tokenOut: WETH_ADDRESS,
    });

    await router.exactInputSingle({
      amountIn: await WETH.balanceOf(whale),
      amountOutMinimum: 0,
      deadline: (await provider.getBlock("latest")).timestamp + 1000,
      fee: 3000,
      recipient: whale,
      sqrtPriceLimitX96: 0,
      tokenIn: WETH_ADDRESS,
      tokenOut: USDB_ADDRESS,
    });

    return fixture;
  }

  it("Verify initial pool state", async () => {
    const { pool } = await loadFixture(fixtureDeployed);

    const [sqrtPriceX96, tick] = await pool.slot0();
    const price = sqrtPriceX96ToPrice1(BigInt(sqrtPriceX96.toString()));

    expect(sqrtPriceX96).to.equal(BN.from("1392486909633467119786647344"));
    expect(tick).to.equal(BN.from("-80829"));

    expect(1 / tickToPrice0(tick)).to.equal(3237.303088069362);
    expect(price).to.equal(3236.9999999999995);
  });

  it("View initial state", async function () {
    const { module } = await loadFixture(fixtureDeployed);
    expect(await module.manager()).to.equal(
      "0x0000000000000000000000000000000000000000",
    );

    await expect(module.position()).to.be.revertedWith(
      "No existing position to view",
    );
  });

  it("Can view existing position ", async function () {
    const { module, pool } = await loadFixture(fixtureDeposited);

    // expect(await module.token0()).to.equal(USDB_ADDRESS);
    // expect(await module.token1()).to.equal(WETH_ADDRESS);
    expect(await module.manager()).to.equal(POSITION_MANAGER_ADDRESS);
    expect(await module.tokenId()).to.deep.equal(BN.from("54353"));

    expect(convertToStruct(await module.position())).to.deep.equal({
      nonce: BN.from("0"),
      operator: "0x0000000000000000000000000000000000000000",
      token0: "0x4300000000000000000000000000000000000003",
      token1: "0x4300000000000000000000000000000000000004",
      fee: 3000,
      tickLower: -82920,
      tickUpper: -76020,
      liquidity: BN.from("16983715425639545311351"),
      feeGrowthInside0LastX128: BN.from(
        "223062771100361370800904183975351004548",
      ),
      feeGrowthInside1LastX128: BN.from("63771321919466126002465612072408134"),
      tokensOwed0: BN.from("0"),
      tokensOwed1: BN.from("0"),
    });

    const [, tick] = await pool.slot0();
    expect(tick).to.equal(BN.from("-80829"));
  });

  describe("Deposit flow", () => {
    it("Can reject invalid tick range", async () => {
      const { module } = await loadFixture(fixtureDeployed);

      await expect(
        module.moduleC_mintBalance({
          manager: POSITION_MANAGER_ADDRESS,
          tickLower: -80880,
          tickUpper: -81480,
          fee: 3000,
          token0: USDB_ADDRESS,
          token1: WETH_ADDRESS,
        }),
      ).to.be.revertedWith("Invalid tick range");
    });

    it("Can reject deposit when position exists", async function () {
      const { module, USDB, WETH, signer } =
        await loadFixture(fixtureDeposited);
      // Transfer all assets to tba
      await USDB.transfer(module.address, USDB.balanceOf(USER_ADDRESS));
      await WETH.transfer(module.address, WETH.balanceOf(USER_ADDRESS));

      expect(await module.tokenId()).to.deep.equal(BN.from("54353"));
      // Trigger the deposit
      await expect(
        module.moduleC_mintBalance({
          manager: POSITION_MANAGER_ADDRESS,
          tickLower: price1ToTick(4000),
          tickUpper: price1ToTick(2000),
          fee: 3000,
          token0: USDB_ADDRESS,
          token1: WETH_ADDRESS,
        }),
      ).to.be.revertedWith("Cannot deposit with existing position");
    });

    it("Can deposit with WETH", async function () {
      const { module, USDB, WETH, PositionManager } =
        await loadFixture(fixtureDeployed);
      // Expect no assets in tba
      expect(
        await Promise.all([
          provider.getBalance(module.address),
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("0"), BN.from("0")]);

      // Transfer all assets to tba
      await USDB.transfer(module.address, USDB.balanceOf(USER_ADDRESS));
      await WETH.transfer(module.address, WETH.balanceOf(USER_ADDRESS));

      // Trigger the deposit
      await module
        .moduleC_mintBalance({
          manager: POSITION_MANAGER_ADDRESS,
          tickLower: price1ToTick(4000),
          tickUpper: price1ToTick(2000),
          fee: 3000,
          token0: USDB_ADDRESS,
          token1: WETH_ADDRESS,
        })
        .then((tx) => tx.wait());

      // Expect all Assets to be transferred to tba
      expect(
        await Promise.all([
          USDB.balanceOf(USER_ADDRESS),
          WETH.balanceOf(USER_ADDRESS),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("0")]);

      const tokenId = await module.tokenId();

      // Position to be minted
      expect(
        convertToStruct(await PositionManager.positions(tokenId)),
      ).to.deep.equal({
        nonce: BN.from("0"),
        operator: "0x0000000000000000000000000000000000000000",
        token0: "0x4300000000000000000000000000000000000003",
        token1: "0x4300000000000000000000000000000000000004",
        fee: 3000,
        tickLower: -82920,
        tickUpper: -76020,
        liquidity: BN.from("33967430851279090622703"),
        feeGrowthInside0LastX128: BN.from(
          "223062771100361370800904183975351004548",
        ),
        feeGrowthInside1LastX128: BN.from(
          "63771321919466126002465612072408134",
        ),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });
      // Only leftover on one side
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("10"), BN.from("1499144318855151962")]);
    });
  });

  describe("Partial Deposit flow", () => {
    it("Rejects partial deposit when no position exists", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureDeployed);

      await USDB.transfer(module.address, USDB.balanceOf(USER_ADDRESS));
      await WETH.transfer(module.address, WETH.balanceOf(USER_ADDRESS));

      await expect(module.moduleC_increaseLiquidity()).to.be.revertedWith(
        "No existing position to increase",
      );
    });

    it("Can do partial deposit", async () => {
      const { module, USDB, WETH, PositionManager } =
        await loadFixture(fixtureDeposited);

      await USDB.transfer(module.address, USDB.balanceOf(USER_ADDRESS));
      await WETH.transfer(module.address, WETH.balanceOf(USER_ADDRESS));

      const tokenId = await module.tokenId();

      // Position to be minted
      expect(
        convertToStruct(await PositionManager.positions(tokenId)),
      ).to.deep.equal({
        nonce: BN.from("0"),
        operator: "0x0000000000000000000000000000000000000000",
        token0: "0x4300000000000000000000000000000000000003",
        token1: "0x4300000000000000000000000000000000000004",
        fee: 3000,
        tickLower: -82920,
        tickUpper: -76020,
        liquidity: BN.from("16983715425639545311351"),
        feeGrowthInside0LastX128: BN.from(
          "223062771100361370800904183975351004548",
        ),
        feeGrowthInside1LastX128: BN.from(
          "63771321919466126002465612072408134",
        ),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      await module.moduleC_increaseLiquidity().then((tx) => tx.wait());

      // Position to be minted
      expect(
        convertToStruct(await PositionManager.positions(tokenId)),
      ).to.deep.equal({
        nonce: BN.from("0"),
        operator: "0x0000000000000000000000000000000000000000",
        token0: "0x4300000000000000000000000000000000000003",
        token1: "0x4300000000000000000000000000000000000004",
        fee: 3000,
        tickLower: -82920,
        tickUpper: -76020,
        liquidity: BN.from("33967430851279090622703"),
        feeGrowthInside0LastX128: BN.from(
          "223062771100361370800904183975351004548",
        ),
        feeGrowthInside1LastX128: BN.from(
          "63771321919466126002465612072408134",
        ),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("10"), BN.from("1499144318855151961")]);
    });
  });

  describe("Withdrawal tests", () => {
    it("Can withdrawal to tba", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureDeposited);
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("11"), BN.from("21131891579154171837")]);

      await module.moduleC_withdrawBalance().then((tx) => tx.wait());

      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([
        BN.from("206513078828369975841635"),
        BN.from("50764638839453191712"),
      ]);
      // TODO:- Check if position is burned
    });

    it("Can withdrawal to user", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureDeposited);
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("11"), BN.from("21131891579154171837")]);

      await module
        .moduleC_withdrawBalanceTo(USER_ADDRESS)
        .then((tx) => tx.wait());

      expect(
        await Promise.all([
          USDB.balanceOf(USER_ADDRESS),
          WETH.balanceOf(USER_ADDRESS),
        ]),
      ).to.deep.equal([
        BN.from("413026157656739951683271"),
        BN.from("60764638839453191712"),
      ]);
    });
  });

  describe("Collect test suite", () => {
    it("Can collect unclaimed tokens to contract", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureWithFees);

      const usdb = await USDB.balanceOf(module.address);
      const weth = await WETH.balanceOf(module.address);

      // need to generate some fees
      await module.moduleC_collect();

      // Expect balances to have increased
      expect((await USDB.balanceOf(module.address)).sub(usdb)).to.equal(
        "64580542070095326820",
      );

      expect((await WETH.balanceOf(module.address)).sub(weth)).to.equal(
        "19414419086195386",
      );
    });

    it("Can collect unclaimed tokens to user", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureWithFees);

      const usdb = await USDB.balanceOf(USER_ADDRESS);
      const weth = await WETH.balanceOf(USER_ADDRESS);

      // need to generate some fees
      await module.moduleC_collectTo(USER_ADDRESS);

      // Expect balances to have increased
      expect((await USDB.balanceOf(USER_ADDRESS)).sub(usdb)).to.equal(
        "64580542070095326820",
      );

      expect((await WETH.balanceOf(USER_ADDRESS)).sub(weth)).to.equal(
        "19414419086195386",
      );
    });
  });

  describe("Partial Withdrawal test suite", () => {
    it("Can handle partial withdrawal", async () => {
      const { module, USDB, WETH, PositionManager } =
        await loadFixture(fixtureDeposited);

      expect(await USDB.balanceOf(USER_ADDRESS)).to.equal(
        BN.from("206513078828369975841636"),
      );
      expect(await WETH.balanceOf(USER_ADDRESS)).to.equal(
        BN.from("10000000000000000000"),
      );

      expect(convertToStruct(await module.position()).liquidity).to.deep.equal(
        BN.from("16983715425639545311351"),
      );
      await module.moduleC_decreaseLiquidityTo(
        BN.from("16983715425639545311351").div(2),
        USER_ADDRESS,
      );
      // Expect user balance to have increased, and liquidity decreased
      expect(convertToStruct(await module.position()).liquidity).to.deep.equal(
        BN.from("8491857712819772655676"),
      );
      expect(await USDB.balanceOf(USER_ADDRESS)).to.equal(
        BN.from("309769618242554963762453"),
      );
      expect(await WETH.balanceOf(USER_ADDRESS)).to.equal(
        BN.from("45948265209303681774"),
      );
    });
  });

  describe("Rebalance tests", () => {
    it("Can reject invalid tick range", async () => {
      const { module } = await loadFixture(fixtureDeposited);

      await expect(
        module.moduleC_rebalance({
          fee: 3000,
          router: SWAP_ROUTER_ADDRESS,
          slippage: 10000,
          tickLower: -80880,
          tickUpper: -81480,
        }),
      ).to.be.revertedWith("Invalid tick range");
    });

    it("Can handle slippage rejection", async () => {
      const { module } = await loadFixture(fixtureDeposited);

      await expect(
        module.moduleC_rebalance({
          fee: 3000,
          router: SWAP_ROUTER_ADDRESS,
          slippage: 1000, // 0.1%
          tickLower: -82020,
          tickUpper: -79620,
        }),
      ).to.be.revertedWith("Too little received");
    });

    it("Can rebalance with range below spot", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureDeposited);

      await module
        .moduleC_rebalance({
          fee: 3000,
          router: SWAP_ROUTER_ADDRESS,
          slippage: 10000,
          tickLower: -81480,
          tickUpper: -80880,
        })
        .then((tx) => tx.wait());

      expect(convertToStruct(await module.position())).to.deep.equal({
        nonce: BN.from("0"),
        operator: "0x0000000000000000000000000000000000000000",
        token0: "0x4300000000000000000000000000000000000003",
        token1: "0x4300000000000000000000000000000000000004",
        fee: 3000,
        tickLower: -81480,
        tickUpper: -80880,
        liquidity: BN.from("220501559037418155599415"),
        feeGrowthInside0LastX128: BN.from(
          "42513878182514160766987893019469054669",
        ),
        feeGrowthInside1LastX128: BN.from(
          "13023098774273606467765194624496836",
        ),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      // Only leftover on one side
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("0")]);
    });
    it("Can rebalance with range above spot", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureDeposited);

      await module
        .moduleC_rebalance({
          fee: 3000,
          router: SWAP_ROUTER_ADDRESS,
          slippage: 10000,
          tickLower: -80760,
          tickUpper: -80160,
        })
        .then((tx) => tx.wait());

      expect(convertToStruct(await module.position())).to.deep.equal({
        nonce: BN.from("0"),
        operator: "0x0000000000000000000000000000000000000000",
        token0: "0x4300000000000000000000000000000000000003",
        token1: "0x4300000000000000000000000000000000000004",
        fee: 3000,
        tickLower: -80760,
        tickUpper: -80160,
        liquidity: BN.from("220861659615030936879201"),
        feeGrowthInside0LastX128: BN.from(
          "15587114568347021521255615515708401802",
        ),
        feeGrowthInside1LastX128: BN.from("5123521478022653752891070772181702"),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      // Only leftover on one side
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("0")]);
    });

    it("Can rebalance equal", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureDeposited);
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("11"), BN.from("21131891579154171837")]);

      expect(await module.tokenId()).to.deep.equal(BN.from("54353"));

      await module
        .moduleC_rebalance({
          fee: 3000,
          router: SWAP_ROUTER_ADDRESS,
          slippage: 10000,
          tickLower: -82020,
          tickUpper: -79620,
        })
        .then((tx) => tx.wait());

      expect(convertToStruct(await module.position())).to.deep.equal({
        nonce: BN.from("0"),
        operator: "0x0000000000000000000000000000000000000000",
        token0: "0x4300000000000000000000000000000000000003",
        token1: "0x4300000000000000000000000000000000000004",
        fee: 3000,
        tickLower: -82020,
        tickUpper: -79620,
        liquidity: BN.from("55739009505790607644248"),
        feeGrowthInside0LastX128: BN.from(
          "164500857552271469339101134859378297624",
        ),
        feeGrowthInside1LastX128: BN.from(
          "47566901442692672301425492992783708",
        ),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      // Only leftover on one side
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("442634440538521250")]);
    });
  });
});
