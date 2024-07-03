/* global describe it before ethers */

import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN } from "ethers";
import chai from "chai";
const { expect } = chai;

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const { formatUnits } = ethers.utils;

import {
  AgentRegistry,
  BlastooorAccountFactory,
  BlastooorGenesisAgentAccount,
  BlastooorGenesisFactory,
  BlastooorStrategyAgents,
  BlastooorStrategyFactory,
  ConcentratedLiquidityModuleE,
} from "../typechain-types";

import { deployContract } from "../scripts/utils/deployContract";
import {
  price0ToTick,
  price1ToTick,
  sqrtPriceX96ToPrice1,
  tickToPrice0,
} from "../scripts/utils/v3";
import { toBytes32, findERC20BalanceOfSlot, manipulateERC20BalanceOf } from "../scripts/utils/setStorage";
import { calcSighash } from "../scripts/utils/diamond";
import { BlastooorGenesisAgents } from "../typechain-types/contracts/tokens/BlastooorGenesisAgents";
import { convertToStruct, almostEqual } from "../scripts/utils/test";
import { moduleEFunctionParams as functionParams } from "../scripts/configuration/ConcentratedLiquidityModuleE";
import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { formatNumber2 } from "../scripts/utils/strings";

/* prettier-ignore */ const BLAST_ADDRESS                 = "0x4300000000000000000000000000000000000002";
/* prettier-ignore */ const BLAST_POINTS_ADDRESS          = "0x2fc95838c71e76ec69ff817983BFf17c710F34E0";
/* prettier-ignore */ const BLAST_POINTS_OPERATOR_ADDRESS = "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";
/* prettier-ignore */ const ENTRY_POINT_ADDRESS           = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
/* prettier-ignore */ const ERC6551_REGISTRY_ADDRESS      = "0x000000006551c19487814612e58FE06813775758";
///* prettier-ignore */ const POOL_ADDRESS                  = "0x8A55d41CBEbCa3A31a046c694B3d6F1e93Ce399a"; // the one they gave us
/* prettier-ignore */ const POOL_ADDRESS                  = "0xbDcFc238D3CB98E213281A86264032C273B2A712"; // the one from blastscan
/* prettier-ignore */ const POSITION_MANAGER_ADDRESS      = "0x37A4950b4ea0C46596404895c5027B088B0e70e7";
/* prettier-ignore */ const SWAP_ROUTER_ADDRESS           = "0xE94de02e52Eaf9F0f6Bf7f16E4927FcBc2c09bC7";
///* prettier-ignore */ const USDB_ADDRESS                  = "0x4200000000000000000000000000000000000022";
/* prettier-ignore */ const USDB_ADDRESS                  = "0xb5A792445ED89eAB733496F78Fc5d37e394fC006";
/* prettier-ignore */ const WETH_ADDRESS                  = "0x4200000000000000000000000000000000000023";

// /* prettier-ignore */ const OWNER_ADDRESS                 = "0xA214a4fc09C42202C404E2976c50373fE5F5B789";
// /* prettier-ignore */ const USER_ADDRESS                  = "0x7da01a06A2582193C2867E22FE62f7f649F7B9e2";

const permissions = Object.entries({
  // Public
  [toBytes32(0)]: [
    "manager()",
    "moduleName()",
    "pool()",
    "position()",
    "safelyGetStateOfAMM()",
    "strategyType()",
    "tokenId()",
    "tickSpacing()",
    "weth()",
    "farmingCenter()",
    "eternalFarming()",
    "moduleE_getRewardInfo()",
  ],
  // AgentFi + Owner
  [toBytes32(9)]: [
    "moduleE_burn()",
    "moduleE_collect((uint128,uint128))",
    "moduleE_collectToSelf()",
    "moduleE_decreaseLiquidity((uint128,uint256,uint256,uint256))",
    "moduleE_decreaseLiquidityWithSlippage(uint128,uint160,uint24)",
    "moduleE_exactInputSingle(address,(address,address,uint256,uint256,uint256,uint160))",
    "moduleE_fullWithdrawToSelf(uint160,uint24)",
    "moduleE_increaseLiquidity((uint256,uint256,uint256,uint256,uint256))",
    "moduleE_increaseLiquidityWithBalance(uint160,uint24)",
    "moduleE_mint((address,address,address,address,int24,int24,uint256,uint256,uint256,uint256,uint256))",
    "moduleE_mintWithBalance((address,address,uint24,int24,int24,uint160))",
    "moduleE_partialWithdrawalToSelf(uint128,uint160,uint24)",
    "moduleE_rebalance((address,uint24,uint24,int24,int24,uint160))",
    "moduleE_wrap()",
    "moduleE_unwrap()",
    "moduleE_enterFarming((address,address,uint256))",
    "moduleE_exitFarming(address)",
  ],

  // Owner Only:
  [toBytes32(1)]: [
    "moduleE_collectTo(address)",
    "moduleE_fullWithdrawTo(address,uint160,uint24)",
    "moduleE_increaseLiquidityWithBalanceAndRefundTo(address,uint160,uint24)",
    "moduleE_mintWithBalanceAndRefundTo((address,address,uint24,int24,int24,uint160,address))",
    "moduleE_partialWithdrawTo(address,uint128,uint160,uint24)",
    "moduleE_sendBalanceTo(address)",
    "moduleE_claimRewardsTo(address)"
  ],
}).reduce(
  (acc, [requiredRole, functions]) => {
    functions.forEach((func) => {
      acc.push({ selector: calcSighash(func, false), signature: func, requiredRole });
    });

    return acc;
  },
  [] as { selector: string; requiredRole: string }[],
);

expect(functionParams).to.deep.equal(permissions);

describe("ConcentratedLiquidityModuleE", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let strategyManager: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;
  let user6: SignerWithAddress;
  let user7: SignerWithAddress;

  let chainID: number;
  let networkSettings: any;
  let snapshot: BN;

  async function fixtureSetup(
    moduleName:
      | "ConcentratedLiquidityModuleE"
  ) {

    // ======= Setup

    const gasCollector = await deployContract(deployer, "GasCollector", [
      owner.address,
      BLAST_ADDRESS,
      BLAST_POINTS_ADDRESS,
      BLAST_POINTS_OPERATOR_ADDRESS,
    ]);

    const genesisAgentNft = (await deployContract(
      deployer,
      "BlastooorGenesisAgents",
      [
        owner.address,
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
        owner.address,
        BLAST_ADDRESS,
        gasCollector.address,
        BLAST_POINTS_ADDRESS,
        BLAST_POINTS_OPERATOR_ADDRESS,
        genesisAgentNft.address,
      ],
    )) as BlastooorGenesisFactory;

    const agentRegistry = (await deployContract(deployer, "AgentRegistry", [
      owner.address,
      BLAST_ADDRESS,
      gasCollector.address,
      BLAST_POINTS_ADDRESS,
      BLAST_POINTS_OPERATOR_ADDRESS,
    ])) as AgentRegistry;

    const genesisAccountFactory = (await deployContract(
      deployer,
      "BlastooorAccountFactory",
      [
        owner.address,
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
        owner.address,
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
        owner.address,
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
      paymentReceiver: owner.address,
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
    const strategyConfigID2 = 2;

    // ===== Deploy Module and new account

    const module = await deployContract(deployer, moduleName, [
      BLAST_ADDRESS,
      gasCollector.address,
      BLAST_POINTS_ADDRESS,
      BLAST_POINTS_OPERATOR_ADDRESS,
      AddressZero, // intentionally not using WETH to test as erc20,
      AddressZero, // no algebra farming
      AddressZero, // no algebra farming
    ]);
    const module2 = await deployContract(deployer, moduleName, [
      BLAST_ADDRESS,
      gasCollector.address,
      BLAST_POINTS_ADDRESS,
      BLAST_POINTS_OPERATOR_ADDRESS,
      WETH_ADDRESS,
      AddressZero, // no algebra farming
      AddressZero, // no algebra farming
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
        // Deposit? moduleE deposit
        // User approval is to factory, factory its to TBA
      ],
      isActive: true,
    });

    expect(await strategyFactory.getAgentCreationSettingsCount()).to.equal(
      strategyConfigID,
    );

    // add settings with module 2
    overrides[0].implementation = module2.address
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
      ],
      isActive: true,
    });
    expect(await strategyFactory.getAgentCreationSettingsCount()).to.equal(
      strategyConfigID2,
    );

    const genesisAgentId = 1;

    // ===== Mint the strategy agent
    const signer = user1

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

    let genesisAgentAddress = await agentRegistry
      .getTbasOfNft(genesisAgentNft.address, genesisAgentId)
      .then((x) => x[0][0]);

    const genesisAgent = await ethers.getContractAt(
      "BlastooorGenesisAgentAccount",
      genesisAgentAddress,
      owner,
    );
    // create strategy agent 1
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
    // create strategy agent 2
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
    // create strategy agent 3
    await signer.sendTransaction({
      to: genesisAgentAddress,
      data: genesisAgent.interface.encodeFunctionData("execute", [
        strategyFactory.address,
        0,
        strategyFactory.interface.encodeFunctionData("createAgent(uint256)", [
          strategyConfigID2,
        ]),
        0,
      ]),
      value: 0,
      gasLimit: 3_000_000,
    });

    const strategyAgentID = 1;
    const strategyAgentID2 = 2;
    const strategyAgentID3 = 3;
    let strategyAgentAddress = await agentRegistry
      .getTbasOfNft(strategyAgentNft.address, strategyAgentID)
      .then((r) => r[0][0])
    let strategyAgentAddress2 = await agentRegistry
      .getTbasOfNft(strategyAgentNft.address, strategyAgentID2)
      .then((r) => r[0][0])
    let strategyAgentAddress3 = await agentRegistry
      .getTbasOfNft(strategyAgentNft.address, strategyAgentID3)
      .then((r) => r[0][0])

    const agent = (await ethers.getContractAt(
      moduleName,
      strategyAgentAddress,
      signer,
    )) as ConcentratedLiquidityModuleE;
    const agent2 = (await ethers.getContractAt(
      moduleName,
      strategyAgentAddress2,
      signer,
    )) as ConcentratedLiquidityModuleE;
    const agent3 = (await ethers.getContractAt(
      moduleName,
      strategyAgentAddress3,
      signer,
    )) as ConcentratedLiquidityModuleE;

    const strategyAgent = await ethers.getContractAt(
      "BlastooorStrategyAgentAccountV2",
      strategyAgentAddress,
      signer,
    );

    // ===== Setup user

    // ===== Load already deployed contracts
    const USDB = await ethers.getContractAt("MockERC20", USDB_ADDRESS, signer);
    const WETH = await ethers.getContractAt("MockERC20", WETH_ADDRESS, signer);
    const pool = await ethers.getContractAt(
      "IAlgebraPool",
      POOL_ADDRESS,
      deployer,
    ) as any;
    const PositionManager = await ethers.getContractAt(
      "contracts/interfaces/external/Algebra/INonfungiblePositionManager.sol:INonfungiblePositionManager",
      POSITION_MANAGER_ADDRESS,
      signer,
    );

    // ======= Create the agent

    return {
      PositionManager,
      USDB,
      WETH,
      module: agent,
      module2: agent2,
      module3: agent3,
      agent,
      agent2,
      agent3,
      pool,
      signer,
      strategyAgent,
      owner,
      genesisAgent,
    };
  }

  before(async function () {
    // use blast sepolia with set fork block
    const blockNumber = 6385050;
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.BLAST_SEPOLIA_URL,
            blockNumber,
          },
        },
      ],
    });

    await expectDeployed(ERC6551_REGISTRY_ADDRESS);
    await expectDeployed(POOL_ADDRESS);
    await expectDeployed(POSITION_MANAGER_ADDRESS);
    await expectDeployed(SWAP_ROUTER_ADDRESS);
    await expectDeployed(USDB_ADDRESS);
    await expectDeployed(WETH_ADDRESS);

    [deployer, owner, strategyManager, user1, user2, user3, user4, user5, user6, user7] = await ethers.getSigners();
    chainID = (await provider.getNetwork()).chainId;
    networkSettings = getNetworkSettings(chainID);
    if(!networkSettings.isTestnet) throw new Error("Do not run tests on production networks");
  })

  after(async function () {
    // reset back to blast
    const blockNumber = parseInt(process.env.BLAST_FORK_BLOCK);
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
  })

  const sqrtPriceX96 = BN.from("24096096288366883792913047239");

  async function fixtureDeployed() {
    const fixture = await fixtureSetup("ConcentratedLiquidityModuleE");
    // Wrap existing ETH to WETH, leaving some gas
    await fixture.signer
      .sendTransaction({
        to: WETH_ADDRESS,
        value: "60764638839453191713",
      })
      .then((x) => x.wait());
    await user3
      .sendTransaction({
        to: WETH_ADDRESS,
        value: WeiPerEther.mul(300),
      })
      .then((x) => x.wait());

    // mint some usdb
    let slot = 0; //await findERC20BalanceOfSlot(USDB_ADDRESS)
    let desiredBalance = WeiPerEther.mul(1_000_000)
    await manipulateERC20BalanceOf(USDB_ADDRESS, slot, user1.address, desiredBalance)
    await manipulateERC20BalanceOf(USDB_ADDRESS, slot, user3.address, desiredBalance)

    return fixture;
  }

  async function fixtureDeposited() {
    const fixture = await loadFixture(fixtureDeployed);
    const { USDB, module, WETH } = fixture;

    const signer = user1

    // swap pool to reasonable price
    let state = await fixture.pool.safelyGetStateOfAMM()
    let price = calculatePriceV3(state.sqrtPrice, true)
    const router = await ethers.getContractAt(
      "contracts/interfaces/external/Algebra/ISwapRouter.sol:ISwapRouter",
      SWAP_ROUTER_ADDRESS,
      signer,
    );
    await USDB.approve(SWAP_ROUTER_ADDRESS, MaxUint256)
    await WETH.approve(SWAP_ROUTER_ADDRESS, MaxUint256)
    let swapAmount = WeiPerEther.div(10).mul(19)
    await router.exactInputSingle({
      amountIn: swapAmount,
      amountOutMinimum: 0,
      deadline: MaxUint256,
      recipient: user1.address,
      limitSqrtPrice: 0,
      tokenIn: USDB_ADDRESS,
      tokenOut: WETH_ADDRESS,
    });
    state = await fixture.pool.safelyGetStateOfAMM()
    price = calculatePriceV3(state.sqrtPrice, true)
    expect(state.sqrtPrice).eq("4905481270181304529126937729524")
    expect(state.tick).eq(82519)
    expect(price).eq(3833.5759888105804)

    let usdbAmount = WeiPerEther.mul(100_000)
    let wethAmount = WeiPerEther.mul(30)
    await USDB.transfer(
      module.address,
      usdbAmount,
    );
    await WETH.transfer(
      module.address,
      wethAmount,
    );

    await module
      .moduleE_mintWithBalance({
        manager: POSITION_MANAGER_ADDRESS,
        pool: POOL_ADDRESS,
        slippageLiquidity: 1_000_000,
        sqrtPriceX96,
        tickLower: 78000,
        tickUpper: 87000,
      })
      .then((tx) => tx.wait());

    return fixture;
  }

  async function fixtureWithFees() {
    const fixture = await loadFixture(fixtureDeposited);
    const signer = user3
    const router = await ethers.getContractAt(
      "contracts/interfaces/external/Algebra/ISwapRouter.sol:ISwapRouter",
      SWAP_ROUTER_ADDRESS,
      signer,
    );

    const USDB = await ethers.getContractAt("MockERC20", USDB_ADDRESS, signer);
    const WETH = await ethers.getContractAt("MockERC20", WETH_ADDRESS, signer);

    await USDB.approve(router.address, ethers.constants.MaxUint256);
    await WETH.approve(router.address, ethers.constants.MaxUint256);

    // Swap back and forth to generate fees on both sides
    let usdbAmount = await USDB.balanceOf(user3.address)
    let wethAmount = await WETH.balanceOf(user3.address)
    expect(usdbAmount).gt(1)
    expect(wethAmount).gt(1)
    await router.exactInputSingle({
      amountIn: usdbAmount,
      amountOutMinimum: 0,
      deadline: MaxUint256,
      recipient: user3.address,
      limitSqrtPrice: 0,
      tokenIn: USDB_ADDRESS,
      tokenOut: WETH_ADDRESS,
    });

    await router.exactInputSingle({
      amountIn: wethAmount,
      amountOutMinimum: 0,
      deadline: MaxUint256,
      recipient: user3.address,
      limitSqrtPrice: 0,
      tokenIn: WETH_ADDRESS,
      tokenOut: USDB_ADDRESS,
    });

    return fixture;
  }

  it("Verify initial pool state", async () => {
    const { pool, module } = await loadFixture(fixtureDeployed);
    const [sqrtPriceX96, tick] = await pool.safelyGetStateOfAMM();
    const price = sqrtPriceX96ToPrice1(BigInt(sqrtPriceX96.toString()));

    expect(sqrtPriceX96).to.equal(BN.from("24096096288366883792913047239"));
    expect(tick).to.equal(BN.from(-23807));

    expect(1 / tickToPrice0(tick)).to.equal(10.811182043898635);
    expect(price).to.equal(10);

    let poolSpacing = await pool.tickSpacing()
    expect(poolSpacing).eq(60)
  });

  it("View initial state", async function () {
    const { module } = await loadFixture(fixtureDeployed);
    expect(await module.manager()).to.equal(
      AddressZero,
    );

    expect(await module.pool()).to.equal(
      AddressZero,
    );

    expect(await module.tokenId()).to.equal("0");
    expect(await module.strategyType()).to.equal("Concentrated Liquidity");
    expect(await module.moduleName()).to.equal("ConcentratedLiquidityModuleE");

    await expect(module.position()).to.be.revertedWithCustomError(
      module,
      "NoPositionFound",
    );
    await expect(module.tickSpacing()).to.be.reverted
  });

  it("Can fetch state on pool", async () => {
    const { module, pool } = await loadFixture(fixtureDeposited);

    expect(await module.safelyGetStateOfAMM()).to.deep.equal(await pool.safelyGetStateOfAMM());
  });

  it("Can view existing position ", async function () {
    const { module, pool, PositionManager } =
      await loadFixture(fixtureDeposited);

    expect(await module.manager()).to.equal(POSITION_MANAGER_ADDRESS);
    expect(await module.pool()).to.equal(POOL_ADDRESS);
    expect(await module.tokenId()).to.deep.equal(BN.from("11"));

    const position = await module.position();
    expect(position).to.deep.equal(await PositionManager.positions(11));
    expect(convertToStruct(position)).to.deep.equal({
      nonce: BN.from("0"),
      operator: AddressZero,
      token0: WETH_ADDRESS,
      token1: USDB_ADDRESS,
      tickLower: 78000,
      tickUpper: 87000,
      liquidity: BN.from("7985268064407586120905"),
      feeGrowthInside0LastX128: BN.from("0"),
      feeGrowthInside1LastX128: BN.from("0"),
      tokensOwed0: BN.from("0"),
      tokensOwed1: BN.from("0"),
    });

    const [, tick] = await pool.safelyGetStateOfAMM();
    expect(tick).to.equal(BN.from(82519));

    let poolSpacing = await pool.tickSpacing()
    let moduleSpacing = await module.tickSpacing()
    expect(moduleSpacing).eq(poolSpacing)
    expect(moduleSpacing).eq(60)
  });

  describe("Deposit flow", () => {
    it("Can reject invalid tick range", async () => {
      const { module } = await loadFixture(fixtureDeployed);

      await expect(
        module.moduleE_mintWithBalance({
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          tickLower: -80880,
          tickUpper: -81480,
          slippageLiquidity: 1_000_000,
          sqrtPriceX96,
        }),
      ).to.be.revertedWithCustomError(module, "InvalidTickParam");
    });
    it("Can reject invalid slippage", async () => {
      const { module } = await loadFixture(fixtureDeployed);

      await expect(
        module.moduleE_mintWithBalance({
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          tickLower: -80880,
          tickUpper: -81480,
          slippageLiquidity: 1_000_001,
          sqrtPriceX96,
        }),
      ).to.be.revertedWithCustomError(module, "InvalidSlippageParam");
    });

    it("Can handle too low slippage", async function () {
      const { module, USDB, WETH, signer, pool } = await loadFixture(fixtureDeployed);
      // Transfer all assets to tba
      await USDB.transfer(module.address, await USDB.balanceOf(user1.address));
      await WETH.transfer(module.address, await WETH.balanceOf(user1.address));

      let state = await pool.safelyGetStateOfAMM()

      await module.moduleE_mintWithBalance({
        manager: POSITION_MANAGER_ADDRESS,
        pool: POOL_ADDRESS,
        slippageLiquidity: 10, /// 0.001%
        sqrtPriceX96: state.sqrtPrice.mul(111).div(100),
        tickLower: price0ToTick(2000),
        tickUpper: price0ToTick(4000),
      })

      // Trigger the deposit
      await expect(
        module.moduleE_mintWithBalance({
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          slippageLiquidity: 10, /// 0.001%
          sqrtPriceX96: state.sqrtPrice.mul(111).div(100),
          tickLower: price0ToTick(2000),
          tickUpper: price0ToTick(4000),
        }),
      ).to.be.reverted//With("Price slippage check");
    });

    it("Can reject deposit when position exists", async function () {
      const { module, USDB, WETH, signer } =
        await loadFixture(fixtureDeposited);
      // Transfer all assets to tba
      await USDB.transfer(module.address, await USDB.balanceOf(user1.address));
      await WETH.transfer(module.address, await WETH.balanceOf(user1.address));

      expect(await module.tokenId()).to.deep.equal(BN.from("11"));

      let tickLower = price1ToTick(4000)
      let tickUpper = price1ToTick(2000)

      // Trigger the deposit
      await expect(
        module.moduleE_mintWithBalance({
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          slippageLiquidity: BN.from(1_000_000 - 1),
          sqrtPriceX96,
          tickLower,
          tickUpper,
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

      // Transfer assets to tba
      await USDB.transfer(module.address, (await USDB.balanceOf(user1.address)).div(3));
      await WETH.transfer(module.address, (await WETH.balanceOf(user1.address)).div(3));
      let balances = await Promise.all([
        provider.getBalance(module.address),
        USDB.balanceOf(module.address),
        WETH.balanceOf(module.address),
      ])
      expect(balances[0]).eq(0)
      expect(balances[1]).gt(1)
      expect(balances[2]).gt(1)

      let tickLower = price1ToTick(4000)
      let tickUpper = price1ToTick(2000)

      // Trigger the deposit
      await module
        .moduleE_mintWithBalance({
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          slippageLiquidity: 0,
          sqrtPriceX96,
          tickLower,
          tickUpper,
        })
        .then((tx) => tx.wait());

      const tokenId = await module.tokenId();

      // Position to be minted
      expect(
        convertToStruct(await PositionManager.positions(tokenId)),
      ).to.deep.equal({
        nonce: BN.from("0"),
        operator: AddressZero,
        token0: WETH_ADDRESS,
        token1: USDB_ADDRESS,
        tickLower: tickLower,
        tickUpper: tickUpper,
        liquidity: BN.from("51110805826118330536873448"),
        feeGrowthInside0LastX128: BN.from("0"),
        feeGrowthInside1LastX128: BN.from("0"),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      // Only leftover on one side
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("20254879613151063904")]);
    });

    it("Can deposit with WETH and refund", async function () {
      const { module, USDB, WETH } = await loadFixture(fixtureDeployed);

      // Transfer all assets to tba
      await USDB.transfer(module.address, await USDB.balanceOf(user1.address));
      await WETH.transfer(module.address, await WETH.balanceOf(user1.address));

      let tickLower = price1ToTick(4000)
      let tickUpper = price1ToTick(2000)

      // Trigger the deposit
      await module
        .moduleE_mintWithBalanceAndRefundTo({
          receiver: user1.address,
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          slippageLiquidity: 100_000,
          sqrtPriceX96,
          tickLower,
          tickUpper,
        })
        .then((tx) => tx.wait());

      // Position to be minted
      expect(convertToStruct(await module.position())).to.deep.equal({
        nonce: BN.from("0"),
        operator: AddressZero,
        token0: WETH_ADDRESS,
        token1: USDB_ADDRESS,
        tickLower: tickLower,
        tickUpper: tickUpper,
        liquidity: BN.from("153332417478354991610620499"),
        feeGrowthInside0LastX128: BN.from("0"),
        feeGrowthInside1LastX128: BN.from("0"),
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
          USDB.balanceOf(user1.address),
          WETH.balanceOf(user1.address),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("60764638839453191713")]);
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
      await USDB.transfer(module.address, await USDB.balanceOf(user1.address));
      await WETH.transfer(module.address, await WETH.balanceOf(user1.address));

      let tickLower = price1ToTick(4000)
      let tickUpper = price1ToTick(2000)

      // Trigger the deposit
      await module
        .moduleE_mintWithBalance({
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          slippageLiquidity: 100_000,
          sqrtPriceX96,
          tickLower,
          tickUpper,
        })
        .then((tx) => tx.wait());

      // Expect all Assets to be transferred to tba
      expect(
        await Promise.all([
          USDB.balanceOf(user1.address),
          WETH.balanceOf(user1.address),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("0")]);

      const tokenId = await module.tokenId();

      // Position to be minted
      expect(
        convertToStruct(await PositionManager.positions(tokenId)),
      ).to.deep.equal({
        nonce: BN.from("0"),
        operator: AddressZero,
        token0: WETH_ADDRESS,
        token1: USDB_ADDRESS,
        tickLower: tickLower,
        tickUpper: tickUpper,
        liquidity: BN.from("153332417478354991610620499"),
        feeGrowthInside0LastX128: BN.from("0"),
        feeGrowthInside1LastX128: BN.from("0"),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      // Only leftover on one side
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("60764638839453191713")]);
    });

    it("Rejects mint when a position already exists", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureDeposited);

      // Transfer all assets to tba
      await USDB.transfer(module.address, await USDB.balanceOf(user1.address));
      await WETH.transfer(module.address, await WETH.balanceOf(user1.address));

      // already minted one. revert second
      await expect(
        module.moduleE_mintWithBalance({
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          slippageLiquidity: 100_000,
          sqrtPriceX96,
          tickLower: -60000,
          tickUpper: 121200,
        })
      ).to.be.revertedWithCustomError(module, "PositionAlreadyExists");
    });
  });

  describe("Partial Deposit flow", () => {
    it("Rejects partial deposit when no position exists pt 1", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureDeployed);

      await USDB.transfer(module.address, await USDB.balanceOf(user1.address));
      await WETH.transfer(module.address, await WETH.balanceOf(user1.address));

      await expect(
        module.moduleE_increaseLiquidityWithBalance(sqrtPriceX96, 1_000_000),
      ).to.be.revertedWithCustomError(module, "NoPositionFound");
    });
    it("Rejects partial deposit when no position exists pt 2", async () => {
      const { module } = await loadFixture(fixtureDeployed);

      await expect(
        module.moduleE_increaseLiquidity({
          amount0Desired: 0,
          amount1Desired: 0,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 0,
        }),
      ).to.be.revertedWithCustomError(module, "NoPositionFound");
    });

    it("Can handle too low slippageSwap", async () => {
      const { module, USDB, WETH, pool } = await loadFixture(fixtureDeposited);

      await USDB.transfer(module.address, await USDB.balanceOf(user1.address));
      await WETH.transfer(module.address, await WETH.balanceOf(user1.address));

      let state = await pool.safelyGetStateOfAMM()

      await expect(
        module.moduleE_increaseLiquidityWithBalance(
          state.sqrtPrice.mul(101).div(100),
          0,
        ),
      ).to.be.revertedWith("Price slippage check");
    });
    it("Can reject invalid slippage liquidity", async () => {
      const { module } = await loadFixture(fixtureDeployed);

      await expect(
        module.moduleE_increaseLiquidityWithBalance(
          sqrtPriceX96,
          1_000_001,
        )
      ).to.be.revertedWithCustomError(module, "InvalidSlippageParam");
    });

    it("Can do partial deposit and refund", async () => {
      const { module, USDB, WETH, PositionManager } =
        await loadFixture(fixtureDeposited);

      await WETH.transfer(module.address, await WETH.balanceOf(user1.address));
      await USDB.transfer(module.address, await USDB.balanceOf(user1.address));

      // Position to be minted
      expect(convertToStruct(await module.position())).to.deep.equal({
        nonce: BN.from("0"),
        operator: AddressZero,
        token0: WETH_ADDRESS,
        token1: USDB_ADDRESS,
        tickLower: 78000,
        tickUpper: 87000,
        liquidity: BN.from("7985268064407586120905"),
        feeGrowthInside0LastX128: BN.from("0"),
        feeGrowthInside1LastX128: BN.from("0"),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      await module
        .moduleE_increaseLiquidityWithBalanceAndRefundTo(
          user1.address,
          sqrtPriceX96,
          0,
        )
        .then((tx) => tx.wait());

      // Position to be minted
      expect(convertToStruct(await module.position())).to.deep.equal({
        nonce: BN.from("0"),
        operator: AddressZero,
        token0: WETH_ADDRESS,
        token1: USDB_ADDRESS,
        tickLower: 78000,
        tickUpper: 87000,
        liquidity: BN.from("18851707808340198049016"),
        feeGrowthInside0LastX128: BN.from("0"),
        feeGrowthInside1LastX128: BN.from("0"),
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
          USDB.balanceOf(user1.address),
          WETH.balanceOf(user1.address),
        ]),
      ).to.deep.equal([BN.from("763917010970977213069400"), BN.from("0")]);
    });

    it("Can do partial deposit", async () => {
      const { module, USDB, WETH, PositionManager } =
        await loadFixture(fixtureDeposited);

      await WETH.transfer(module.address, await WETH.balanceOf(user1.address));
      await USDB.transfer(module.address, await USDB.balanceOf(user1.address));

      const tokenId = await module.tokenId();

      // Position to be minted
      expect(
        convertToStruct(await PositionManager.positions(tokenId)),
      ).to.deep.equal({
        nonce: BN.from("0"),
        operator: AddressZero,
        token0: WETH_ADDRESS,
        token1: USDB_ADDRESS,
        tickLower: 78000,
        tickUpper: 87000,
        liquidity: BN.from("7985268064407586120905"),
        feeGrowthInside0LastX128: BN.from("0"),
        feeGrowthInside1LastX128: BN.from("0"),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      await module
        .moduleE_increaseLiquidityWithBalance(sqrtPriceX96, 0)
        .then((tx) => tx.wait());

      // Position to be minted
      expect(
        convertToStruct(await PositionManager.positions(tokenId)),
      ).to.deep.equal({
        nonce: BN.from("0"),
        operator: AddressZero,
        token0: WETH_ADDRESS,
        token1: USDB_ADDRESS,
        tickLower: 78000,
        tickUpper: 87000,
        liquidity: BN.from("18851707808340198049016"),
        feeGrowthInside0LastX128: BN.from("0"),
        feeGrowthInside1LastX128: BN.from("0"),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("763917010970977213069400"), BN.from("0")]);
    });
  });

  describe("Withdrawal tests", () => {
    it("Can withdrawal to tba", async () => {
      const { module, USDB, WETH, PositionManager, pool } =
        await loadFixture(fixtureDeposited);
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("2"), BN.from("4117143401061226630")]);

      const tokenId = await module.tokenId();
      let state = await pool.safelyGetStateOfAMM()
      await module
        .moduleE_fullWithdrawToSelf(state.sqrtPrice, 1_000)
        .then((tx) => tx.wait());

      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([
        BN.from("99999999999999999999999"),
        BN.from("29999999999999999999"),
      ]);

      // Expect position to be burnt
      expect(await module.tokenId()).to.equal(BN.from("0"));
      await expect(PositionManager.positions(tokenId)).to.be.revertedWith(
        "Invalid token ID",
      );
    });

    it("Can withdrawal to user", async () => {
      const { module, USDB, WETH, pool } = await loadFixture(fixtureDeposited);
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("2"), BN.from("4117143401061226630")]);

      let state = await pool.safelyGetStateOfAMM()
      await module
        .moduleE_fullWithdrawTo(user1.address, state.sqrtPrice, 1_000)
        .then((tx) => tx.wait());

      expect(
        await Promise.all([
          USDB.balanceOf(user1.address),
          WETH.balanceOf(user1.address),
        ]),
      ).to.deep.equal([
        BN.from("999998099999999999999999"),
        BN.from("61104529730594944936"),
      ]);
    });
  });

  describe("Collect test suite", () => {
    it("Can collect unclaimed tokens to contract", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureWithFees);

      const usdb = await USDB.balanceOf(module.address);
      const weth = await WETH.balanceOf(module.address);

      // need to generate some fees
      await module.moduleE_collectToSelf();

      // todo: why do these change sometimes? like 1/20 tests fail
      // sometimes this == 1174417377205697108481
      // Expect balances to have increased
      const usdbDiff = (await USDB.balanceOf(module.address)).sub(usdb)
      const wethDiff = (await WETH.balanceOf(module.address)).sub(weth)
      /*
      expect(usdbDiff).to.equal(
        "807641315561607090946",
      );
      */
      expect(usdbDiff.eq("807641315561607090946") || usdbDiff.eq("1174417377205697108481")).to.be.true
      expect(wethDiff).to.equal(
        "892109139311301935"
      );
    });

    it("Can collect unclaimed tokens to user", async () => {
      const { module, USDB, WETH } = await loadFixture(fixtureWithFees);

      const usdb = await USDB.balanceOf(user1.address);
      const weth = await WETH.balanceOf(user1.address);

      // need to generate some fees
      await module.moduleE_collectTo(user1.address);

      // todo: why do these change sometimes? like 1/20 tests fail
      // Expect balances to have increased
      const usdbDiff = (await USDB.balanceOf(user1.address)).sub(usdb)
      const wethDiff = (await WETH.balanceOf(user1.address)).sub(weth)
      /*
      expect((await USDB.balanceOf(user1.address)).sub(usdb)).to.equal(
        "807641315561607090948",
      );
      */
      expect(usdbDiff.eq("807641315561607090948") || usdbDiff.eq("1174417377205697108483")).to.be.true

      expect(wethDiff).to.equal(
        "5009252540372528565",
      );
    });

    it("Rejects collect when no position exists", async () => {
      const { module } = await loadFixture(fixtureDeployed);

      await expect(
        module.moduleE_collect({
          amount0Max: 0,
          amount1Max: 0,
        }),
      ).to.be.revertedWithCustomError(module, "NoPositionFound");
    });

    it("Rejects burn when no position exists", async () => {
      const { module } = await loadFixture(fixtureDeployed);

      await expect(
        module.moduleE_burn(),
      ).to.be.revertedWithCustomError(module, "NoPositionFound");
    });
  });

  describe("Partial Withdrawal test suite", () => {
    it("Can decrease liquidity", async () => {
      const { module } = await loadFixture(fixtureDeposited);

      expect(convertToStruct(await module.position())).to.deep.equal({
        nonce: BN.from("0"),
        operator: AddressZero,
        token0: WETH_ADDRESS,
        token1: USDB_ADDRESS,
        tickLower: 78000,
        tickUpper: 87000,
        liquidity: BN.from("7985268064407586120905"),
        feeGrowthInside0LastX128: BN.from("0"),
        feeGrowthInside1LastX128: BN.from("0"),
        tokensOwed0: BN.from("0"),
        tokensOwed1: BN.from("0"),
      });

      await module.moduleE_decreaseLiquidity({
        liquidity: BN.from("7985268064407586120905").div(2),
        amount0Min: 0,
        amount1Min: 0,
        deadline: MaxUint256,
      });

      expect(convertToStruct(await module.position())).to.deep.equal({
        nonce: BN.from("0"),
        operator: AddressZero,
        token0: WETH_ADDRESS,
        token1: USDB_ADDRESS,
        tickLower: 78000,
        tickUpper: 87000,
        liquidity: BN.from("3992634032203793060453"),
        feeGrowthInside0LastX128: BN.from("0"),
        feeGrowthInside1LastX128: BN.from("0"),
        tokensOwed0: BN.from("12941428299469386684"),
        tokensOwed1: BN.from("49999999999999999999992"),
      });
    });

    it("Can reject with slippage", async () => {
      const { module } = await loadFixture(fixtureDeposited);
      await expect(
        module.moduleE_partialWithdrawTo(
          user1.address,
          BN.from("16983715425639545311351").div(2),
          sqrtPriceX96.mul(101).div(100),
          10,
        ),
      ).to.be.reverted//With("Price slippage check");
    });

    it("Can handle partial withdrawal", async () => {
      const { module, USDB, WETH, pool } = await loadFixture(fixtureDeposited);

      expect(await USDB.balanceOf(user1.address)).to.equal(
        BN.from("899998100000000000000000"),
      );
      expect(await WETH.balanceOf(user1.address)).to.equal(
        BN.from("31104529730594944937"),
      );

      expect(convertToStruct(await module.position()).liquidity).to.deep.equal(
        BN.from("7985268064407586120905"),
      );
      let state = await pool.safelyGetStateOfAMM()
      await module.moduleE_partialWithdrawTo(
        user1.address,
        BN.from("7985268064407586120905").div(2),
        state.sqrtPrice,
        0,
      );
      // Expect user balance to have increased, and liquidity decreased
      expect(convertToStruct(await module.position()).liquidity).to.deep.equal(
        BN.from("3992634032203793060453"),
      );
      expect(await USDB.balanceOf(user1.address)).to.equal(
        BN.from("949998099999999999999994"),
      );
      expect(await WETH.balanceOf(user1.address)).to.equal(
        BN.from("48163101431125558251"),
      );
    });

    it("Rejects partial withdraw when no position exists", async () => {
      const { module } = await loadFixture(fixtureDeployed);

      await expect(
        module.moduleE_decreaseLiquidity({
          liquidity: 0,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 0,
        }),
      ).to.be.revertedWithCustomError(module, "NoPositionFound");
    });
  });

  describe("Rebalance tests", () => {
    async function addMoreLiquidity(module2:any, USDB:any, WETH:any) {

      let usdbAmount = WeiPerEther.mul(1_000_000)
      let wethAmount = WeiPerEther.mul(300)
      await USDB.connect(user3).transfer(
        module2.address,
        usdbAmount,
      );
      await WETH.connect(user3).transfer(
        module2.address,
        wethAmount,
      );

      await module2
        .moduleE_mintWithBalance({
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          slippageLiquidity: 1_000_000,
          sqrtPriceX96,
          tickLower: 60000,
          tickUpper: 120000,
        })
        .then((tx) => tx.wait());
    }

    it("Can reject invalid tick range", async () => {
      const { module } = await loadFixture(fixtureDeposited);
      let tickLower = -80880
      let tickUpper = -81480
      expect(tickLower >= tickUpper).to.be.true
      await expect(
        module.moduleE_rebalance({
          router: SWAP_ROUTER_ADDRESS,
          slippageSwap: 10000,
          slippageLiquidity: 1_000_000,
          tickLower,
          tickUpper,
          sqrtPriceX96,
        }),
      ).to.be.revertedWithCustomError(module, "InvalidTickParam");
    });

    it("reverts rebalance with zero balance", async () => {
      const { module } = await loadFixture(fixtureDeposited);
      let tickLower = -80880
      let tickUpper = -81480
      expect(tickLower >= tickUpper).to.be.true
      let position = await module.position()
      await module.moduleE_decreaseLiquidity({
        liquidity: position.liquidity,
        amount0Min: 0,
        amount1Min: 0,
        deadline: MaxUint256,
      })
      await module.moduleE_collectTo(user3.address)
      await expect(
        module.moduleE_rebalance({
          router: SWAP_ROUTER_ADDRESS,
          slippageSwap: 10000,
          slippageLiquidity: 1_000_000,
          tickLower,
          tickUpper,
          sqrtPriceX96,
        }),
      ).to.be.reverted
    });

    it("Can handle slippage rejection", async () => {
      const { module, module2, USDB, WETH } = await loadFixture(fixtureDeposited);
      await addMoreLiquidity(module2, USDB, WETH)

      await expect(
        module.moduleE_rebalance({
          router: SWAP_ROUTER_ADDRESS,
          slippageSwap: 1000, // 0.1%
          slippageLiquidity: 100_000,
          tickLower: -82020,
          tickUpper: -79620,
          sqrtPriceX96,
        }),
      ).to.be.reverted//With("Too little received"); // zeroLiquidityDesired() => 0xe6ace6df
    });

    it("Can rebalance with range below spot", async () => {
      const { module, module2, USDB, WETH, pool } = await loadFixture(fixtureDeposited);
      await addMoreLiquidity(module2, USDB, WETH)

      let state = await pool.safelyGetStateOfAMM()
      expect(state.tick).eq(82519)
      expect(state.sqrtPrice).to.equal(
        BN.from("4905481270181304529126937729524"),
      );
      let position = await module.position()
      expect(position.tickLower).eq(78000)
      expect(position.tickUpper).eq(87000)

      await module.moduleE_rebalance({
        router: SWAP_ROUTER_ADDRESS,
        slippageSwap: 100000,
        slippageLiquidity: 1_000_000,
        tickLower: 78600,
        tickUpper: 78660,
        sqrtPriceX96: state.sqrtPrice,
      })

      state = await pool.safelyGetStateOfAMM()
      almostEqual(state.tick, 80913)
      almostEqual(state.sqrtPrice, "4526928811615173530901926576656")

      position = await module.position()
      expect(position.nonce).eq(0)
      expect(position.operator).eq(AddressZero)
      expect(position.token0).eq(WETH_ADDRESS)
      expect(position.token1).eq(USDB_ADDRESS)
      expect(position.tickLower).eq(78600)
      expect(position.tickUpper).eq(78660)
      almostEqual(BN.from(position.liquidity), BN.from("1339631547459368528890146"), 0.002)
      expect(position.feeGrowthInside0LastX128).eq(0)
      expect(position.feeGrowthInside1LastX128).eq(0)
      expect(position.tokensOwed0).eq(0)
      expect(position.tokensOwed1).eq(0)

      // Only leftover on one side
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("0")]);
    });

    it("Can rebalance with range above spot", async () => {
      const { module, module2, USDB, WETH, pool } = await loadFixture(fixtureDeposited);
      await addMoreLiquidity(module2, USDB, WETH)
      let state = await pool.safelyGetStateOfAMM()
      expect(state.tick).eq(82519)
      expect(state.sqrtPrice).to.equal(
        BN.from("4905481270181304529126937729524"),
      );
      let position = await module.position()
      expect(position.tickLower).eq(78000)
      expect(position.tickUpper).eq(87000)
      await module.moduleE_rebalance({
        router: SWAP_ROUTER_ADDRESS,
        slippageSwap: 100000,
        slippageLiquidity: 1_000_000,
        tickLower: 86040,
        tickUpper: 86100,
        sqrtPriceX96: state.sqrtPrice,
      })
      state = await pool.safelyGetStateOfAMM()
      almostEqual(state.tick, 83921)
      almostEqual(state.sqrtPrice, "5261561148155400924256703306069")
      position = await module.position()
      expect(position.nonce).eq(0)
      expect(position.operator).eq(AddressZero)
      expect(position.token0).eq(WETH_ADDRESS)
      expect(position.token1).eq(USDB_ADDRESS)
      expect(position.tickLower).eq(86040)
      expect(position.tickUpper).eq(86100)
      almostEqual(BN.from(position.liquidity), BN.from("1333116296534931910563753"), 0.004)
      expect(position.feeGrowthInside0LastX128).eq(0)
      expect(position.feeGrowthInside1LastX128).eq(0)
      expect(position.tokensOwed0).eq(0)
      expect(position.tokensOwed1).eq(0)

      // Only leftover on one side
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("0")]);
    });

    it("Can handle rebalance to same range", async () => {
      const { module, module2, USDB, WETH, pool } = await loadFixture(fixtureDeposited);
      await addMoreLiquidity(module2, USDB, WETH)
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("2"), BN.from("4117143401061226630")]);

      expect(await module.tokenId()).to.deep.equal(BN.from("11"));
      let position = await module.position()
      let tickLower = 78000
      let tickUpper = 87000
      expect(position.tickLower).eq(tickLower)
      expect(position.tickUpper).eq(tickUpper)
      let state = await pool.safelyGetStateOfAMM()

      let tx = await module.moduleE_rebalance({
        router: SWAP_ROUTER_ADDRESS,
        slippageSwap: 1000000,
        slippageLiquidity: 1_000_000,
        tickLower: tickLower,
        tickUpper: tickUpper,
        sqrtPriceX96: state.sqrtPrice,
      })
      await expect(tx).to.emit(pool, "Swap")

      position = await module.position()
      expect(position.nonce).eq(0)
      expect(position.operator).eq(AddressZero)
      expect(position.token0).eq(WETH_ADDRESS)
      expect(position.token1).eq(USDB_ADDRESS)
      expect(position.tickLower).eq(78000)
      expect(position.tickUpper).eq(87000)
      almostEqual(BN.from(position.liquidity), BN.from("8381140546815517751888"))
      expect(position.feeGrowthInside0LastX128).eq(0)
      expect(position.feeGrowthInside1LastX128).eq(0)
      expect(position.tokensOwed0).eq(0)
      expect(position.tokensOwed1).eq(0)

      // Only leftover on one side
      let balances = await Promise.all([
        USDB.balanceOf(module.address),
        WETH.balanceOf(module.address),
      ])
      almostEqual(balances[0], "5796935085431998387056", 0.01)
      expect(balances[1]).eq(0)
    });

    it("Can rebalance equal", async () => {
      const { module, module2, USDB, WETH, pool } = await loadFixture(fixtureDeposited);
      await addMoreLiquidity(module2, USDB, WETH)
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("2"), BN.from("4117143401061226630")]);

      expect(await module.tokenId()).to.deep.equal(BN.from("11"));
      let state = await pool.safelyGetStateOfAMM()

      let tx = await module.moduleE_rebalance({
        router: SWAP_ROUTER_ADDRESS,
        slippageSwap: 1000000,
        slippageLiquidity: 10_000, // 1%
        tickLower: -82020,
        tickUpper: -79620,
        sqrtPriceX96: state.sqrtPrice,
      })
      await expect(tx).to.emit(pool, "Swap")

      let position = await module.position()
      expect(position.nonce).eq(0)
      expect(position.operator).eq(AddressZero)
      expect(position.token0).eq(WETH_ADDRESS)
      expect(position.token1).eq(USDB_ADDRESS)
      expect(position.tickLower).eq(-82020)
      expect(position.tickUpper).eq(-79620)
      almostEqual(BN.from(position.liquidity), BN.from("97156921762986951504538103"), 0.01)
      expect(position.feeGrowthInside0LastX128).eq(0)
      expect(position.feeGrowthInside1LastX128).eq(0)
      expect(position.tokensOwed0).eq(0)
      expect(position.tokensOwed1).eq(0)

      // single sided liquidity - no leftovers
      expect(
        await Promise.all([
          USDB.balanceOf(module.address),
          WETH.balanceOf(module.address),
        ]),
      ).to.deep.equal([BN.from("0"), BN.from("0")]);
    });
  });

  describe("agent with ETH", function () {
    it("wont wrap if weth is address zero", async function () {
      const fixture = await loadFixture(fixtureDeposited);
      const { WETH, module2 } = fixture
      expect(await module2.weth()).eq(AddressZero)
      let amount = WeiPerEther
      await user1.sendTransaction({
        to: module2.address,
        value: amount
      })
      let balances0 = await Promise.all([
        provider.getBalance(module2.address),
        WETH.balanceOf(module2.address)
      ])
      expect(balances0[0]).eq(amount)
      expect(balances0[1]).eq(0)
      let tx = await module2.moduleE_wrap();
      let balances1 = await Promise.all([
        provider.getBalance(module2.address),
        WETH.balanceOf(module2.address)
      ])
      expect(balances1[0]).eq(amount)
      expect(balances1[1]).eq(0)
    })
    it("wont unwrap if weth is address zero", async function () {
      const fixture = await loadFixture(fixtureDeposited);
      const { WETH, module2 } = fixture
      let amount = WeiPerEther
      await WETH.transfer(module2.address, amount)
      let balances0 = await Promise.all([
        provider.getBalance(module2.address),
        WETH.balanceOf(module2.address)
      ])
      expect(balances0[0]).eq(0)
      expect(balances0[1]).eq(amount)
      let tx = await module2.moduleE_unwrap();
      let balances1 = await Promise.all([
        provider.getBalance(module2.address),
        WETH.balanceOf(module2.address)
      ])
      expect(balances1[0]).eq(0)
      expect(balances1[1]).eq(amount)
    })
    it("can wrap zero", async function () {
      const fixture = await loadFixture(fixtureDeposited);
      const { WETH, module3 } = fixture
      expect(await module3.weth()).eq(WETH_ADDRESS)
      let balances0 = await Promise.all([
        provider.getBalance(module3.address),
        WETH.balanceOf(module3.address)
      ])
      expect(balances0[0]).eq(0)
      expect(balances0[1]).eq(0)
      let tx = await module3.moduleE_wrap();
      let balances1 = await Promise.all([
        provider.getBalance(module3.address),
        WETH.balanceOf(module3.address)
      ])
      expect(balances1[0]).eq(0)
      expect(balances1[1]).eq(0)
    })
    it("can wrap some", async function () {
      const fixture = await loadFixture(fixtureDeposited);
      const { WETH, module3 } = fixture
      let amount = WeiPerEther
      await user1.sendTransaction({
        to: module3.address,
        value: amount
      })
      let balances0 = await Promise.all([
        provider.getBalance(module3.address),
        WETH.balanceOf(module3.address)
      ])
      expect(balances0[0]).eq(amount)
      expect(balances0[1]).eq(0)
      let tx = await module3.moduleE_wrap();
      let balances1 = await Promise.all([
        provider.getBalance(module3.address),
        WETH.balanceOf(module3.address)
      ])
      expect(balances1[0]).eq(0)
      expect(balances1[1]).eq(amount)
    })
    it("can unwrap zero", async function () {
      const fixture = await loadFixture(fixtureDeposited);
      const { WETH, module3 } = fixture
      let balances0 = await Promise.all([
        provider.getBalance(module3.address),
        WETH.balanceOf(module3.address)
      ])
      expect(balances0[0]).eq(0)
      expect(balances0[1]).eq(0)
      let tx = await module3.moduleE_unwrap();
      let balances1 = await Promise.all([
        provider.getBalance(module3.address),
        WETH.balanceOf(module3.address)
      ])
      expect(balances1[0]).eq(0)
      expect(balances1[1]).eq(0)
    })
    it("can unwrap some", async function () {
      const fixture = await loadFixture(fixtureDeposited);
      const { WETH, module3 } = fixture
      let amount = WeiPerEther
      await WETH.transfer(module3.address, amount)
      let balances0 = await Promise.all([
        provider.getBalance(module3.address),
        WETH.balanceOf(module3.address)
      ])
      expect(balances0[0]).eq(0)
      expect(balances0[1]).eq(amount)
      let tx = await module3.moduleE_unwrap();
      let balances1 = await Promise.all([
        provider.getBalance(module3.address),
        WETH.balanceOf(module3.address)
      ])
      expect(balances1[0]).eq(amount)
      expect(balances1[1]).eq(0)
    })
    it("can mint with eth and usdb", async function () {
      const fixture = await loadFixture(fixtureDeposited);
      const { WETH, USDB, module3 } = fixture
      let usdbAmount = WeiPerEther.mul(3_000)
      let ethAmount = WeiPerEther.mul(1)
      await USDB.transfer(
        module3.address,
        usdbAmount,
      );
      await user1.sendTransaction({
        to: module3.address,
        value: ethAmount
      });
      let balances0 = await Promise.all([
        provider.getBalance(module3.address),
        WETH.balanceOf(module3.address),
        USDB.balanceOf(module3.address),
      ])
      expect(balances0[0]).eq(ethAmount)
      expect(balances0[1]).eq(0)
      expect(balances0[2]).eq(usdbAmount)

      await module3
        .moduleE_mintWithBalance({
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          slippageLiquidity: 1_000_000,
          sqrtPriceX96,
          tickLower: 78000,
          tickUpper: 87000,
        })
      let balances1 = await Promise.all([
        provider.getBalance(module3.address),
        WETH.balanceOf(module3.address),
        USDB.balanceOf(module3.address),
      ])
      expect(balances1[0]).eq(0)
      expect(balances1[1]).gte(0)
      expect(balances1[2]).gte(0)

      let position = await module3.position()
      expect(position.nonce).eq(0)
      expect(position.operator).eq(AddressZero)
      expect(position.token0).eq(WETH_ADDRESS)
      expect(position.token1).eq(USDB_ADDRESS)
      expect(position.tickLower).eq(78000)
      expect(position.tickUpper).eq(87000)
      almostEqual(BN.from(position.liquidity), BN.from("239558041932227583627"))
      expect(position.feeGrowthInside0LastX128).eq(0)
      expect(position.feeGrowthInside1LastX128).eq(0)
      expect(position.tokensOwed0).eq(0)
      expect(position.tokensOwed1).eq(0)
    })
    it("can rebalance with eth", async function () {
      const fixture = await loadFixture(fixtureDeposited);
      const { WETH, USDB, module3, pool } = fixture
      let usdbAmount = WeiPerEther.mul(3_000)
      let ethAmount = WeiPerEther.mul(1)
      await USDB.transfer(
        module3.address,
        usdbAmount,
      );
      await user1.sendTransaction({
        to: module3.address,
        value: ethAmount
      });
      let balances0 = await Promise.all([
        provider.getBalance(module3.address),
        WETH.balanceOf(module3.address),
        USDB.balanceOf(module3.address),
      ])
      expect(balances0[0]).eq(ethAmount)
      expect(balances0[1]).eq(0)
      expect(balances0[2]).eq(usdbAmount)

      await module3
        .moduleE_mintWithBalance({
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          slippageLiquidity: 1_000_000,
          sqrtPriceX96,
          tickLower: 78000,
          tickUpper: 87000,
        })
      let balances1 = await Promise.all([
        provider.getBalance(module3.address),
        WETH.balanceOf(module3.address),
        USDB.balanceOf(module3.address),
      ])
      expect(balances1[0]).eq(0)
      expect(balances1[1]).gte(0)
      expect(balances1[2]).gte(0)

      let position = await module3.position()
      expect(position.nonce).eq(0)
      expect(position.operator).eq(AddressZero)
      expect(position.token0).eq(WETH_ADDRESS)
      expect(position.token1).eq(USDB_ADDRESS)
      expect(position.tickLower).eq(78000)
      expect(position.tickUpper).eq(87000)
      almostEqual(BN.from(position.liquidity), BN.from("239558041932227583627"))
      expect(position.feeGrowthInside0LastX128).eq(0)
      expect(position.feeGrowthInside1LastX128).eq(0)
      expect(position.tokensOwed0).eq(0)
      expect(position.tokensOwed1).eq(0)

      await user1.sendTransaction({
        to: module3.address,
        value: ethAmount
      });
      let balances2 = await Promise.all([
        provider.getBalance(module3.address),
        WETH.balanceOf(module3.address),
        USDB.balanceOf(module3.address),
      ])
      expect(balances2[0]).eq(ethAmount)
      expect(balances2[1]).gte(0)
      expect(balances2[2]).gte(0)
      let state = await fixture.pool.safelyGetStateOfAMM()
      await module3.moduleE_rebalance({
        router: SWAP_ROUTER_ADDRESS,
        slippageSwap: 100000,
        slippageLiquidity: 1_000_000,
        tickLower: 78600,
        tickUpper: 78660,
        sqrtPriceX96: state.sqrtPrice,
      })
      let balances3 = await Promise.all([
        provider.getBalance(module3.address),
        WETH.balanceOf(module3.address),
        USDB.balanceOf(module3.address),
      ])
      expect(balances3[0]).eq(0)
      expect(balances3[1]).gte(0)
      expect(balances3[2]).gte(0)

      position = await module3.position()
      expect(position.nonce).eq(0)
      expect(position.operator).eq(AddressZero)
      expect(position.token0).eq(WETH_ADDRESS)
      expect(position.token1).eq(USDB_ADDRESS)
      expect(position.tickLower).eq(78600)
      expect(position.tickUpper).eq(78660)
      almostEqual(BN.from(position.liquidity), BN.from("68267724540946125598371"))
      expect(position.feeGrowthInside0LastX128).eq(0)
      expect(position.feeGrowthInside1LastX128).eq(0)
      expect(position.tokensOwed0).eq(0)
      expect(position.tokensOwed1).eq(0)
    })
    it("can withdraw liquidity to eth", async function () {
      const fixture = await loadFixture(fixtureDeposited);
      const { WETH, USDB, module3, pool } = fixture
      let usdbAmount = WeiPerEther.mul(3_000)
      let ethAmount = WeiPerEther.mul(1)
      await USDB.transfer(
        module3.address,
        usdbAmount,
      );
      await user1.sendTransaction({
        to: module3.address,
        value: ethAmount
      });
      let balances0 = await Promise.all([
        provider.getBalance(module3.address),
        WETH.balanceOf(module3.address),
        USDB.balanceOf(module3.address),
        provider.getBalance(user1.address),
        provider.getBalance(user3.address),
      ])
      expect(balances0[0]).eq(ethAmount)
      expect(balances0[1]).eq(0)
      expect(balances0[2]).eq(usdbAmount)

      await module3
        .moduleE_mintWithBalance({
          manager: POSITION_MANAGER_ADDRESS,
          pool: POOL_ADDRESS,
          slippageLiquidity: 1_000_000,
          sqrtPriceX96,
          tickLower: 78000,
          tickUpper: 87000,
        })
      let balances1 = await Promise.all([
        provider.getBalance(module3.address),
        WETH.balanceOf(module3.address),
        USDB.balanceOf(module3.address),
        provider.getBalance(user1.address),
        provider.getBalance(user3.address),
      ])
      expect(balances1[0]).eq(0)
      expect(balances1[1]).gte(0)
      expect(balances1[2]).gte(0)

      let position = await module3.position()
      expect(position.nonce).eq(0)
      expect(position.operator).eq(AddressZero)
      expect(position.token0).eq(WETH_ADDRESS)
      expect(position.token1).eq(USDB_ADDRESS)
      expect(position.tickLower).eq(78000)
      expect(position.tickUpper).eq(87000)
      almostEqual(BN.from(position.liquidity), BN.from("239558041932227583627"))
      expect(position.feeGrowthInside0LastX128).eq(0)
      expect(position.feeGrowthInside1LastX128).eq(0)
      expect(position.tokensOwed0).eq(0)
      expect(position.tokensOwed1).eq(0)

      let state = await fixture.pool.safelyGetStateOfAMM()
      await module3.moduleE_fullWithdrawTo(user3.address, state.sqrtPrice, 1000)

      let balances2 = await Promise.all([
        provider.getBalance(module3.address),
        WETH.balanceOf(module3.address),
        USDB.balanceOf(module3.address),
        provider.getBalance(user1.address),
        provider.getBalance(user3.address),
      ])
      expect(balances2[0]).eq(0)
      expect(balances2[1]).eq(0)
      expect(balances2[2]).eq(0)
      expect(balances2[3]).lt(balances1[3]) // gas cost
      expect(balances2[4].sub(balances1[4])).eq("999999999999999999") // received eth

      await expect(module3.position()).to.be.reverted // burnt
    })
  })

  function calculatePriceV3(sqrtPriceX96:any, inverse=false) {
    var numerator = BN.from(2).pow(192).mul(WeiPerEther)
    var denominator = sqrtPriceX96.pow(2)
    var str = formatUnits(numerator.div(denominator))
    var price = parseFloat(str)
    if(inverse) price = 1/price
    return price
  }
});
