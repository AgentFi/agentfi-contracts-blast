// /* global describe it before ethers */

import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
const { ethers } = hre;
const { provider } = ethers;
const { parseEther } = ethers.utils;
const { AddressZero, MaxUint256, WeiPerEther } = ethers.constants;
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
import { almostEqual } from "../scripts/utils/test";
import { moduleDFunctionParams as functionParams } from "../scripts/configuration/LoopooorModuleD";

/* prettier-ignore */ const BLAST_ADDRESS                 = "0x4300000000000000000000000000000000000002";
/* prettier-ignore */ const BLAST_POINTS_ADDRESS          = "0x2fc95838c71e76ec69ff817983BFf17c710F34E0";
/* prettier-ignore */ const BLAST_POINTS_OPERATOR_ADDRESS = "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";
/* prettier-ignore */ const COMPTROLLER_ADDRESS           = "0xe9266ae95bB637A7Ad598CB0390d44262130F433";
/* prettier-ignore */ const DETH_ADDRESS                  = "0x1Da40C742F32bBEe81694051c0eE07485fC630f6";
/* prettier-ignore */ const DUSD_ADDRESS                  = "0x1A3D9B2fa5c6522c8c071dC07125cE55dF90b253";
/* prettier-ignore */ const ENTRY_POINT_ADDRESS           = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
/* prettier-ignore */ const ERC6551_REGISTRY_ADDRESS      = "0x000000006551c19487814612e58FE06813775758";
/* prettier-ignore */ const ODETH_ADDRESS                 = "0xa3135b76c28b3971B703a5e6CD451531b187Eb5A";
/* prettier-ignore */ const ODUSD_ADDRESS                 = "0x4ADF85E2e760c9211894482DF74BA535BCae50A4";
/* prettier-ignore */ const POOL_ADDRESS                  = "0xf00DA13d2960Cf113edCef6e3f30D92E52906537";
/* prettier-ignore */ const POSITION_MANAGER_ADDRESS      = "0x434575EaEa081b735C985FA9bf63CD7b87e227F9";
/* prettier-ignore */ const SWAP_ROUTER_ADDRESS           = "0x337827814155ECBf24D20231fCA4444F530C0555";
/* prettier-ignore */ const USDB_ADDRESS                  = "0x4300000000000000000000000000000000000003";
/* prettier-ignore */ const WETH_ADDRESS                  = "0x4300000000000000000000000000000000000004";
/* prettier-ignore */ const ETH_ADDRESS                   = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
/* prettier-ignore */ const WRAPMINT_ETH_ADDRESS          = "0xD89dcC88AcFC6EF78Ef9602c2Bf006f0026695eF";
/* prettier-ignore */ const WRAPMINT_USDB_ADDRESS         = "0xf2050acF080EE59300E3C0782B87f54FDf312525";
/* prettier-ignore */ const ORBIT_ADDRESS                 = "0x42E12D42b3d6C4A74a88A61063856756Ea2DB357";

/* prettier-ignore */ const OWNER_ADDRESS                 = "0xA214a4fc09C42202C404E2976c50373fE5F5B789";
/* prettier-ignore */ const USER_ADDRESS                  = "0x3E0770C75c0D5aFb1CfA3506d4b0CaB11770a27a";

enum MODE {
  BOOST_POINTS = 1,
  BOOST_YIELD = 2,
}
const permissions = Object.entries({
  // Public
  [toBytes32(0)]: [
    "borrowBalance()",
    "comptroller()",
    "duoAsset()",
    "mode()",
    "moduleName()",
    "oToken()",
    "rateContract()",
    "strategyType()",
    "supplyBalance()",
    "underlying()",
    "wrapMint()",
  ],

  // AgentFi + Owner
  //[toBytes32(9)]: [],
  // none

  // Owner Only:
  [toBytes32(1)]: [
    "moduleD_borrow(address,uint256)",
    "moduleD_burnFixedRate(address,address,uint256)",
    "moduleD_burnVariableRate(address,address,uint256,uint256)",
    "moduleD_depositBalance(address,address,address,uint8,uint256)",
    "moduleD_mint(address,uint256)",
    "moduleD_mintFixedRate(address,address,address,uint256,uint256,uint256,bytes)",
    "moduleD_mintFixedRateEth(address,address,uint256,uint256,uint256,bytes)",
    "moduleD_mintVariableRate(address,address,address,uint256,uint256,bytes)",
    "moduleD_mintVariableRateEth(address,address,uint256,uint256,bytes)",
    "moduleD_redeem(address,uint256)",
    "moduleD_repayBorrow(address,uint256)",
    "moduleD_sendBalanceTo(address,address)",
    "moduleD_withdrawBalance()",
    "moduleD_withdrawBalanceTo(address)",
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
      AddressZero,
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
      AddressZero,
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
    // paymentToken: AddressZero,
    paymentAmount: WeiPerEther.mul(1).div(100),
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
    .blastooorPublicMint(1, { value: WeiPerEther.div(100) });

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

    const COMPTROLLER = await ethers.getContractAt(
      "IOrbitSpaceStationV4",
      COMPTROLLER_ADDRESS,
    );

    const DUSD = await ethers.getContractAt("MockERC20", DUSD_ADDRESS);
    const ODUSD = await ethers.getContractAt("MockERC20", ODUSD_ADDRESS);
    const WRAPMINT_USDB = await ethers.getContractAt(
      "IWrapMintV2",
      WRAPMINT_USDB_ADDRESS,
    );

    const DETH = await ethers.getContractAt("MockERC20", DETH_ADDRESS);
    const ODETH = await ethers.getContractAt("MockERC20", ODETH_ADDRESS);

    const WRAPMINT_ETH = await ethers.getContractAt(
      "IWrapMintV2",
      WRAPMINT_ETH_ADDRESS,
    );
    return {
      ...fixture,
      COMPTROLLER,
      WRAPMINT_USDB,
      DUSD,
      ODUSD,
      DETH,
      ODETH,
      WRAPMINT_ETH,
    };
  }
  describe("USDB Configuration", () => {
    it("View uninitialized state", async function () {
      const { module } = await loadFixture(fixtureDeployed);
      expect(await module.strategyType()).to.equal("Loopooor");
      expect(await module.moduleName()).to.equal("LoopooorModuleD");

      expect(await module.mode()).to.equal(parseEther("0"));
      expect(await module.borrowBalance()).to.equal(parseEther("0"));
      expect(await module.supplyBalance()).to.equal(parseEther("0"));

      expect(
        await Promise.all([
          module.comptroller(),
          module.duoAsset(),
          module.rateContract(),
          module.oToken(),
          module.underlying(),
          module.wrapMint(),
        ]),
      ).to.deep.equal([
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
      ]);
    });

    it("Can set state after deposit", async function () {
      const { module, USDB } = await loadFixture(fixtureDeployed);

      await USDB.transfer(module.address, parseEther("200"));
      await module.moduleD_depositBalance(
        WRAPMINT_USDB_ADDRESS,
        ODUSD_ADDRESS,
        USDB_ADDRESS,
        MODE.BOOST_POINTS,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );

      expect(await module.oToken()).to.equal(ODUSD_ADDRESS);
      expect(await module.wrapMint()).to.equal(WRAPMINT_USDB_ADDRESS);
      expect(await module.comptroller()).to.equal(COMPTROLLER_ADDRESS);
      expect(await module.duoAsset()).to.equal(DUSD_ADDRESS);
    });

    it("Can mint fixedRate DUSD with USDB", async function () {
      const { module, USDB, DUSD, signer, WRAPMINT_USDB } =
        await loadFixture(fixtureDeployed);

      await USDB.transfer(module.address, parseEther("200"));

      const mintTx = module.moduleD_mintFixedRate(
        WRAPMINT_USDB_ADDRESS,
        SWAP_ROUTER_ADDRESS,
        USDB.address,
        parseEther("200"),
        0,
        0,
        toBytes32(0),
      );

      await expect(mintTx).to.changeTokenBalance(
        DUSD,
        module.address,
        parseEther("200"),
      );

      await expect(mintTx)
        .to.emit(WRAPMINT_USDB, "MintFixedRate")
        .withArgs(
          "0x58DA3af1b72B7d98bb72BF5C6031827de2c0A786",
          module.address,
          parseEther("200"),
          0,
        );
    });

    it("Can mint variableRate DUSD with USDB", async function () {
      const { module, USDB, DUSD, WRAPMINT_USDB } =
        await loadFixture(fixtureDeployed);

      await USDB.transfer(module.address, parseEther("2"));

      const mintTx = module.moduleD_mintVariableRate(
        WRAPMINT_USDB_ADDRESS,
        SWAP_ROUTER_ADDRESS,
        USDB.address,
        parseEther("2"),
        0,
        toBytes32(0),
      );

      await expect(mintTx).to.changeTokenBalance(
        DUSD,
        module.address,
        parseEther("2"),
      );

      await expect(mintTx)
        .to.emit(WRAPMINT_USDB, "MintVariableRate")
        .withArgs(
          "0x58DA3af1b72B7d98bb72BF5C6031827de2c0A786",
          module.address,
          parseEther("2"),
        );
    });

    it("Looped depositing USDB in fixedRate", async function () {
      const { module, ODUSD, DUSD, COMPTROLLER, USDB, WRAPMINT_USDB } =
        await loadFixture(fixtureDeployed);

      // Confirm Initial stage
      expect(
        await COMPTROLLER.checkMembership(module.address, ODUSD_ADDRESS),
      ).to.equal(false);

      await USDB.transfer(module.address, parseEther("100"));

      // ===== Do leverage mint
      const mintTx = module.moduleD_depositBalance(
        WRAPMINT_USDB_ADDRESS,
        ODUSD_ADDRESS,
        USDB_ADDRESS,
        MODE.BOOST_POINTS,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );

      await expect(mintTx).to.changeTokenBalance(
        DUSD,
        module.address,
        parseEther("0"),
      );

      await expect(mintTx).to.emit(WRAPMINT_USDB, "MintFixedRate");

      almostEqual(
        await ODUSD.balanceOf(module.address),
        parseEther("1249991.679098100761621992"),
      );

      expect(await module.underlying()).to.equal(USDB_ADDRESS);
      expect(
        await COMPTROLLER.checkMembership(module.address, ODUSD_ADDRESS),
      ).to.equal(true);

      // ===== Do leverage burn
      const usdb = await USDB.balanceOf(USER_ADDRESS);
      await module.moduleD_withdrawBalanceTo(USER_ADDRESS);

      almostEqual(
        (await USDB.balanceOf(USER_ADDRESS)).sub(usdb),
        parseEther("99.999999953036711437"),
      );

      expect(await ODUSD.balanceOf(module.address)).to.equal(parseEther("0"));
    });

    it("Looped depositing USDB in variableRate", async function () {
      const { module, ODUSD, DUSD, COMPTROLLER, WRAPMINT_USDB, USDB } =
        await loadFixture(fixtureDeployed);

      // Confirm Initial stage
      expect(
        await COMPTROLLER.checkMembership(module.address, ODUSD_ADDRESS),
      ).to.equal(false);

      await USDB.transfer(module.address, parseEther("100"));

      // ===== Do leverage mint
      const mintTx = module.moduleD_depositBalance(
        WRAPMINT_USDB_ADDRESS,
        ODUSD_ADDRESS,
        USDB_ADDRESS,
        MODE.BOOST_YIELD,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );

      await expect(mintTx).to.changeTokenBalance(
        DUSD,
        module.address,
        parseEther("0"),
      );

      almostEqual(
        await ODUSD.balanceOf(module.address),
        parseEther("1249991.679098100761621992"),
      );

      await expect(mintTx).to.emit(WRAPMINT_USDB, "MintVariableRate");

      expect(await module.underlying()).to.equal(USDB_ADDRESS);
      expect(
        await COMPTROLLER.checkMembership(module.address, ODUSD_ADDRESS),
      ).to.equal(true);

      // ===== Do leverage burn
      const usdb = await USDB.balanceOf(USER_ADDRESS);
      await module.moduleD_withdrawBalanceTo(USER_ADDRESS);

      almostEqual(
        (await USDB.balanceOf(USER_ADDRESS)).sub(usdb),
        parseEther("99.999999953036711437"),
      );

      expect(await ODUSD.balanceOf(module.address)).to.equal(parseEther("0"));
    });
  });

  describe("ETH Configuration", () => {
    it("Can set state after deposit", async function () {
      const { module } = await loadFixture(fixtureDeployed);
      await module.moduleD_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        ODETH_ADDRESS,
        ETH_ADDRESS,
        MODE.BOOST_YIELD,
        parseEther("2"), // 2.5 is max based on 60% LTV
        {
          value: parseEther("0.1"),
        },
      );

      expect(await module.oToken()).to.equal(ODETH_ADDRESS);
      expect(await module.wrapMint()).to.equal(WRAPMINT_ETH_ADDRESS);
      expect(await module.comptroller()).to.equal(COMPTROLLER_ADDRESS);
      expect(await module.duoAsset()).to.equal(DETH_ADDRESS);
    });

    // Takes too long to run, causes out of memory issue
    it.skip("Can revert on too high leverage", async function () {
      const { module } = await loadFixture(fixtureDeployed);
      await expect(
        module.moduleD_depositBalance(
          WRAPMINT_ETH_ADDRESS,
          ODETH_ADDRESS,
          ETH_ADDRESS,
          MODE.BOOST_YIELD,
          parseEther("10.00"), // 2.5 is max based on 60% LTV
          {
            value: parseEther("0.1"),
          },
        ),
      ).to.be.reverted;
    });

    it("Can reject double deposit", async function () {
      const { module } = await loadFixture(fixtureDeployed);
      await module.moduleD_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        ODETH_ADDRESS,
        ETH_ADDRESS,
        MODE.BOOST_YIELD,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
        {
          value: parseEther("0.1"),
        },
      );

      await expect(
        module.moduleD_depositBalance(
          WRAPMINT_ETH_ADDRESS,
          ODETH_ADDRESS,
          ETH_ADDRESS,
          MODE.BOOST_YIELD,
          parseEther("2.499"), // 2.5 is max based on 60% LTV
          {
            value: parseEther("0.1"),
          },
        ),
      ).to.be.revertedWithCustomError(module, "PositionAlreadyExists");
    });

    it("Can mint fixedRate DETH with WETH", async function () {
      const { module, DETH, WETH, signer, WRAPMINT_ETH } =
        await loadFixture(fixtureDeployed);

      await signer.sendTransaction({
        to: WETH.address,
        value: parseEther("0.2"),
      });

      await WETH.transfer(module.address, parseEther("0.2"));

      const mintTx = module.moduleD_mintFixedRate(
        WRAPMINT_ETH_ADDRESS,
        SWAP_ROUTER_ADDRESS,
        WETH.address,
        parseEther("0.2"),
        0,
        0,
        toBytes32(0),
      );

      await expect(mintTx).to.changeTokenBalance(
        DETH,
        module.address,
        parseEther("0.2"),
      );

      await expect(mintTx)
        .to.emit(WRAPMINT_ETH, "MintFixedRate")
        .withArgs(
          "0x518e0D4c3d5B6ccFA21A2B344fC9C819AB17b154",
          module.address,
          parseEther("0.2"),
          0,
        );
    });

    it("Can mint fixed rate DETH with ETH", async function () {
      const { module, DETH, WRAPMINT_ETH } = await loadFixture(fixtureDeployed);

      const mintTx = module.moduleD_mintFixedRateEth(
        WRAPMINT_ETH_ADDRESS,
        SWAP_ROUTER_ADDRESS,
        parseEther("0.2"),
        0,
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
        .to.emit(WRAPMINT_ETH, "MintFixedRate")
        .withArgs(
          "0x518e0D4c3d5B6ccFA21A2B344fC9C819AB17b154",
          module.address,
          parseEther("0.2"),
          0,
        );
    });

    it("Can mint variableRate DETH with ETH", async function () {
      const { module, DETH, WRAPMINT_ETH } = await loadFixture(fixtureDeployed);
      const mintTx = module.moduleD_mintVariableRateEth(
        WRAPMINT_ETH_ADDRESS,
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
        .to.emit(WRAPMINT_ETH, "MintVariableRate")
        .withArgs(
          "0x518e0D4c3d5B6ccFA21A2B344fC9C819AB17b154",
          module.address,
          parseEther("0.2"),
        );
    });

    it("Can mint variableRate DETH with WETH", async function () {
      const { module, DETH, WETH, signer, WRAPMINT_ETH } =
        await loadFixture(fixtureDeployed);

      await signer.sendTransaction({
        to: WETH.address,
        value: parseEther("0.2"),
      });

      await WETH.transfer(module.address, parseEther("0.2"));

      const mintTx = module.moduleD_mintVariableRate(
        WRAPMINT_ETH_ADDRESS,
        SWAP_ROUTER_ADDRESS,
        WETH.address,
        parseEther("0.2"),
        0,
        toBytes32(0),
      );

      await expect(mintTx).to.changeTokenBalance(
        DETH,
        module.address,
        parseEther("0.2"),
      );

      await expect(mintTx)
        .to.emit(WRAPMINT_ETH, "MintVariableRate")
        .withArgs(
          "0x518e0D4c3d5B6ccFA21A2B344fC9C819AB17b154",
          module.address,
          parseEther("0.2"),
        );
    });

    it("Individual integrations for depositing ETH in variable rate", async function () {
      const { module, WETH, ODETH, DETH, WRAPMINT_ETH } =
        await loadFixture(fixtureDeployed);

      // ===== Mint DETH
      // This is the proxy contract where the principal is stored, we check we "guessed" the right one
      const variableRateContract = "0x518e0D4c3d5B6ccFA21A2B344fC9C819AB17b154";
      const mintTx = module.moduleD_mintVariableRateEth(
        WRAPMINT_ETH_ADDRESS,
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
        .to.emit(WRAPMINT_ETH, "MintVariableRate")
        .withArgs(variableRateContract, module.address, parseEther("0.2"));

      // ===== Supply, minting oDETH
      const supplyTx = module.moduleD_mint(ODETH_ADDRESS, parseEther("0.1"));

      almostEqual(
        await ODETH.balanceOf(module.address),
        parseEther("499.999985204947937787"),
      );
      await expect(supplyTx).to.changeTokenBalance(
        DETH,
        module.address,
        parseEther("-0.1"),
      );

      // Enable as collateral
      await module.moduleD_enterMarkets(COMPTROLLER_ADDRESS, [ODETH_ADDRESS]);

      // ======= Borrow
      await expect(
        module.moduleD_borrow(ODETH_ADDRESS, parseEther("0.05")),
      ).to.changeTokenBalance(DETH, module.address, parseEther("0.05"));

      // == Repay borrow
      await expect(
        module.moduleD_repayBorrow(ODETH_ADDRESS, MaxUint256),
      ).to.changeTokenBalance(
        DETH,
        module.address,
        parseEther("-0.050000000004818234"),
      );

      // == Redeem
      const withdrawalTx = module.moduleD_redeem(
        ODETH_ADDRESS,
        await ODETH.balanceOf(module.address),
      );

      await expect(withdrawalTx).to.changeTokenBalance(
        DETH,
        module.address,
        parseEther("0.100000000000374499"),
      );

      // == Burn
      const burnTx = await module.moduleD_burnVariableRate(
        WRAPMINT_ETH_ADDRESS,
        variableRateContract,
        await DETH.balanceOf(module.address),
        0,
      );

      expect(await DETH.balanceOf(module.address)).to.equal(0);
      expect(await ODETH.balanceOf(module.address)).to.equal(0);
      almostEqual(
        await WETH.balanceOf(module.address),
        parseEther("0.200000004101846116"),
      );

      expect(await module.underlying()).to.equal(AddressZero);
    });

    it("cannot burn with invalid wrapMint", async function () {
      const { module, WETH, ODETH, DETH, WRAPMINT_ETH } =
        await loadFixture(fixtureDeployed);
      const variableRateContract = "0x518e0D4c3d5B6ccFA21A2B344fC9C819AB17b154";
      await expect(module.moduleD_burnVariableRate(
        AddressZero,
        variableRateContract,
        await DETH.balanceOf(module.address),
        0,
      )).to.be.reverted;
    })

    it("Looped depositing WETH in fixedRate", async function () {
      const { module, ODETH, DETH, COMPTROLLER, WETH, WRAPMINT_ETH, signer } =
        await loadFixture(fixtureDeployed);

      // Confirm Initial stage
      expect(
        await COMPTROLLER.checkMembership(module.address, ODETH_ADDRESS),
      ).to.equal(false);

      await signer.sendTransaction({
        to: WETH.address,
        value: parseEther("0.1"),
      });

      await WETH.transfer(module.address, parseEther("0.1"));

      // ===== Do leverage mint
      const mintTx = module.moduleD_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        ODETH_ADDRESS,
        WETH_ADDRESS,
        MODE.BOOST_POINTS,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );

      await expect(mintTx).to.changeTokenBalance(
        DETH,
        module.address,
        parseEther("0"),
      );

      almostEqual(
        await ODETH.balanceOf(module.address),
        parseEther("1249.999958011201242472"),
      );

      await expect(mintTx).to.emit(WRAPMINT_ETH, "MintFixedRate");

      expect(await module.underlying()).to.equal(WETH_ADDRESS);
      expect(await module.mode()).to.equal(1);
      expect(
        await COMPTROLLER.checkMembership(module.address, ODETH_ADDRESS),
      ).to.equal(true);

      // ===== Do leverage burn
      const burnTx = module.moduleD_withdrawBalanceTo(USER_ADDRESS);

      almostEqual(
        await WETH.balanceOf(USER_ADDRESS),
        parseEther("0.100000001012337307"),
      );

      expect(await ODETH.balanceOf(module.address)).to.equal(parseEther("0"));
    });

    it("Looped depositing WETH in variableRate", async function () {
      const { module, ODETH, DETH, COMPTROLLER, WETH, WRAPMINT_ETH, signer } =
        await loadFixture(fixtureDeployed);

      // Confirm Initial stage
      expect(
        await COMPTROLLER.checkMembership(module.address, ODETH_ADDRESS),
      ).to.equal(false);

      await signer.sendTransaction({
        to: WETH.address,
        value: parseEther("0.1"),
      });

      await WETH.transfer(module.address, parseEther("0.1"));

      // ===== Do leverage mint

      const mintTx = module.moduleD_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        ODETH_ADDRESS,
        WETH_ADDRESS,
        MODE.BOOST_YIELD,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );

      await expect(mintTx).to.changeTokenBalance(
        DETH,
        module.address,
        parseEther("0"),
      );

      almostEqual(
        await ODETH.balanceOf(module.address),
        parseEther("1249.999958011201242472"),
      );

      expect(await module.mode()).to.equal(2);
      await expect(mintTx).to.emit(WRAPMINT_ETH, "MintVariableRate");

      expect(await module.underlying()).to.equal(WETH_ADDRESS);
      expect(
        await COMPTROLLER.checkMembership(module.address, ODETH_ADDRESS),
      ).to.equal(true);

      // ===== Do leverage burn
      const burnTx = module.moduleD_withdrawBalanceTo(USER_ADDRESS);

      almostEqual(
        await WETH.balanceOf(USER_ADDRESS),
        parseEther("0.100000001012337307"),
      );

      expect(await ODETH.balanceOf(module.address)).to.equal(parseEther("0"));
    });

    it("Looped depositing ETH in variableRate", async function () {
      const { module, ODETH, DETH, COMPTROLLER, WRAPMINT_ETH, signer } =
        await loadFixture(fixtureDeployed);

      // Confirm Initial stage
      expect(
        await COMPTROLLER.checkMembership(module.address, ODETH_ADDRESS),
      ).to.equal(false);

      // ===== Do leverage mint
      const mintTx = module.moduleD_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        ODETH_ADDRESS,
        ETH_ADDRESS,
        MODE.BOOST_YIELD,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
        {
          value: parseEther("0.1"),
        },
      );

      await expect(mintTx).to.changeTokenBalance(
        DETH,
        module.address,
        parseEther("0"),
      );

      almostEqual(
        await ODETH.balanceOf(module.address),
        parseEther("1249.999958012369992399"),
      );

      await expect(mintTx).to.emit(WRAPMINT_ETH, "MintVariableRate");

      almostEqual(
        await module.borrowBalance(),
        parseEther("0.149999999000000000"),
      );
      almostEqual(
        await module.supplyBalance(),
        parseEther("0.249999998999999999"),
      );
      expect(await module.underlying()).to.equal(ETH_ADDRESS);
      expect(
        await COMPTROLLER.checkMembership(module.address, ODETH_ADDRESS),
      ).to.equal(true);

      // ===== Do leverage burn
      const eth = await signer.getBalance();
      const burnTx = module.moduleD_withdrawBalanceTo(USER_ADDRESS);

      const gas = await burnTx
        .then((tx) => tx.wait())
        .then((x) => x.cumulativeGasUsed.mul(x.effectiveGasPrice));

      almostEqual(
        (await signer.getBalance()).add(gas).sub(eth),
        parseEther("0.100000001012336174"),
      );

      expect(await ODETH.balanceOf(module.address)).to.equal(parseEther("0"));
      expect(await module.underlying()).to.equal(
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      );
    });
  });
});
