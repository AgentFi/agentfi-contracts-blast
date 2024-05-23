/* global describe it before ethers */

import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN } from "ethers";
import chai from "chai";
const { expect } = chai;

import {
  AgentRegistry,
  BlastooorAccountFactory,
  BlastooorGenesisAgentAccount,
  BlastooorGenesisFactory,
  BlastooorStrategyAgents,
  BlastooorStrategyFactory,
  ConcentratedLiquidityHyperlockModuleC,
} from "../typechain-types";

import { deployContract } from "../scripts/utils/deployContract";
import {
  price1ToTick,
  sqrtPriceX96ToPrice1,
  tickToPrice0,
} from "../scripts/utils/v3";
import { toBytes32 } from "../scripts/utils/setStorage";
import { calcSighash } from "../scripts/utils/diamond";
import { BlastooorGenesisAgents } from "../typechain-types/contracts/tokens/BlastooorGenesisAgents";
import { convertToStruct } from "../scripts/utils/test";
import { moduleCFunctionParams as functionParams } from "../scripts/configuration/ConcentratedLiquidityModuleC";

/* prettier-ignore */ const BLAST_ADDRESS                 = "0x4300000000000000000000000000000000000002";
/* prettier-ignore */ const BLAST_POINTS_ADDRESS          = "0x2fc95838c71e76ec69ff817983BFf17c710F34E0";
/* prettier-ignore */ const BLAST_POINTS_OPERATOR_ADDRESS = "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";
/* prettier-ignore */ const ENTRY_POINT_ADDRESS           = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
/* prettier-ignore */ const ERC6551_REGISTRY_ADDRESS      = "0x000000006551c19487814612e58FE06813775758";
/* prettier-ignore */ const POOL_ADDRESS                  = "0xf00DA13d2960Cf113edCef6e3f30D92E52906537";
/* prettier-ignore */ const POSITION_MANAGER_ADDRESS      = "0x434575EaEa081b735C985FA9bf63CD7b87e227F9";
/* prettier-ignore */ const SWAP_ROUTER_ADDRESS           = "0x337827814155ECBf24D20231fCA4444F530C0555";
/* prettier-ignore */ const USDB_ADDRESS                  = "0x4300000000000000000000000000000000000003";
/* prettier-ignore */ const WETH_ADDRESS                  = "0x4300000000000000000000000000000000000004";

/* prettier-ignore */ const OWNER_ADDRESS                 = "0xA214a4fc09C42202C404E2976c50373fE5F5B789";
/* prettier-ignore */ const USER_ADDRESS                  = "0x3E0770C75c0D5aFb1CfA3506d4b0CaB11770a27a";

const permissions = Object.entries({
  // Public
  [toBytes32(0)]: [
    "manager()",
    "moduleName()",
    "pool()",
    "position()",
    "slot0()",
    "strategyType()",
    "tokenId()",

    // Hyperlock only - This collides with dex balancer function
    "hyperlockStaking()",
  ],
  // AgentFi + Owner
  [toBytes32(9)]: [
    "moduleC_burn()",
    "moduleC_collect((uint128,uint128))",
    "moduleC_collectToSelf()",
    "moduleC_decreaseLiquidity((uint128,uint256,uint256,uint256))",
    "moduleC_decreaseLiquidityWithSlippage(uint128,uint160,uint24)",
    "moduleC_exactInputSingle(address,(address,address,uint24,uint256,uint256,uint256,uint160))",
    "moduleC_exactInputSingle02(address,(address,address,uint24,uint256,uint256,uint160))",
    "moduleC_fullWithdrawToSelf(uint160,uint24)",
    "moduleC_increaseLiquidity((uint256,uint256,uint256,uint256,uint256))",
    "moduleC_increaseLiquidityWithBalance(uint160,uint24)",
    "moduleC_mint((address,address,address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,uint256))",
    "moduleC_mintWithBalance((address,address,uint24,int24,int24,uint160))",
    "moduleC_partialWithdrawalToSelf(uint128,uint160,uint24)",
    "moduleC_rebalance((address,uint24,uint24,uint24,int24,int24,uint160))",
    "moduleC_rebalance02((address,uint24,uint24,uint24,int24,int24,uint160))",
    "moduleC_wrap()",
  ],

  // Owner Only:
  [toBytes32(1)]: [
    "moduleC_collectTo(address)",
    "moduleC_fullWithdrawTo(address,uint160,uint24)",
    "moduleC_increaseLiquidityWithBalanceAndRefundTo(address,uint160,uint24)",
    "moduleC_mintWithBalanceAndRefundTo((address,address,uint24,int24,int24,uint160,address))",
    "moduleC_partialWithdrawTo(address,uint128,uint160,uint24)",
    "moduleC_sendBalanceTo(address)",
  ],
}).reduce(
  (acc, [requiredRole, functions]) => {
    functions.forEach((func) => {
      acc.push({ selector: calcSighash(func, true), requiredRole });
    });

    return acc;
  },
  [] as { selector: string; requiredRole: string }[],
);

expect(functionParams).to.deep.equal(permissions);

export async function fixtureSetup(
  moduleName:
    | "ConcentratedLiquidityGatewayModuleC"
    | "ConcentratedLiquidityHyperlockModuleC"
    | "ConcentratedLiquidityModuleC",
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

  // console.log(Object.keys(module.functions).filter((x) => x.includes("(")));

  // ======= Setup
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [OWNER_ADDRESS],
  });

  const owner = await provider.getSigner(OWNER_ADDRESS);

  const gasCollector = await deployContract(deployer, "GasCollector", [
    OWNER_ADDRESS,
    BLAST_ADDRESS,
    BLAST_POINTS_ADDRESS,
    BLAST_POINTS_OPERATOR_ADDRESS,
  ]);

  const genesisAgentNft = (await deployContract(
    deployer,
    "BlastooorGenesisAgents",
    [
      OWNER_ADDRESS,
      BLAST_ADDRESS,
      gasCollector.address,
      BLAST_POINTS_ADDRESS,
      BLAST_POINTS_OPERATOR_ADDRESS,
      ERC6551_REGISTRY_ADDRESS,
    ],
  )) as BlastooorGenesisAgents;

  const multicallForwarder = await deployContract(
    deployer,
    "MulticallForwarder",
    [
      BLAST_ADDRESS,
      gasCollector.address,
      BLAST_POINTS_ADDRESS,
      BLAST_POINTS_OPERATOR_ADDRESS,
    ],
  );

  // Deploy genesis account implementation
  const genesisAccountImplementation = (await deployContract(
    deployer,
    "BlastooorGenesisAgentAccount",
    [
      BLAST_ADDRESS,
      gasCollector.address,
      BLAST_POINTS_ADDRESS,
      BLAST_POINTS_OPERATOR_ADDRESS,
      ENTRY_POINT_ADDRESS,
      multicallForwarder.address,
      ERC6551_REGISTRY_ADDRESS,
      ethers.constants.AddressZero,
    ],
  )) as BlastooorGenesisAgentAccount;

  const genesisFactory = (await deployContract(
    deployer,
    "BlastooorGenesisFactory",
    [
      OWNER_ADDRESS,
      BLAST_ADDRESS,
      gasCollector.address,
      BLAST_POINTS_ADDRESS,
      BLAST_POINTS_OPERATOR_ADDRESS,
      genesisAgentNft.address,
    ],
  )) as BlastooorGenesisFactory;

  const agentRegistry = (await deployContract(deployer, "AgentRegistry", [
    OWNER_ADDRESS,
    BLAST_ADDRESS,
    gasCollector.address,
    BLAST_POINTS_ADDRESS,
    BLAST_POINTS_OPERATOR_ADDRESS,
  ])) as AgentRegistry;

  const genesisAccountFactory = (await deployContract(
    deployer,
    "BlastooorAccountFactory",
    [
      OWNER_ADDRESS,
      BLAST_ADDRESS,
      gasCollector.address,
      BLAST_POINTS_ADDRESS,
      BLAST_POINTS_OPERATOR_ADDRESS,
      multicallForwarder.address,
      genesisAgentNft.address,
      agentRegistry.address,
      ERC6551_REGISTRY_ADDRESS,
    ],
  )) as BlastooorAccountFactory;

  const strategyAgentNft = (await deployContract(
    deployer,
    "BlastooorStrategyAgents",
    [
      OWNER_ADDRESS,
      BLAST_ADDRESS,
      gasCollector.address,
      BLAST_POINTS_ADDRESS,
      BLAST_POINTS_OPERATOR_ADDRESS,
    ],
  )) as BlastooorStrategyAgents;

  const strategyAccountImplementation = await deployContract(
    deployer,
    "BlastooorStrategyAgentAccountV2",
    [
      BLAST_ADDRESS,
      gasCollector.address,
      BLAST_POINTS_ADDRESS,
      BLAST_POINTS_OPERATOR_ADDRESS,
      ENTRY_POINT_ADDRESS,
      multicallForwarder.address,
      ERC6551_REGISTRY_ADDRESS,
      ethers.constants.AddressZero,
    ],
  );

  const strategyFactory = (await deployContract(
    deployer,
    "BlastooorStrategyFactory",
    [
      OWNER_ADDRESS,
      BLAST_ADDRESS,
      gasCollector.address,
      BLAST_POINTS_ADDRESS,
      BLAST_POINTS_OPERATOR_ADDRESS,
      genesisAgentNft.address,
      strategyAgentNft.address,
      ERC6551_REGISTRY_ADDRESS,
      agentRegistry.address,
    ],
  )) as BlastooorStrategyFactory;

  // Whitelist Factory
  await genesisAgentNft.connect(owner).setWhitelist([
    {
      factory: genesisFactory.address,
      shouldWhitelist: true,
    },
  ]);

  // Create genesis settings
  await genesisFactory.connect(owner).postAgentCreationSettings({
    agentImplementation: genesisAccountImplementation.address,
    initializationCalls: [],
    isActive: true,
    // paymentToken: ethers.constants.AddressZero,
    paymentAmount: ethers.constants.WeiPerEther.mul(1).div(100),
    paymentReceiver: OWNER_ADDRESS,
    timestampAllowlistMintStart: 0,
    timestampAllowlistMintEnd: 1,
    timestampPublicMintStart: 0,
  });

  await agentRegistry.connect(owner).setOperators([
    {
      account: genesisAccountFactory.address,
      isAuthorized: true,
    },
  ]);

  await genesisAccountFactory.connect(owner).postAgentCreationSettings({
    agentImplementation: genesisAccountImplementation.address,
    initializationCalls: [
      genesisAccountImplementation.interface.encodeFunctionData(
        "blastConfigure",
      ),
    ],
    isActive: true,
  });

  await strategyAgentNft.connect(owner).setWhitelist([
    {
      factory: strategyFactory.address,
      shouldWhitelist: true,
    },
  ]);

  const strategyConfigID = 1;

  // ===== Deploy Module and new account

  const module = await deployContract(deployer, moduleName, [
    BLAST_ADDRESS,
    gasCollector.address,
    BLAST_POINTS_ADDRESS,
    BLAST_POINTS_OPERATOR_ADDRESS,
  ]);

  const overrides = [
    {
      implementation: module.address,
      functionParams: functionParams,
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

  const genesisAgentId = 1;
  let genesisAgentAddress = "0x87862cDA0357756faBc999cA872C81508fb62F40";

  // ===== Mint the strategy agent
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [USER_ADDRESS],
  });
  const signer = await provider.getSigner(USER_ADDRESS);

  // Create agent
  await genesisFactory
    .connect(signer)
    .blastooorPublicMint(1, { value: ethers.constants.WeiPerEther.div(100) });

  await agentRegistry.connect(owner).setOperators([
    {
      account: strategyFactory.address,
      isAuthorized: true,
    },
  ]);

  await genesisAccountFactory.connect(owner).setMaxCreationsPerAgent(999);
  await genesisAccountFactory
    .connect(signer)
    ["createAccount(uint256,uint256)"](1, 1);

  await strategyFactory.connect(owner).setMaxCreationsPerGenesisAgent(999);
  expect(
    await agentRegistry
      .getTbasOfNft(genesisAgentNft.address, genesisAgentId)
      .then((x) => x[0][0]),
  ).to.equal(genesisAgentAddress);

  const genesisAgent = await ethers.getContractAt(
    "BlastooorGenesisAgentAccount",
    genesisAgentAddress,
    owner,
  );
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

  const strategyAgentID = 1;
  const strategyAgentAddress = "0x8C6A882eA6998F0f6617567628AAF90e50e76d52";

  expect(
    await agentRegistry
      .getTbasOfNft(strategyAgentNft.address, strategyAgentID)
      .then((r) => r[0][0]),
  ).to.equal(strategyAgentAddress);

  const agent = (await ethers.getContractAt(
    moduleName,
    strategyAgentAddress,
    signer,
  )) as ConcentratedLiquidityHyperlockModuleC;

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
      "event Swap( address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
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
  const sqrtPriceX96 = BN.from("1392486909633467119786647344");

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
    const { USDB, module, WETH } = fixture;

    await USDB.transfer(
      module.address,
      (await USDB.balanceOf(USER_ADDRESS)).div(2),
    );
    await WETH.transfer(
      module.address,
      (await WETH.balanceOf(USER_ADDRESS)).sub(ethers.utils.parseEther("10")),
    );

    await module
      .moduleC_mintWithBalance({
        manager: POSITION_MANAGER_ADDRESS,
        pool: POOL_ADDRESS,
        slippageLiquidity: 1_000_000,
        sqrtPriceX96,
        tickLower: -82920,
        tickUpper: -76020,
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

    expect(await module.pool()).to.equal(
      "0x0000000000000000000000000000000000000000",
    );

    expect(await module.tokenId()).to.equal("0");
    expect(await module.strategyType()).to.equal("Concentrated Liquidity");
    expect(await module.moduleName()).to.equal("ConcentratedLiquidityModuleC");

    await expect(module.position()).to.be.revertedWithCustomError(
      module,
      "NoPositionFound",
    );
  });

  it("Can fetch slot0 on pool", async () => {
    const { module, pool } = await loadFixture(fixtureDeposited);

    expect(await module.slot0()).to.deep.equal(await pool.slot0());
  });

  it("Can view existing position ", async function () {
    const { module, pool, PositionManager } =
      await loadFixture(fixtureDeposited);

    expect(await module.manager()).to.equal(POSITION_MANAGER_ADDRESS);
    expect(await module.pool()).to.equal(POOL_ADDRESS);
    expect(await module.tokenId()).to.deep.equal(BN.from("54353"));

    const position = await module.position();
    expect(position).to.deep.equal(await PositionManager.positions(54353));
    expect(convertToStruct(position)).to.deep.equal({
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
        module.moduleC_mintWithBalance({
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          tickLower: -80880,
          tickUpper: -81480,
          slippageLiquidity: 1_000_000,
          sqrtPriceX96,
        }),
      ).to.be.revertedWithCustomError(module, "InvalidTickParam");
    });

    it("Can handle too low slippage", async function () {
      const { module, USDB, WETH, signer } = await loadFixture(fixtureDeployed);
      // Transfer all assets to tba
      await USDB.transfer(module.address, USDB.balanceOf(USER_ADDRESS));
      await WETH.transfer(module.address, WETH.balanceOf(USER_ADDRESS));

      // Trigger the deposit
      await expect(
        module.moduleC_mintWithBalance({
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          slippageLiquidity: 10, /// 0.001%
          sqrtPriceX96: sqrtPriceX96.mul(101).div(100), // Can't use pool price if we want slippage
          tickLower: price1ToTick(4000),
          tickUpper: price1ToTick(2000),
        }),
      ).to.be.revertedWith("Price slippage check");
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
        module.moduleC_mintWithBalance({
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          slippageLiquidity: BN.from(1_000_000 - 1),
          sqrtPriceX96,
          tickLower: price1ToTick(4000),
          tickUpper: price1ToTick(2000),
        }),
      ).to.be.revertedWithCustomError(module, "PositionAlreadyExists");
    });

    it("Can deposit optimally WETH", async function () {
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
      await WETH.transfer(module.address, BN.from("59265494520598039751")); // Found emperically

      // Trigger the deposit
      await module
        .moduleC_mintWithBalance({
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          slippageLiquidity: 0,
          sqrtPriceX96,
          tickLower: price1ToTick(4000),
          tickUpper: price1ToTick(2000),
        })
        .then((tx) => tx.wait());

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
      ).to.deep.equal([BN.from("10"), BN.from("0")]);
    });

    it("Can deposit with WETH and refund", async function () {
      const { module, USDB, WETH } = await loadFixture(fixtureDeployed);

      // Transfer all assets to tba
      await USDB.transfer(module.address, USDB.balanceOf(USER_ADDRESS));
      await WETH.transfer(module.address, WETH.balanceOf(USER_ADDRESS));

      // Trigger the deposit
      await module
        .moduleC_mintWithBalanceAndRefundTo({
          receiver: USER_ADDRESS,
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          slippageLiquidity: 100_000,
          sqrtPriceX96,
          tickLower: price1ToTick(4000),
          tickUpper: price1ToTick(2000),
        })
        .then((tx) => tx.wait());

      // Position to be minted
      expect(convertToStruct(await module.position())).to.deep.equal({
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

      // All funds sent back to user
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("0")]);
      expect(
        await Promise.all([
          USDB.balanceOf(USER_ADDRESS),
          WETH.balanceOf(USER_ADDRESS),
        ]),
      ).to.deep.equal([BN.from("10"), BN.from("1499144318855151962")]);
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
        .moduleC_mintWithBalance({
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          slippageLiquidity: 1_00_000,
          sqrtPriceX96,
          tickLower: price1ToTick(4000),
          tickUpper: price1ToTick(2000),
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

      await expect(
        module.moduleC_increaseLiquidityWithBalance(sqrtPriceX96, 1_000_000),
      ).to.be.revertedWithCustomError(module, "NoPositionFound");
    });

    it("Can handle too low slippageSwap", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureDeposited);

      await USDB.transfer(module.address, USDB.balanceOf(USER_ADDRESS));
      await WETH.transfer(module.address, WETH.balanceOf(USER_ADDRESS));

      await expect(
        module.moduleC_increaseLiquidityWithBalance(
          sqrtPriceX96.mul(101).div(100),
          0,
        ),
      ).to.be.revertedWith("Price slippage check");
    });

    it("Can do partial deposit and refund", async () => {
      const { module, USDB, WETH, PositionManager } =
        await loadFixture(fixtureDeposited);

      await WETH.transfer(module.address, WETH.balanceOf(USER_ADDRESS));
      await USDB.transfer(module.address, USDB.balanceOf(USER_ADDRESS));

      // Position to be minted
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
        feeGrowthInside1LastX128: BN.from(
          "63771321919466126002465612072408134",
        ),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      await module
        .moduleC_increaseLiquidityWithBalanceAndRefundTo(
          USER_ADDRESS,
          sqrtPriceX96,
          0,
        )
        .then((tx) => tx.wait());

      // Position to be minted
      expect(convertToStruct(await module.position())).to.deep.equal({
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
      ).to.deep.equal([BN.from("0"), BN.from("0")]);
      expect(
        await Promise.all([
          USDB.balanceOf(USER_ADDRESS),
          WETH.balanceOf(USER_ADDRESS),
        ]),
      ).to.deep.equal([BN.from("10"), BN.from("1499144318855151961")]);
    });

    it("Can do partial deposit", async () => {
      const { module, USDB, WETH, PositionManager } =
        await loadFixture(fixtureDeposited);

      await WETH.transfer(module.address, WETH.balanceOf(USER_ADDRESS));
      await USDB.transfer(module.address, USDB.balanceOf(USER_ADDRESS));

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

      await module
        .moduleC_increaseLiquidityWithBalance(sqrtPriceX96, 0)
        .then((tx) => tx.wait());

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
      const { module, USDB, WETH, PositionManager } =
        await loadFixture(fixtureDeposited);
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("11"), BN.from("21131891579154171837")]);

      const tokenId = await module.tokenId();
      await module
        .moduleC_fullWithdrawToSelf(sqrtPriceX96, 1_000)
        .then((tx) => tx.wait());

      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([
        BN.from("206513078828369975841635"),
        BN.from("50764638839453191712"),
      ]);

      // Expect position to be burnt
      expect(await module.tokenId()).to.equal(BN.from("0"));
      await expect(PositionManager.positions(tokenId)).to.be.revertedWith(
        "Invalid token ID",
      );
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
        .moduleC_fullWithdrawTo(USER_ADDRESS, sqrtPriceX96, 1_000)
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
      await module.moduleC_collectToSelf();

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
        "64580542070095326831",
      );

      expect((await WETH.balanceOf(USER_ADDRESS)).sub(weth)).to.equal(
        "21151305998240367223",
      );
    });
  });

  describe("Partial Withdrawal test suite", () => {
    it("Can decrease liquidity", async () => {
      const { module } = await loadFixture(fixtureDeposited);

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
        feeGrowthInside1LastX128: BN.from(
          "63771321919466126002465612072408134",
        ),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      await module.moduleC_decreaseLiquidity({
        liquidity: BN.from("16983715425639545311351").div(2),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await provider.getBlock("latest")).timestamp + 1000,
      });

      expect(convertToStruct(await module.position())).to.deep.equal({
        nonce: BN.from("0"),
        operator: "0x0000000000000000000000000000000000000000",
        token0: "0x4300000000000000000000000000000000000003",
        token1: "0x4300000000000000000000000000000000000004",
        fee: 3000,
        tickLower: -82920,
        tickUpper: -76020,
        liquidity: BN.from("8491857712819772655676"),
        feeGrowthInside0LastX128: BN.from(
          "223062771100361370800904183975351004548",
        ),
        feeGrowthInside1LastX128: BN.from(
          "63771321919466126002465612072408134",
        ),
        tokensOwed0: BN.from("103256539414184987920806"),
        tokensOwed1: BN.from("14816373630149509937"),
      });
    });

    it("Can reject with slippage", async () => {
      const { module } = await loadFixture(fixtureDeposited);
      expect(
        module.moduleC_partialWithdrawTo(
          USER_ADDRESS,
          BN.from("16983715425639545311351").div(2),
          sqrtPriceX96.mul(101).div(100),
          10,
        ),
      ).to.be.revertedWith("Price slippage check");
    });

    it("Can handle partial withdrawal", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureDeposited);

      expect(await USDB.balanceOf(USER_ADDRESS)).to.equal(
        BN.from("206513078828369975841636"),
      );
      expect(await WETH.balanceOf(USER_ADDRESS)).to.equal(
        BN.from("10000000000000000000"),
      );

      expect(convertToStruct(await module.position()).liquidity).to.deep.equal(
        BN.from("16983715425639545311351"),
      );
      await module.moduleC_partialWithdrawTo(
        USER_ADDRESS,
        BN.from("16983715425639545311351").div(2),
        sqrtPriceX96,
        0,
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
          slippageSwap: 10000,
          slippageLiquidity: 1_000_000,
          tickLower: -80880,
          tickUpper: -81480,
          sqrtPriceX96,
        }),
      ).to.be.revertedWithCustomError(module, "InvalidTickParam");
    });

    it("Can handle slippage rejection", async () => {
      const { module } = await loadFixture(fixtureDeposited);

      await expect(
        module.moduleC_rebalance({
          fee: 3000,
          router: SWAP_ROUTER_ADDRESS,
          slippageSwap: 1000, // 0.1%
          slippageLiquidity: 1_000_000,
          tickLower: -82020,
          tickUpper: -79620,
          sqrtPriceX96,
        }),
      ).to.be.revertedWith("Too little received");
    });

    it("Can rebalance with range below spot", async () => {
      const { module, USDB, WETH, pool } = await loadFixture(fixtureDeposited);

      await expect(
        module.moduleC_rebalance({
          fee: 3000,
          router: SWAP_ROUTER_ADDRESS,
          slippageSwap: 10000,
          slippageLiquidity: 1_000_000,
          tickLower: -81480,
          tickUpper: -80880,
          sqrtPriceX96,
        }),
      )
        .to.emit(pool, "Swap")
        .withArgs(
          SWAP_ROUTER_ADDRESS,
          module.address,
          BN.from("206513078828369975841635"),
          BN.from("-63474342477943091699"),
          BN.from("1389707935016030558275320699"),
          BN.from("1809644280222846793499326"),
          -80869,
        );

      expect((await pool.slot0())[0]).to.equal(
        BN.from("1389707935016030558275320699"),
      );

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
      const { module, USDB, WETH, pool } = await loadFixture(fixtureDeposited);

      await expect(
        module.moduleC_rebalance({
          fee: 3000,
          router: SWAP_ROUTER_ADDRESS,
          slippageSwap: 10000,
          slippageLiquidity: 1_000_000,
          tickLower: -80760,
          tickUpper: -80160,
          sqrtPriceX96,
        }),
      )
        .to.emit(pool, "Swap")
        .withArgs(
          SWAP_ROUTER_ADDRESS,
          module.address,
          BN.from("-163583869957860471796605"),
          BN.from("50764638839453191712"),
          BN.from("1394713290132715907882947841"),
          BN.from("1797821955078365469252286"),
          -80797,
        );

      expect((await pool.slot0())[0]).to.equal(
        BN.from("1394713290132715907882947841"),
      );

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

    it("Can handle rebalance to same range", async () => {
      const { module, USDB, WETH, pool } = await loadFixture(fixtureDeposited);
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("11"), BN.from("21131891579154171837")]);

      expect(await module.tokenId()).to.deep.equal(BN.from("54353"));

      await expect(
        module.moduleC_rebalance({
          fee: 3000,
          router: SWAP_ROUTER_ADDRESS,
          slippageSwap: 10000,
          slippageLiquidity: 1_000_000,
          tickLower: -82920,
          tickUpper: -76020,
          sqrtPriceX96,
        }),
      )
        .to.emit(pool, "Swap")
        .withArgs(
          SWAP_ROUTER_ADDRESS,
          module.address,
          BN.from("-34090756937382223001362"),
          BN.from("10565945789577175017"),
          BN.from("1392948110278170812480898490"),
          BN.from("1809644280222846793499326"),
          -80823,
        );

      expect(convertToStruct(await module.position())).to.deep.equal({
        nonce: BN.from("0"),
        operator: "0x0000000000000000000000000000000000000000",
        token0: "0x4300000000000000000000000000000000000003",
        token1: "0x4300000000000000000000000000000000000004",
        fee: 3000,
        tickLower: -82920,
        tickUpper: -76020,
        liquidity: BN.from("19818056076200303065737"),
        feeGrowthInside0LastX128: BN.from(
          "223062771100361370800904183975351004548",
        ),
        feeGrowthInside1LastX128: BN.from(
          "63775295523650471992080398957675698",
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
      ).to.deep.equal([BN.from("0"), BN.from("5505297270512626701")]);
    });

    it("Can rebalance equal", async () => {
      const { module, USDB, WETH, pool } = await loadFixture(fixtureDeposited);
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("11"), BN.from("21131891579154171837")]);

      expect(await module.tokenId()).to.deep.equal(BN.from("54353"));

      await expect(
        module.moduleC_rebalance({
          fee: 3000,
          router: SWAP_ROUTER_ADDRESS,
          slippageSwap: 10000,
          slippageLiquidity: 10_000, // 1%
          tickLower: -82020,
          tickUpper: -79620,
          sqrtPriceX96,
        }),
      )
        .to.emit(pool, "Swap")
        .withArgs(
          SWAP_ROUTER_ADDRESS,
          module.address,
          BN.from("19902778130550452706038"),
          BN.from("-6128416111010888352"),
          BN.from("1392218601020053651155219570"),
          BN.from("1809644280222846793499326"),
          -80833,
        );

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
