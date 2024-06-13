// /* global describe it before ethers */

import hre from "hardhat";
import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
const { ethers } = hre;
const { provider } = ethers;
const { parseEther } = ethers.utils;
const { AddressZero, WeiPerEther } = ethers.constants;
import chai from "chai";
const { expect } = chai;

import {
  AgentRegistry,
  BlastooorAccountFactory,
  BlastooorGenesisAgentAccount,
  BlastooorGenesisFactory,
  BlastooorStrategyAgents,
  BlastooorStrategyFactory,
  LoopooorModuleF,
} from "../typechain-types";

import { deployContract } from "../scripts/utils/deployContract";
import { toBytes32 } from "../scripts/utils/setStorage";
import { calcSighash } from "../scripts/utils/diamond";
import { BlastooorGenesisAgents } from "../typechain-types/contracts/tokens/BlastooorGenesisAgents";
import { almostEqual } from "../scripts/utils/test";
import { moduleFFunctionParams as functionParams } from "../scripts/configuration/LoopooorModuleF";

/* prettier-ignore */ const BLAST_ADDRESS                 = "0x4300000000000000000000000000000000000002";
/* prettier-ignore */ const BLAST_POINTS_ADDRESS          = "0x2fc95838c71e76ec69ff817983BFf17c710F34E0";
/* prettier-ignore */ const BLAST_POINTS_OPERATOR_ADDRESS = "0x454c0C1CF7be9341d82ce0F16979B8689ED4AAD0";
/* prettier-ignore */ const DETH_ADDRESS                  = "0x1Da40C742F32bBEe81694051c0eE07485fC630f6";
/* prettier-ignore */ const DUSD_ADDRESS                  = "0x1A3D9B2fa5c6522c8c071dC07125cE55dF90b253";
/* prettier-ignore */ const ENTRY_POINT_ADDRESS           = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
/* prettier-ignore */ const ERC6551_REGISTRY_ADDRESS      = "0x000000006551c19487814612e58FE06813775758";
/* prettier-ignore */ const ETH_ADDRESS                   = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
/* prettier-ignore */ const USDB_ADDRESS                  = "0x4300000000000000000000000000000000000003";
/* prettier-ignore */ const WETH_ADDRESS                  = "0x4300000000000000000000000000000000000004";
/* prettier-ignore */ const WRAPMINT_ETH_ADDRESS          = "0xD89dcC88AcFC6EF78Ef9602c2Bf006f0026695eF";
/* prettier-ignore */ const WRAPMINT_USDB_ADDRESS         = "0xf2050acF080EE59300E3C0782B87f54FDf312525";
/* prettier-ignore */ const aDETH_ADDRESS                 = "0x97257A7c033773d54dFe83bFcdce056af8321ae2";
/* prettier-ignore */ const aDUSD_ADDRESS                 = "0x3B51C9b48Bdf91c7267B63ec663E64E9580E7Bdf";
/* prettier-ignore */ const vDETH_ADDRESS                 = "0x109195c9a8DD285b549f8963bcF80EAaE370927F";
/* prettier-ignore */ const vDUSD_ADDRESS                 = "0xf967757e4a0bc2bbe798f95fdb9049dab12b6913";
/* prettier-ignore */ const vUSDB_ADDRESS                 = "0x325261d7bD4BDa7bAF38d08217793e94B19C8fC7";
/* prettier-ignore */ const vWETH_ADDRESS                 = "0x7cB8a894b163848bccee03fD71b098693eE7a77D";

/* prettier-ignore */ const OWNER_ADDRESS                 = "0xA214a4fc09C42202C404E2976c50373fE5F5B789";
/* prettier-ignore */ const USER_ADDRESS                  = "0x3E0770C75c0D5aFb1CfA3506d4b0CaB11770a27a";

enum MODE {
  DIRECT = 0,
  BOOST_POINTS = 1,
  BOOST_YIELD = 2,
}
const permissions = Object.entries({
  // Public
  [toBytes32(0)]: [
    "_quoteBalanceWithRevert()",
    "aToken()",
    "borrow()",
    "borrowBalance()",
    "duoAsset()",
    "leverage()",
    "mode()",
    "moduleName()",
    "oracle()",
    "pool()",
    "poolWrapper()",
    "quoteBalance()",
    "rateContracts()",
    "strategyType()",
    "supplyBalance()",
    "underlying()",
    "variableDebtToken()",
    "wrapMint()",
  ],

  // AgentFi + Owner
  //[toBytes32(9)]: [],
  // none

  // Owner Only:
  [toBytes32(1)]: [
    "moduleF_borrowERC20(address,uint256,uint256)",
    "moduleF_burnFixedRate(address,address,uint256)",
    "moduleF_burnVariableRate(address,address,uint256,uint256)",
    "moduleF_depositBalance(address,address,address,uint8,uint256)",
    "moduleF_increaseWithBalance()",
    "moduleF_mintFixedRate(address,address,address,uint256,uint256,uint256,bytes)",
    "moduleF_mintFixedRateEth(address,address,uint256,uint256,uint256,bytes)",
    "moduleF_mintVariableRate(address,address,address,uint256,uint256,bytes)",
    "moduleF_mintVariableRateEth(address,address,uint256,uint256,bytes)",
    "moduleF_partialWithdrawTo(address,uint256)",
    "moduleF_repayERC20(address,uint256,uint256,address)",
    "moduleF_sendAmountTo(address,address,uint256)",
    "moduleF_sendBalanceTo(address,address)",
    "moduleF_supplyERC20(address,uint256,address)",
    "moduleF_withdrawBalance()",
    "moduleF_withdrawBalanceTo(address)",
    "moduleF_withdrawERC20(address,uint256,address)",
  ],
}).reduce(
  (acc, [requiredRole, functions]) => {
    functions.forEach((func) => {
      acc.push({ selector: calcSighash(func, false), requiredRole });
    });

    return acc;
  },
  [] as { selector: string; requiredRole: string }[],
);

expect(functionParams).to.deep.equal(permissions);

export async function fixtureSetup(moduleName: "LoopooorModuleF") {
  const [deployer] = await ethers.getSigners();
  const blockNumber = 4646000;
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
  let genesisAgentAddress = "0xa32Cc434f2bf12515A401d5f2c1413B798092584";

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
  const strategyAgentAddress = "0xF80a57CEeFc19079af81628B2C7e8081b7344Faa";

  expect(
    await agentRegistry
      .getTbasOfNft(strategyAgentNft.address, strategyAgentID)
      .then((r) => r[0][0]),
  ).to.equal(strategyAgentAddress);

  const agent = (await ethers.getContractAt(
    moduleName,
    strategyAgentAddress,
    signer,
  )) as LoopooorModuleF;

  const strategyAgent = await ethers.getContractAt(
    "BlastooorStrategyAgentAccountV2",
    strategyAgentAddress,
    signer,
  );

  // ===== Setup user

  // ===== Load already deployed contracts
  const USDB = await ethers.getContractAt("MockERC20", USDB_ADDRESS, signer);
  const WETH = await ethers.getContractAt("MockERC20", WETH_ADDRESS, signer);

  return {
    USDB,
    WETH,
    module: agent,
    agent,
    signer,
    strategyAgent,
    owner,
    genesisAgent,
  };
}

describe("LoopoorModuleF", function () {
  async function fixtureDeployed() {
    const fixture = await fixtureSetup("LoopooorModuleF");
    const { signer } = fixture;

    const DETH = await ethers.getContractAt("MockERC20", DETH_ADDRESS, signer);
    const DUSD = await ethers.getContractAt("MockERC20", DUSD_ADDRESS, signer);

    const WRAPMINT_ETH = await ethers.getContractAt(
      "IWrapMintV2",
      WRAPMINT_ETH_ADDRESS,
    );
    const WRAPMINT_USDB = await ethers.getContractAt(
      "IWrapMintV2",
      WRAPMINT_USDB_ADDRESS,
    );

    const [aDETH, aDUSD, vDETH, vDUSD, vUSDB, vWETH] = await Promise.all(
      [
        aDETH_ADDRESS,
        aDUSD_ADDRESS,
        vDETH_ADDRESS,
        vDUSD_ADDRESS,
        vUSDB_ADDRESS,
        vWETH_ADDRESS,
      ].map((address) => ethers.getContractAt("MockERC20", address, signer)),
    );

    return {
      ...fixture,
      DETH,
      DUSD,
      WRAPMINT_ETH,
      WRAPMINT_USDB,
      aDETH,
      aDUSD,
      vDETH,
      vDUSD,
      vUSDB,
      vWETH,
    };
  }
  describe("USDB Configuration", () => {
    it("View uninitialized state", async function () {
      const { module } = await loadFixture(fixtureDeployed);
      expect(await module.strategyType()).to.equal("Loopooor");
      expect(await module.moduleName()).to.equal("LoopooorModuleF");

      expect(await module.mode()).to.equal(parseEther("0"));
      expect(await module.borrowBalance()).to.equal(parseEther("0"));
      expect(await module.supplyBalance()).to.equal(parseEther("0"));
      expect(await module.leverage()).to.equal(parseEther("0"));

      expect(
        await Promise.all([
          module.poolWrapper(),
          module.pool(),
          module.oracle(),
          module.duoAsset(),
          module.underlying(),
          module.wrapMint(),
        ]),
      ).to.deep.equal([
        "0xfDe98aB7a6602ad55462297D952CE25b58743140",
        "0xd2499b3c8611E36ca89A70Fda2A72C49eE19eAa8",
        "0xAf77325317F109ee21459AFeEDE51b16C231e6b1",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
      ]);
    });

    it("Can set state after deposit", async function () {
      const { module, USDB } = await loadFixture(fixtureDeployed);

      await USDB.transfer(module.address, parseEther("100"));
      await module.moduleF_depositBalance(
        WRAPMINT_USDB_ADDRESS,
        USDB_ADDRESS,
        USDB_ADDRESS,
        MODE.BOOST_POINTS,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );

      almostEqual(await module.borrowBalance(), parseEther("149.9"));
      almostEqual(await module.supplyBalance(), parseEther("249.9"));
      almostEqual(await module.leverage(), parseEther("2.499"));
      almostEqual(await module.callStatic.quoteBalance(), parseEther("100"));

      await Promise.all([
        expect(module.mode()).to.eventually.equal(1),
        expect(module.borrow()).to.eventually.equal(USDB_ADDRESS),
        expect(module.wrapMint()).to.eventually.equal(WRAPMINT_USDB_ADDRESS),
        expect(module.duoAsset()).to.eventually.equal(DUSD_ADDRESS),
        expect(module.underlying()).to.eventually.equal(USDB_ADDRESS),
        expect(module.variableDebtToken()).to.eventually.equal(vUSDB_ADDRESS),
        expect(module.aToken()).to.eventually.equal(aDUSD_ADDRESS),
      ]);
    });

    it("Can mint fixedRate DUSD with USDB", async function () {
      const { module, USDB, DUSD, WRAPMINT_USDB } =
        await loadFixture(fixtureDeployed);

      await USDB.transfer(module.address, parseEther("200"));

      const mintTx = module.moduleF_mintFixedRate(
        WRAPMINT_USDB_ADDRESS,
        ethers.constants.AddressZero,
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
          "0xa2d46821Ab99d177E99bCD595EEfDEA50893a9cF",
          module.address,
          parseEther("200"),
          0,
        );
    });

    it("Can mint variableRate DUSD with USDB", async function () {
      const { module, USDB, DUSD, WRAPMINT_USDB } =
        await loadFixture(fixtureDeployed);

      await USDB.transfer(module.address, parseEther("2"));

      const mintTx = module.moduleF_mintVariableRate(
        WRAPMINT_USDB_ADDRESS,
        ethers.constants.AddressZero,
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
          "0xa2d46821Ab99d177E99bCD595EEfDEA50893a9cF",
          module.address,
          parseEther("2"),
        );
    });

    it("Can handle depositing DUSD, supplying DUSD and borrowing DUSD", async function () {
      const { vDUSD, module, DUSD, USDB, WRAPMINT_USDB, signer, aDUSD } =
        await loadFixture(fixtureDeployed);

      // Confirm Initial stage
      await USDB.approve(WRAPMINT_USDB_ADDRESS, parseEther("100"));

      await WRAPMINT_USDB.connect(signer).mintFixedRate(
        ethers.constants.AddressZero,
        USDB_ADDRESS,
        parseEther("100"),
        0,
        0,
        toBytes32(0),
      );

      await DUSD.transfer(module.address, parseEther("100"));

      // ===== Do leverage mint
      const mintTx = module.moduleF_depositBalance(
        WRAPMINT_USDB_ADDRESS,
        DUSD_ADDRESS,
        DUSD_ADDRESS,
        MODE.DIRECT,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );

      await expect(mintTx).to.changeTokenBalance(
        DUSD,
        module.address,
        parseEther("-100"),
      );

      almostEqual(
        await aDUSD.balanceOf(module.address),
        parseEther("249.900000000000000000"),
      );
      almostEqual(
        await vDUSD.balanceOf(module.address),
        parseEther("149.900000000000000001"),
      );

      // ===== Do leverage burn
      await module.moduleF_withdrawBalanceTo(USER_ADDRESS);

      almostEqual(
        await DUSD.balanceOf(USER_ADDRESS),
        parseEther("99.999999953036711437"),
      );

      expect(await aDUSD.balanceOf(module.address)).to.equal(parseEther("0"));
    });

    it("Can handle depositing USDB, supplying fixedRate DUSD and borrowing DUSD", async function () {
      const { module, aDUSD, USDB, WRAPMINT_USDB, vDUSD } =
        await loadFixture(fixtureDeployed);

      await USDB.transfer(module.address, parseEther("100"));

      // ===== Do leverage mint
      const mintTx = module.moduleF_depositBalance(
        WRAPMINT_USDB_ADDRESS,
        DUSD_ADDRESS,
        USDB_ADDRESS,
        MODE.BOOST_POINTS,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );

      await expect(mintTx).to.emit(WRAPMINT_USDB, "MintFixedRate");

      almostEqual(
        await aDUSD.balanceOf(module.address),
        parseEther("249.900000000000000000"),
      );
      almostEqual(
        await vDUSD.balanceOf(module.address),
        parseEther("149.900000000000000000"),
      );

      expect(await module.rateContracts()).to.deep.equal([
        "0xa2d46821Ab99d177E99bCD595EEfDEA50893a9cF",
      ]);

      // ===== Do leverage burn
      const usdb = await USDB.balanceOf(USER_ADDRESS);
      await module.moduleF_withdrawBalanceTo(USER_ADDRESS);

      almostEqual(
        (await USDB.balanceOf(USER_ADDRESS)).sub(usdb),
        parseEther("99.999530688585409877"),
      );

      expect(await aDUSD.balanceOf(module.address)).to.equal(parseEther("0"));

      expect(await module.rateContracts()).to.deep.equal([
        "0xa2d46821Ab99d177E99bCD595EEfDEA50893a9cF",
      ]);
    });

    it("Can handle depositing USDB, supplying variableRate DUSD and borrowing DUSD", async function () {
      const { module, aDUSD, DUSD, WRAPMINT_USDB, USDB, vDUSD } =
        await loadFixture(fixtureDeployed);

      // Confirm Initial stage
      await USDB.transfer(module.address, parseEther("100"));

      // ===== Do leverage mint
      const mintTx = module.moduleF_depositBalance(
        WRAPMINT_USDB_ADDRESS,
        DUSD_ADDRESS,
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
        await aDUSD.balanceOf(module.address),
        parseEther("249.900000000000000000"),
      );
      almostEqual(
        await vDUSD.balanceOf(module.address),
        parseEther("149.900000000000000000"),
      );

      await expect(mintTx).to.emit(WRAPMINT_USDB, "MintVariableRate");

      // ===== Do leverage burn
      const usdb = await USDB.balanceOf(USER_ADDRESS);
      await module.moduleF_withdrawBalanceTo(USER_ADDRESS);

      almostEqual(
        (await USDB.balanceOf(USER_ADDRESS)).sub(usdb),
        parseEther("100.008452576750142788"),
      );

      expect(await aDUSD.balanceOf(module.address)).to.equal(parseEther("0"));
    });

    it("Can handle depositing USDB, supplying fixedRate DUSD and borrowing USDB", async function () {
      const { module, aDUSD, USDB, WRAPMINT_USDB, vDUSD, DUSD, vUSDB } =
        await loadFixture(fixtureDeployed);

      await USDB.transfer(module.address, parseEther("100"));

      // ===== Do leverage mint
      const mintTx = module.moduleF_depositBalance(
        WRAPMINT_USDB_ADDRESS,
        USDB_ADDRESS,
        USDB_ADDRESS,
        MODE.BOOST_POINTS,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );

      await expect(mintTx).to.emit(WRAPMINT_USDB, "MintFixedRate");

      almostEqual(
        await aDUSD.balanceOf(module.address),
        parseEther("249.900000000000000000"),
      );
      almostEqual(
        await vUSDB.balanceOf(module.address),
        parseEther("149.9000000000000000000"),
      );

      expect(await module.rateContracts()).to.deep.equal([
        "0xa2d46821Ab99d177E99bCD595EEfDEA50893a9cF",
        "0x05C5b47002E8A6D30d83bd6bEE211c27C547d824",
        "0x0c3681e693317249FC2E3b4Fc2F76205D4e797b6",
        "0x5551cDd52FDcccd95038523F5A636D2eF41Ff21b",
        "0x92Bee80802580944cC6ba9F6DfdF1AACB2d8669F",
        "0x92A5B507EB7E76eB62b09dDFCD6ac5e04bE63388",
        "0x224e3edFC39867CCC4C018E3E06eE71Bd56ca502",
        "0xaa20a33da9F12aec969DF6aD4969C839E9Ff55Ec",
        "0xc8a08F42d359c2afbd6c02e1cb42DfAcddCC209E",
        "0xd69DbB23cE949209c880f398B7DF73C778Df7b61",
        "0xDa7b831a2519894CEabc2042eb3eB9DB5E106E95",
        "0x4111174C699F9518538d8D2E9B165005c812A6f9",
        "0x902b93504dB66616bC30f0c132A7287170792EbE",
        "0xF925695b6A1298fD08414F7CB99e0F3aac4cFD4c",
        "0x4B7c2D4D4E8f5F256CB0117853bddE533DAdE215",
        "0xAfa3e55381EBbB66947eA3c13B43012BA7fF12c8",
      ]);

      // ===== Do leverage burn
      await mine(100);
      const usdb = await USDB.balanceOf(USER_ADDRESS);
      await module.moduleF_withdrawBalanceTo(USER_ADDRESS);

      almostEqual(
        (await USDB.balanceOf(USER_ADDRESS)).sub(usdb),
        parseEther("99.999530688585409877"),
      );

      almostEqual(
        await DUSD.balanceOf(USER_ADDRESS),
        parseEther("0.000000082748474599"),
        0.01,
      );
      expect(await aDUSD.balanceOf(module.address)).to.equal(parseEther("0"));
      expect(await vUSDB.balanceOf(module.address)).to.equal(parseEther("0"));

      expect(await module.rateContracts()).to.deep.equal([]);
    });

    it("Can handle depositing USDB, supplying variableRate DUSD and borrowing USDB", async function () {
      const { module, aDUSD, USDB, WRAPMINT_USDB, DUSD, vUSDB } =
        await loadFixture(fixtureDeployed);

      await USDB.transfer(module.address, parseEther("100"));

      // ===== Do leverage mint
      const mintTx = module.moduleF_depositBalance(
        WRAPMINT_USDB_ADDRESS,
        USDB_ADDRESS,
        USDB_ADDRESS,
        MODE.BOOST_YIELD,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );

      await expect(mintTx).to.emit(WRAPMINT_USDB, "MintVariableRate");

      almostEqual(
        await aDUSD.balanceOf(module.address),
        parseEther("249.900000000000000000"),
      );
      almostEqual(
        await vUSDB.balanceOf(module.address),
        parseEther("149.9000000000000000000"),
      );

      expect(await module.rateContracts()).to.deep.equal([
        "0xa2d46821Ab99d177E99bCD595EEfDEA50893a9cF",
        "0x05C5b47002E8A6D30d83bd6bEE211c27C547d824",
        "0x0c3681e693317249FC2E3b4Fc2F76205D4e797b6",
        "0x5551cDd52FDcccd95038523F5A636D2eF41Ff21b",
        "0x92Bee80802580944cC6ba9F6DfdF1AACB2d8669F",
        "0x92A5B507EB7E76eB62b09dDFCD6ac5e04bE63388",
        "0x224e3edFC39867CCC4C018E3E06eE71Bd56ca502",
        "0xaa20a33da9F12aec969DF6aD4969C839E9Ff55Ec",
        "0xc8a08F42d359c2afbd6c02e1cb42DfAcddCC209E",
        "0xd69DbB23cE949209c880f398B7DF73C778Df7b61",
        "0xDa7b831a2519894CEabc2042eb3eB9DB5E106E95",
        "0x4111174C699F9518538d8D2E9B165005c812A6f9",
        "0x902b93504dB66616bC30f0c132A7287170792EbE",
        "0xF925695b6A1298fD08414F7CB99e0F3aac4cFD4c",
        "0x4B7c2D4D4E8f5F256CB0117853bddE533DAdE215",
        "0xAfa3e55381EBbB66947eA3c13B43012BA7fF12c8",
      ]);

      // ===== Do leverage burn
      await mine(100);
      const usdb = await USDB.balanceOf(USER_ADDRESS);
      await module.moduleF_withdrawBalanceTo(USER_ADDRESS);

      almostEqual(
        (await USDB.balanceOf(USER_ADDRESS)).sub(usdb),
        parseEther("99.999530688585409877"),
      );

      almostEqual(
        await DUSD.balanceOf(USER_ADDRESS),
        parseEther("0.000000081945091350"),
        0.01,
      );

      expect(await aDUSD.balanceOf(module.address)).to.equal(parseEther("0"));
      expect(await vUSDB.balanceOf(module.address)).to.equal(parseEther("0"));
      expect(await module.rateContracts()).to.deep.equal([]);
    });
  });

  describe("ETH Configuration", () => {
    it("Can set state after deposit", async function () {
      const { module } = await loadFixture(fixtureDeployed);

      await module.moduleF_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        WETH_ADDRESS,
        ETH_ADDRESS,
        MODE.BOOST_YIELD,
        parseEther("2"), // 2.5 is max based on 60% LTV
        {
          value: parseEther("0.1"),
        },
      );

      almostEqual(await module.borrowBalance(), parseEther("0.1"));
      almostEqual(await module.supplyBalance(), parseEther("0.2"));
      almostEqual(await module.leverage(), parseEther("2"));
      almostEqual(await module.callStatic.quoteBalance(), parseEther("0.1"));

      await Promise.all([
        expect(module.mode()).to.eventually.equal(2),
        expect(module.borrow()).to.eventually.equal(WETH_ADDRESS),
        expect(module.wrapMint()).to.eventually.equal(WRAPMINT_ETH_ADDRESS),
        expect(module.duoAsset()).to.eventually.equal(DETH_ADDRESS),
        expect(module.underlying()).to.eventually.equal(ETH_ADDRESS),
        expect(module.variableDebtToken()).to.eventually.equal(vWETH_ADDRESS),
        expect(module.aToken()).to.eventually.equal(aDETH_ADDRESS),
      ]);
    });

    // Takes too long to run, causes out of memory issue
    it.skip("Can revert on too high leverage", async function () {
      const { module } = await loadFixture(fixtureDeployed);
      await expect(
        module.moduleF_depositBalance(
          WRAPMINT_ETH_ADDRESS,
          WETH_ADDRESS,
          ETH_ADDRESS,
          MODE.BOOST_YIELD,
          parseEther("10.00"), // 2.5 is max based on 60% LTV
          {
            value: parseEther("0.1"),
          },
        ),
      ).to.be.reverted;
    });

    it("Can handle second call to deposit with existing deposit in DETH", async function () {
      const { module, vDETH, aDETH, DETH, WRAPMINT_ETH, signer } =
        await loadFixture(fixtureDeployed);

      // Mint DETH
      await WRAPMINT_ETH.connect(signer).mintFixedRateEth(
        ethers.constants.AddressZero,
        parseEther("0.2"),
        0,
        0,
        toBytes32(0),
        {
          value: parseEther("0.2"),
        },
      );

      // ===== Do First deposit
      await DETH.transfer(module.address, parseEther("0.1"));
      await module.moduleF_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        DETH_ADDRESS,
        DETH_ADDRESS,
        MODE.DIRECT,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );
      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.2499"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0.1499"));

      // ===== Do Second deposit
      await DETH.transfer(module.address, parseEther("0.1"));
      await module.moduleF_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        DETH_ADDRESS,
        DETH_ADDRESS,
        MODE.DIRECT,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );
      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.4998"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0.2998"));
    });

    it("Can handle second call to deposit with existing deposit in ETH", async function () {
      const { module, aDETH, vDETH, vWETH } =
        await loadFixture(fixtureDeployed);
      await module.moduleF_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        DETH_ADDRESS,
        ETH_ADDRESS,
        MODE.BOOST_YIELD,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
        {
          value: parseEther("0.1"),
        },
      );
      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.2499"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0.1499"));

      await module.moduleF_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        WETH_ADDRESS,
        ETH_ADDRESS,
        MODE.BOOST_POINTS,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
        {
          value: parseEther("0.1"),
        },
      );

      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.4998"));
      almostEqual(await vWETH.balanceOf(module.address), parseEther("0.2998"));
    });

    it("Can handle increasing deposit", async function () {
      const { module, aDETH, vDETH } = await loadFixture(fixtureDeployed);
      await module.moduleF_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        DETH_ADDRESS,
        ETH_ADDRESS,
        MODE.BOOST_YIELD,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
        {
          value: parseEther("0.1"),
        },
      );
      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.2499"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0.1499"));

      await module.moduleF_increaseWithBalance({ value: parseEther("0.1") });

      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.4998"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0.2998"));
    });

    it("Can partially withdrawal WETH", async function () {
      const { module, aDETH, vDETH, WETH, signer } =
        await loadFixture(fixtureDeployed);

      await signer.sendTransaction({
        to: WETH.address,
        value: parseEther("0.1"),
      });

      await WETH.transfer(module.address, parseEther("0.1"));

      // ===== Do leverage mint
      await module.moduleF_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        DETH_ADDRESS,
        WETH_ADDRESS,
        MODE.BOOST_POINTS,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );

      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.2499"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0.1499"));

      await module.moduleF_partialWithdrawTo(USER_ADDRESS, parseEther("0.05"));

      almostEqual(await WETH.balanceOf(USER_ADDRESS), parseEther("0.05"));
      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.12495"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0.07495"));
    });

    it("Can partially withdrawal ETH", async function () {
      const { module, aDETH, vDETH, WETH, signer } =
        await loadFixture(fixtureDeployed);

      // ===== Do leverage mint
      await module.moduleF_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        DETH_ADDRESS,
        ETH_ADDRESS,
        MODE.BOOST_POINTS,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
        { value: parseEther("0.1") },
      );

      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.2499"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0.1499"));

      const eth = await signer.getBalance();
      const partialWithdrawTx = module.moduleF_partialWithdrawTo(
        USER_ADDRESS,
        parseEther("0.05"),
      );
      const gas = await partialWithdrawTx
        .then((tx) => tx.wait())
        .then((x) => x.cumulativeGasUsed.mul(x.effectiveGasPrice));

      almostEqual(
        (await signer.getBalance()).add(gas).sub(eth),
        parseEther("0.05"),
      );

      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.12495"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0.07495"));
    });

    it("Can mint fixedRate DETH with WETH", async function () {
      const { module, DETH, WETH, signer, WRAPMINT_ETH } =
        await loadFixture(fixtureDeployed);

      await signer.sendTransaction({
        to: WETH.address,
        value: parseEther("0.2"),
      });

      await WETH.transfer(module.address, parseEther("0.2"));

      const mintTx = module.moduleF_mintFixedRate(
        WRAPMINT_ETH_ADDRESS,
        ethers.constants.AddressZero,
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
          "0x4AFf696d502883e4b05351C9E48B4775D906D93C",
          module.address,
          parseEther("0.2"),
          0,
        );
    });

    it("Can mint fixed rate DETH with ETH", async function () {
      const { module, DETH, WRAPMINT_ETH } = await loadFixture(fixtureDeployed);

      const mintTx = module.moduleF_mintFixedRateEth(
        WRAPMINT_ETH_ADDRESS,
        ethers.constants.AddressZero,
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
          "0x4AFf696d502883e4b05351C9E48B4775D906D93C",
          module.address,
          parseEther("0.2"),
          0,
        );
    });

    it("Can mint variableRate DETH with ETH", async function () {
      const { module, DETH, WRAPMINT_ETH } = await loadFixture(fixtureDeployed);
      const mintTx = module.moduleF_mintVariableRateEth(
        WRAPMINT_ETH_ADDRESS,
        ethers.constants.AddressZero,
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
          "0x4AFf696d502883e4b05351C9E48B4775D906D93C",
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

      const mintTx = module.moduleF_mintVariableRate(
        WRAPMINT_ETH_ADDRESS,
        ethers.constants.AddressZero,
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
          "0x4AFf696d502883e4b05351C9E48B4775D906D93C",
          module.address,
          parseEther("0.2"),
        );
    });

    it("Can handle depositing DETH, supply DWETH and borrowing DWETH", async function () {
      const { module, DETH, WRAPMINT_ETH, signer, aDETH, vDETH } =
        await loadFixture(fixtureDeployed);

      // Mint DETH
      await WRAPMINT_ETH.connect(signer).mintFixedRateEth(
        ethers.constants.AddressZero,
        parseEther("0.1"),
        0,
        0,
        toBytes32(0),
        {
          value: parseEther("0.1"),
        },
      );

      await DETH.transfer(module.address, parseEther("0.1"));

      // ===== Do leverage mint
      const mintTx = module.moduleF_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        DETH_ADDRESS,
        DETH_ADDRESS,
        MODE.DIRECT,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );

      await expect(mintTx).to.changeTokenBalance(
        DETH,
        module.address,
        parseEther("-0.1"),
      );

      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.2499"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0.1499"));

      // ===== Do leverage burn
      await module.moduleF_withdrawBalanceTo(USER_ADDRESS);

      almostEqual(
        await DETH.balanceOf(USER_ADDRESS),
        parseEther("0.100000001012337307"),
      );

      almostEqual(await aDETH.balanceOf(module.address), parseEther("0"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0"));
    });

    it("Can handle depositing WETH, supplying DETH in fixedRate and borrowing DETH", async function () {
      const { module, WETH, WRAPMINT_ETH, signer, aDETH, vDETH, DETH } =
        await loadFixture(fixtureDeployed);

      await signer.sendTransaction({
        to: WETH.address,
        value: parseEther("0.1"),
      });

      await WETH.transfer(module.address, parseEther("0.1"));

      // ===== Do leverage mint
      const mintTx = module.moduleF_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        DETH_ADDRESS,
        WETH_ADDRESS,
        MODE.BOOST_POINTS,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );

      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.2499"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0.1499"));

      await expect(mintTx).to.emit(WRAPMINT_ETH, "MintFixedRate");

      almostEqual(await module.leverage(), parseEther("2.499"));
      expect(await module.rateContracts()).to.deep.equal([
        "0x4AFf696d502883e4b05351C9E48B4775D906D93C",
      ]);

      await mine(100);
      // ===== Do leverage burn
      await module.moduleF_withdrawBalanceTo(USER_ADDRESS);

      almostEqual(
        await WETH.balanceOf(USER_ADDRESS),
        parseEther("0.099999857741142425"),
      );
      almostEqual(await DETH.balanceOf(USER_ADDRESS), parseEther("0"));

      expect(await aDETH.balanceOf(module.address)).to.equal(parseEther("0"));
      expect(await vDETH.balanceOf(module.address)).to.equal(parseEther("0"));
    });

    it("Can handle depositing WETH, supplying DETH in variableRate and borrowing DETH", async function () {
      const { module, WETH, WRAPMINT_ETH, signer, aDETH, vDETH, DETH } =
        await loadFixture(fixtureDeployed);

      await signer.sendTransaction({
        to: WETH.address,
        value: parseEther("0.1"),
      });

      await WETH.transfer(module.address, parseEther("0.1"));

      // ===== Do leverage mint
      const mintTx = module.moduleF_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        DETH_ADDRESS,
        WETH_ADDRESS,
        MODE.BOOST_YIELD,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );

      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.2499"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0.1499"));

      await expect(mintTx).to.emit(WRAPMINT_ETH, "MintVariableRate");

      almostEqual(await module.leverage(), parseEther("2.499"));
      expect(await module.rateContracts()).to.deep.equal([
        "0x4AFf696d502883e4b05351C9E48B4775D906D93C",
      ]);

      await mine(100);
      // ===== Do leverage burn
      await module.moduleF_withdrawBalanceTo(USER_ADDRESS);

      almostEqual(
        await WETH.balanceOf(USER_ADDRESS),
        parseEther("0.099999857741142425"),
      );
      almostEqual(await DETH.balanceOf(USER_ADDRESS), parseEther("0"));

      expect(await aDETH.balanceOf(module.address)).to.equal(parseEther("0"));
      expect(await vDETH.balanceOf(module.address)).to.equal(parseEther("0"));
    });

    it("Can handle depositing WETH, supplying DETH in fixedRate and borrowing WETH", async function () {
      const { module, WETH, WRAPMINT_ETH, signer, aDETH, vDETH, vWETH, DETH } =
        await loadFixture(fixtureDeployed);

      await signer.sendTransaction({
        to: WETH.address,
        value: parseEther("0.1"),
      });

      await WETH.transfer(module.address, parseEther("0.1"));

      // ===== Do leverage mint
      const mintTx = module.moduleF_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        WETH_ADDRESS,
        WETH_ADDRESS,
        MODE.BOOST_POINTS,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );

      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.2499"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0"));
      almostEqual(await vWETH.balanceOf(module.address), parseEther("0.1499"));

      await expect(mintTx).to.emit(WRAPMINT_ETH, "MintFixedRate");

      expect(await module.rateContracts()).to.deep.equal([
        "0x4AFf696d502883e4b05351C9E48B4775D906D93C",
        "0x6bBb2E5Cac0E3c6649EDbAd398F581ca8c75CD4d",
        "0xC16Cf637d29A6229B6E42c0fea662CAdA5892c49",
        "0xBF9E875d84F6563F2542A376dFC3516a3d8191eb",
        "0x5f87B7F103dA58d2508Ef8DdfEf8543288B861CF",
        "0xb0e4135da95E8884d2465415B2590ef5641f411B",
        "0x6c146BC5543124D526419Cd9d79CBE9405160fEC",
        "0x6E832da37FE86292c370D4eb84d58712d6Cd8cbf",
        "0x2851f41511D841eE216D3Ee90cd706AdC599b81c",
        "0x8343193944Ce04eAd90Db0dDb59624a142A41558",
        "0xD0B33c8A4f0AEbD5db86b1144A644db9FCD198DE",
        "0x97C1E2Ac54db669bE546CcDE0D35265cBb99987f",
        "0x94ed6fcf2d1d5232E0DC35ed96b55BC6B49bd218",
        "0x7880040E8A19DCd01488d7Ec04E13d47D72Eb5Ae",
        "0x23de2c58367A166d39B267c1561e5E506D05EE71",
        "0x37dE31683883ddD18Feb5a3A8Add217Ee649c057",
      ]);

      await mine(100);
      // ===== Do leverage burn
      await module.moduleF_withdrawBalanceTo(USER_ADDRESS);

      almostEqual(
        await WETH.balanceOf(USER_ADDRESS),
        parseEther("0.099999857741142425"),
      );
      almostEqual(
        await DETH.balanceOf(USER_ADDRESS),
        parseEther("0.000000000012770426"),
        0.01,
      );

      expect(await aDETH.balanceOf(module.address)).to.equal(parseEther("0"));
      expect(await vDETH.balanceOf(module.address)).to.equal(parseEther("0"));
      expect(await vWETH.balanceOf(module.address)).to.equal(parseEther("0"));
    });

    it("Can handle depositing WETH, supplying DETH in variableRate and borrowing WETH", async function () {
      const { module, WETH, WRAPMINT_ETH, signer, aDETH, vDETH, vWETH, DETH } =
        await loadFixture(fixtureDeployed);

      await signer.sendTransaction({
        to: WETH.address,
        value: parseEther("0.1"),
      });

      await WETH.transfer(module.address, parseEther("0.1"));

      // ===== Do leverage mint
      const mintTx = module.moduleF_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        WETH_ADDRESS,
        WETH_ADDRESS,
        MODE.BOOST_YIELD,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
      );

      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.2499"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0"));
      almostEqual(await vWETH.balanceOf(module.address), parseEther("0.1499"));

      await expect(mintTx).to.emit(WRAPMINT_ETH, "MintVariableRate");

      expect(await module.rateContracts()).to.deep.equal([
        "0x4AFf696d502883e4b05351C9E48B4775D906D93C",
        "0x6bBb2E5Cac0E3c6649EDbAd398F581ca8c75CD4d",
        "0xC16Cf637d29A6229B6E42c0fea662CAdA5892c49",
        "0xBF9E875d84F6563F2542A376dFC3516a3d8191eb",
        "0x5f87B7F103dA58d2508Ef8DdfEf8543288B861CF",
        "0xb0e4135da95E8884d2465415B2590ef5641f411B",
        "0x6c146BC5543124D526419Cd9d79CBE9405160fEC",
        "0x6E832da37FE86292c370D4eb84d58712d6Cd8cbf",
        "0x2851f41511D841eE216D3Ee90cd706AdC599b81c",
        "0x8343193944Ce04eAd90Db0dDb59624a142A41558",
        "0xD0B33c8A4f0AEbD5db86b1144A644db9FCD198DE",
        "0x97C1E2Ac54db669bE546CcDE0D35265cBb99987f",
        "0x94ed6fcf2d1d5232E0DC35ed96b55BC6B49bd218",
        "0x7880040E8A19DCd01488d7Ec04E13d47D72Eb5Ae",
        "0x23de2c58367A166d39B267c1561e5E506D05EE71",
        "0x37dE31683883ddD18Feb5a3A8Add217Ee649c057",
      ]);

      await mine(100);
      // ===== Do leverage burn
      await module.moduleF_withdrawBalanceTo(USER_ADDRESS);

      almostEqual(
        await WETH.balanceOf(USER_ADDRESS),
        parseEther("0.099999857741142425"),
      );
      almostEqual(
        await DETH.balanceOf(USER_ADDRESS),
        parseEther("0.000000000012770426"),
        0.01,
      );

      expect(await aDETH.balanceOf(module.address)).to.equal(parseEther("0"));
      expect(await vDETH.balanceOf(module.address)).to.equal(parseEther("0"));
      expect(await vWETH.balanceOf(module.address)).to.equal(parseEther("0"));
    });

    it("Can handle depositing ETH, supplying DETH in fixedRate and borrowing DETH", async function () {
      const { module, WRAPMINT_ETH, signer, aDETH, vDETH, DETH } =
        await loadFixture(fixtureDeployed);

      // ===== Do leverage mint
      const mintTx = module.moduleF_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        DETH_ADDRESS,
        ETH_ADDRESS,
        MODE.BOOST_POINTS,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
        {
          value: parseEther("0.1"),
        },
      );

      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.2499"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0.1499"));

      await expect(mintTx).to.emit(WRAPMINT_ETH, "MintFixedRate");

      almostEqual(await module.leverage(), parseEther("2.499"));
      expect(await module.rateContracts()).to.deep.equal([
        "0x4AFf696d502883e4b05351C9E48B4775D906D93C",
      ]);

      await mine(100);
      // ===== Do leverage burn
      const eth = await signer.getBalance();
      const burnTx = module.moduleF_withdrawBalanceTo(USER_ADDRESS);
      const gas = await burnTx
        .then((tx) => tx.wait())
        .then((x) => x.cumulativeGasUsed.mul(x.effectiveGasPrice));

      almostEqual(
        (await signer.getBalance()).add(gas).sub(eth),
        parseEther("0.099999857741142425"),
      );
      almostEqual(await DETH.balanceOf(USER_ADDRESS), parseEther("0"));

      expect(await aDETH.balanceOf(module.address)).to.equal(parseEther("0"));
      expect(await vDETH.balanceOf(module.address)).to.equal(parseEther("0"));
    });
    it("Can handle depositing ETH, supplying DETH in variableRate and borrowing DETH", async function () {
      const { module, WRAPMINT_ETH, signer, aDETH, vDETH, DETH } =
        await loadFixture(fixtureDeployed);

      // ===== Do leverage mint
      const mintTx = module.moduleF_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        DETH_ADDRESS,
        ETH_ADDRESS,
        MODE.BOOST_YIELD,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
        {
          value: parseEther("0.1"),
        },
      );

      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.2499"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0.1499"));

      await expect(mintTx).to.emit(WRAPMINT_ETH, "MintVariableRate");

      almostEqual(await module.leverage(), parseEther("2.499"));
      expect(await module.rateContracts()).to.deep.equal([
        "0x4AFf696d502883e4b05351C9E48B4775D906D93C",
      ]);

      await mine(100);
      // ===== Do leverage burn
      const eth = await signer.getBalance();
      const burnTx = module.moduleF_withdrawBalanceTo(USER_ADDRESS);
      const gas = await burnTx
        .then((tx) => tx.wait())
        .then((x) => x.cumulativeGasUsed.mul(x.effectiveGasPrice));

      almostEqual(
        (await signer.getBalance()).add(gas).sub(eth),
        parseEther("0.099999857741142425"),
      );
      almostEqual(await DETH.balanceOf(USER_ADDRESS), parseEther("0"));

      expect(await aDETH.balanceOf(module.address)).to.equal(parseEther("0"));
      expect(await vDETH.balanceOf(module.address)).to.equal(parseEther("0"));
    });

    it("Can handle depositing ETH, supplying DETH in fixedRate and borrowing WETH", async function () {
      const { module, WRAPMINT_ETH, signer, aDETH, vDETH, vWETH, DETH } =
        await loadFixture(fixtureDeployed);

      // ===== Do leverage mint
      const mintTx = module.moduleF_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        WETH_ADDRESS,
        ETH_ADDRESS,
        MODE.BOOST_POINTS,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
        {
          value: parseEther("0.1"),
        },
      );

      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.2499"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0"));
      almostEqual(await vWETH.balanceOf(module.address), parseEther("0.1499"));

      await expect(mintTx).to.emit(WRAPMINT_ETH, "MintFixedRate");

      expect(await module.rateContracts()).to.deep.equal([
        "0x4AFf696d502883e4b05351C9E48B4775D906D93C",
        "0x6bBb2E5Cac0E3c6649EDbAd398F581ca8c75CD4d",
        "0xC16Cf637d29A6229B6E42c0fea662CAdA5892c49",
        "0xBF9E875d84F6563F2542A376dFC3516a3d8191eb",
        "0x5f87B7F103dA58d2508Ef8DdfEf8543288B861CF",
        "0xb0e4135da95E8884d2465415B2590ef5641f411B",
        "0x6c146BC5543124D526419Cd9d79CBE9405160fEC",
        "0x6E832da37FE86292c370D4eb84d58712d6Cd8cbf",
        "0x2851f41511D841eE216D3Ee90cd706AdC599b81c",
        "0x8343193944Ce04eAd90Db0dDb59624a142A41558",
        "0xD0B33c8A4f0AEbD5db86b1144A644db9FCD198DE",
        "0x97C1E2Ac54db669bE546CcDE0D35265cBb99987f",
        "0x94ed6fcf2d1d5232E0DC35ed96b55BC6B49bd218",
        "0x7880040E8A19DCd01488d7Ec04E13d47D72Eb5Ae",
        "0x23de2c58367A166d39B267c1561e5E506D05EE71",
        "0x37dE31683883ddD18Feb5a3A8Add217Ee649c057",
      ]);

      await mine(100);
      // ===== Do leverage burn
      const eth = await signer.getBalance();
      const burnTx = module.moduleF_withdrawBalanceTo(USER_ADDRESS);
      const gas = await burnTx
        .then((tx) => tx.wait())
        .then((x) => x.cumulativeGasUsed.mul(x.effectiveGasPrice));

      almostEqual(
        (await signer.getBalance()).add(gas).sub(eth),
        parseEther("0.099999857741142425"),
      );
      almostEqual(
        await DETH.balanceOf(USER_ADDRESS),
        parseEther("0.000000000012770428"),
        0.01,
      );

      expect(await aDETH.balanceOf(module.address)).to.equal(parseEther("0"));
      expect(await vDETH.balanceOf(module.address)).to.equal(parseEther("0"));
      expect(await vWETH.balanceOf(module.address)).to.equal(parseEther("0"));
    });

    it("Can handle depositing ETH, supplying DETH in variableRate and borrowing WETH", async function () {
      const { module, WRAPMINT_ETH, signer, aDETH, vDETH, vWETH, DETH } =
        await loadFixture(fixtureDeployed);

      // ===== Do leverage mint
      const mintTx = await module.moduleF_depositBalance(
        WRAPMINT_ETH_ADDRESS,
        WETH_ADDRESS,
        ETH_ADDRESS,
        MODE.BOOST_YIELD,
        parseEther("2.499"), // 2.5 is max based on 60% LTV
        {
          value: parseEther("0.1"),
        },
      );

      await expect(mintTx).to.emit(WRAPMINT_ETH, "MintVariableRate");

      almostEqual(await aDETH.balanceOf(module.address), parseEther("0.2499"));
      almostEqual(await vDETH.balanceOf(module.address), parseEther("0"));
      almostEqual(await vWETH.balanceOf(module.address), parseEther("0.1499"));

      expect(await module.rateContracts()).to.deep.equal([
        "0x4AFf696d502883e4b05351C9E48B4775D906D93C",
        "0x6bBb2E5Cac0E3c6649EDbAd398F581ca8c75CD4d",
        "0xC16Cf637d29A6229B6E42c0fea662CAdA5892c49",
        "0xBF9E875d84F6563F2542A376dFC3516a3d8191eb",
        "0x5f87B7F103dA58d2508Ef8DdfEf8543288B861CF",
        "0xb0e4135da95E8884d2465415B2590ef5641f411B",
        "0x6c146BC5543124D526419Cd9d79CBE9405160fEC",
        "0x6E832da37FE86292c370D4eb84d58712d6Cd8cbf",
        "0x2851f41511D841eE216D3Ee90cd706AdC599b81c",
        "0x8343193944Ce04eAd90Db0dDb59624a142A41558",
        "0xD0B33c8A4f0AEbD5db86b1144A644db9FCD198DE",
        "0x97C1E2Ac54db669bE546CcDE0D35265cBb99987f",
        "0x94ed6fcf2d1d5232E0DC35ed96b55BC6B49bd218",
        "0x7880040E8A19DCd01488d7Ec04E13d47D72Eb5Ae",
        "0x23de2c58367A166d39B267c1561e5E506D05EE71",
        "0x37dE31683883ddD18Feb5a3A8Add217Ee649c057",
      ]);

      await mine(100);
      // ===== Do leverage burn
      const eth = await signer.getBalance();
      const burnTx = module.moduleF_withdrawBalanceTo(USER_ADDRESS);
      const gas = await burnTx
        .then((tx) => tx.wait())
        .then((x) => x.cumulativeGasUsed.mul(x.effectiveGasPrice));

      almostEqual(
        (await signer.getBalance()).add(gas).sub(eth),
        parseEther("0.099999857741142425"),
      );
      almostEqual(
        await DETH.balanceOf(USER_ADDRESS),
        parseEther("0.000000000012645229"),
        0.01,
      );

      expect(await aDETH.balanceOf(module.address)).to.equal(parseEther("0"));
      expect(await vDETH.balanceOf(module.address)).to.equal(parseEther("0"));
      expect(await vWETH.balanceOf(module.address)).to.equal(parseEther("0"));
    });
  });
});
