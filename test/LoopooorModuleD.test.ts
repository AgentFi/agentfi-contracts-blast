/* global describe it before ethers */

import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
const { ethers } = hre;
const { provider } = ethers;
const { parseEther } = ethers.utils;
import chai from "chai";
const { expect } = chai;

import {
  AgentRegistry,
  BlastooorAccountFactory,
  BlastooorGenesisAgentAccount,
  BlastooorGenesisFactory,
  BlastooorStrategyAgents,
  BlastooorStrategyFactory,
  LoopooorModuleD,
} from "../typechain-types";

import { deployContract } from "../scripts/utils/deployContract";
import { toBytes32 } from "../scripts/utils/setStorage";
import { calcSighash } from "../scripts/utils/diamond";
import { BlastooorGenesisAgents } from "../typechain-types/contracts/tokens/BlastooorGenesisAgents";

/* prettier-ignore */ const BLAST_ADDRESS                 = "0x4300000000000000000000000000000000000002";
/* prettier-ignore */ const BLAST_POINTS_ADDRESS          = "0x2fc95838c71e76ec69ff817983BFf17c710F34E0";
/* prettier-ignore */ const BLAST_POINTS_OPERATOR_ADDRESS = "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";
/* prettier-ignore */ const COMPTROLLER_ADDRESS           = "0xe9266ae95bB637A7Ad598CB0390d44262130F433";
/* prettier-ignore */ const DETH_ADDRESS                  = "0x1Da40C742F32bBEe81694051c0eE07485fC630f6";
/* prettier-ignore */ const DUSDB_ADDRESS                 = "0x1A3D9B2fa5c6522c8c071dC07125cE55dF90b253";
/* prettier-ignore */ const ENTRY_POINT_ADDRESS           = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
/* prettier-ignore */ const ERC6551_REGISTRY_ADDRESS      = "0x000000006551c19487814612e58FE06813775758";
/* prettier-ignore */ const ODETH_ADDRESS                 = "0xa3135b76c28b3971B703a5e6CD451531b187Eb5A";
/* prettier-ignore */ const ODUSDB_ADDRESS                = "0x4ADF85E2e760c9211894482DF74BA535BCae50A4";
/* prettier-ignore */ const POOL_ADDRESS                  = "0xf00DA13d2960Cf113edCef6e3f30D92E52906537";
/* prettier-ignore */ const POSITION_MANAGER_ADDRESS      = "0x434575EaEa081b735C985FA9bf63CD7b87e227F9";
/* prettier-ignore */ const SWAP_ROUTER_ADDRESS           = "0x337827814155ECBf24D20231fCA4444F530C0555";
/* prettier-ignore */ const USDB_ADDRESS                  = "0x4300000000000000000000000000000000000003";
/* prettier-ignore */ const WETH_ADDRESS                  = "0x4300000000000000000000000000000000000004";
/* prettier-ignore */ const WRAPMINT_ETH_ADDRESS          = "0xD89dcC88AcFC6EF78Ef9602c2Bf006f0026695eF";
/* prettier-ignore */ const WRAPMINT_USDB_ADDRESS         = "0xf2050acF080EE59300E3C0782B87f54FDf312525";

/* prettier-ignore */ const OWNER_ADDRESS                 = "0xA214a4fc09C42202C404E2976c50373fE5F5B789";
/* prettier-ignore */ const USER_ADDRESS                  = "0x3E0770C75c0D5aFb1CfA3506d4b0CaB11770a27a";

const permissions = Object.entries({
  // Public
  [toBytes32(0)]: [
    "comptroller()",
    "duoAsset()",
    "moduleName()",
    "oToken()",
    "strategyType()",
    "wrapMint()",
  ],

  // AgentFi + Owner
  [toBytes32(9)]: [
    "moduleD_borrow(uint256)",
    "moduleD_burnFixedRate(address,uint256)",
    "moduleD_burnVariableRate(address,uint256,uint256)",
    "moduleD_enterMarkets(address[])",
    "moduleD_initialize(address,address)",
    "moduleD_mint(uint256)",
    "moduleD_mintVariableRateEth(address,uint256,uint256,bytes)",
    "moduleD_redeem(uint256)",
    "moduleD_repayBorrow(uint256)",
  ],

  // Owner Only:
  [toBytes32(1)]: [],
}).reduce(
  (acc, [requiredRole, functions]) => {
    functions.forEach((func) => {
      acc.push({ selector: calcSighash(func, true), requiredRole });
    });

    return acc;
  },
  [] as { selector: string; requiredRole: string }[],
);

// expect(functionParams).to.deep.equal(permissions);

export async function fixtureSetup(moduleName: "LoopooorModuleD") {
  const [deployer] = await ethers.getSigners();
  const blockNumber = 3821000;
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

  // console.log(Object.keys(module.functions).filter((x) => x.includes("(")));

  const overrides = [
    {
      implementation: module.address,
      functionParams: permissions, //TODO:- CHange this to function params
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
  )) as LoopooorModuleD;

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

describe("LoopoorModuleD", function () {
  async function fixtureDeployed() {
    const fixture = await fixtureSetup("LoopooorModuleD");

    return fixture;
  }
  it("View uninitialized state", async function () {
    const { module } = await loadFixture(fixtureDeployed);
    expect(await module.strategyType()).to.equal("Loopooor");
    expect(await module.moduleName()).to.equal("LoopooorModuleD");

    expect(await module.oToken()).to.equal(
      "0x0000000000000000000000000000000000000000",
    );
    expect(await module.wrapMint()).to.equal(
      "0x0000000000000000000000000000000000000000",
    );
    expect(await module.comptroller()).to.equal(
      "0x0000000000000000000000000000000000000000",
    );
    expect(await module.duoAsset()).to.equal(
      "0x0000000000000000000000000000000000000000",
    );
  });

  describe("USDB Configuration", () => {
    async function fixtureInitialized() {
      const fixture = await fixtureDeployed();

      await fixture.module.moduleD_initialize(
        WRAPMINT_USDB_ADDRESS,
        ODUSDB_ADDRESS,
      );
      return fixture;
    }
    it("Can view state after initialize", async function () {
      const { module } = await loadFixture(fixtureInitialized);

      expect(await module.oToken()).to.equal(ODUSDB_ADDRESS);
      expect(await module.wrapMint()).to.equal(WRAPMINT_USDB_ADDRESS);
      expect(await module.comptroller()).to.equal(COMPTROLLER_ADDRESS);
      expect(await module.duoAsset()).to.equal(DUSDB_ADDRESS);
    });

    it("Can enter market", async function () {
      const { module } = await loadFixture(fixtureInitialized);

      const COMPTROLLER = await ethers.getContractAt(
        "IOrbitSpaceStationV4",
        COMPTROLLER_ADDRESS,
      );

      expect(
        await COMPTROLLER.checkMembership(module.address, ODUSDB_ADDRESS),
      ).to.equal(false);

      await module
        .moduleD_enterMarkets([ODUSDB_ADDRESS])
        .then((tx) => tx.wait());

      expect(
        await COMPTROLLER.checkMembership(module.address, ODUSDB_ADDRESS),
      ).to.equal(true);
    });

    it("Individual integrations for depositing USDB in boost yield", async function () {});
  });

  describe("ETH Configuration", () => {
    async function fixtureInitialized() {
      const fixture = await fixtureDeployed();

      await fixture.module.moduleD_initialize(
        WRAPMINT_ETH_ADDRESS,
        ODETH_ADDRESS,
      );
      return fixture;
    }
    it("Can view state after initialize", async function () {
      const { module } = await loadFixture(fixtureInitialized);

      expect(await module.oToken()).to.equal(ODETH_ADDRESS);
      expect(await module.wrapMint()).to.equal(WRAPMINT_ETH_ADDRESS);
      expect(await module.comptroller()).to.equal(COMPTROLLER_ADDRESS);
      expect(await module.duoAsset()).to.equal(DETH_ADDRESS);
    });

    it("Can enter market", async function () {
      const { module } = await loadFixture(fixtureInitialized);

      const COMPTROLLER = await ethers.getContractAt(
        "IOrbitSpaceStationV4",
        COMPTROLLER_ADDRESS,
      );

      expect(
        await COMPTROLLER.checkMembership(module.address, ODETH_ADDRESS),
      ).to.equal(false);

      await module
        .moduleD_enterMarkets([ODETH_ADDRESS])
        .then((tx) => tx.wait());

      expect(
        await COMPTROLLER.checkMembership(module.address, ODETH_ADDRESS),
      ).to.equal(true);
    });

    it("Individual integrations for depositing ETH in boost yield", async function () {
      const { module, WETH } = await loadFixture(fixtureInitialized);

      const DETH = await ethers.getContractAt("MockERC20", DETH_ADDRESS);
      const ODETH = await ethers.getContractAt("MockERC20", ODETH_ADDRESS);

      const wrapper = await ethers.getContractAt(
        "IWrapMintV2",
        WRAPMINT_ETH_ADDRESS,
      );

      // ===== Mint DETH
      // This is the proxy contract where the principal is stored, we check we "guessed" the right one
      const variableRateAddress = "0x518e0D4c3d5B6ccFA21A2B344fC9C819AB17b154";
      const mintTx = module.moduleD_mintVariableRateEth(
        SWAP_ROUTER_ADDRESS,
        parseEther("0.2"),
        0,
        toBytes32(0),
        {
          value: parseEther("0.2"),
        },
      );

      await expect(mintTx).to.changeTokenBalance(
        DETH,
        module.address,
        parseEther("0.2"),
      );
      await expect(mintTx)
        .to.emit(wrapper, "MintVariableRate")
        .withArgs(variableRateAddress, module.address, parseEther("0.2"));

      // ===== Supply, minting oDETH
      const supplyTx = module.moduleD_mint(parseEther("0.1"));
      await expect(supplyTx).to.changeTokenBalance(
        ODETH,
        module.address,
        parseEther("499.999985204480437814"),
      );
      await expect(supplyTx).to.changeTokenBalance(
        DETH,
        module.address,
        parseEther("-0.1"),
      );

      // Enable as collateral
      await module.moduleD_enterMarkets([ODETH_ADDRESS]);

      // ======= Borrow
      await expect(
        module.moduleD_borrow(parseEther("0.05")),
      ).to.changeTokenBalance(DETH, module.address, parseEther("0.05"));

      // == Repay borrow
      await expect(
        module.moduleD_repayBorrow(ethers.constants.MaxUint256),
      ).to.changeTokenBalance(
        DETH,
        module.address,
        parseEther("-0.050000000004818234"),
      );

      // == Redeem
      const withdrawalTx = module.moduleD_redeem(
        await ODETH.balanceOf(module.address),
      );
      await expect(withdrawalTx).to.changeTokenBalance(
        ODETH,
        module.address,
        parseEther("-499.999985204480437814"),
      );
      await expect(withdrawalTx).to.changeTokenBalance(
        DETH,
        module.address,
        parseEther("0.100000000000374499"),
      );

      // == Burn
      const burnTx = module.moduleD_burnVariableRate(
        variableRateAddress,
        await DETH.balanceOf(module.address),
        0,
      );
      await expect(burnTx).to.changeTokenBalance(
        DETH,
        module.address,
        parseEther("-0.199999999995556265"),
      );
      await expect(burnTx).to.changeTokenBalance(
        WETH,
        module.address,
        parseEther("0.200000004101846116"),
      );
    });
  });
});
