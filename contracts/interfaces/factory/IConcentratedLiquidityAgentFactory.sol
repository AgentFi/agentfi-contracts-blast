// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IConcentratedLiquidityAgentFactory
 * @author AgentFi
 * @notice A factory for v3 strategy agents.
 *
 * Users can use [`createAgent()`](#createagent) to create a new agent. The agent will be created based on settings stored in the factory by the contract owner. These settings can be viewed via [`getAgentCreationSettings()`](#getagentcreationsettings).
 */
interface IConcentratedLiquidityAgentFactory {

    /***************************************
    EVENTS
    ***************************************/

    /// @notice Emitted when a new AgentCreationSettings is posted.
    event AgentCreationSettingsPosted();

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Gets the addresses that have been statically set.
     */
    function getStaticAddresses() external view returns (
        address erc6551Registry_,
        address agentRegistry_,
        address genesisAgentNft_,
        address strategyAgentNft_,
        address explorerAgentNft_,
        address weth_
    );

    /**
     * @notice Gets the agent creation settings.
     */
    function getAgentCreationSettings() external view returns (
        address strategyAccountImpl_,
        address explorerAccountImpl_,
        bytes memory strategyInitializationCall_,
        bytes memory explorerInitializationCall_,
        bool isActive_
    );

    /***************************************
    CREATE AGENT FUNCTIONS
    ***************************************/

    struct MintBalanceParams {
        address manager;
        address pool;
        uint24 slippageLiquidity;
        int24 tickLower;
        int24 tickUpper;
        uint160 sqrtPriceX96;
    }

    struct TokenDeposit {
        address token;
        uint256 amount;
    }

    /**
     * @notice Creates a new V3 strategy agent.
     * The new agent will be minted to an existing root agent.
     * Can only be called by the owner of the root agent.
     * @param mintParams Parameters to use to mint the position.
     * @param deposit0 The first token and amount to deposit.
     * @param deposit1 The second token and amount to deposit.
     * @param rootAgentAddress The address of the root agent to transfer the v3 agent to.
     * @return nonfungiblePositionTokenId The ID of the concentrated liquidity position.
     * @return liquidity The amount of liquidity minted
     * @return amount0 The amount of token 0 used.
     * @return amount1 The amount of token 1 used.
     * @return strategyAgentID The ID of the newly created strategy agent.
     * @return strategyAddress The address of the newly created strategy agent.
     */
    function createConcentratedLiquidityAgentForRoot(
        MintBalanceParams calldata mintParams,
        TokenDeposit calldata deposit0,
        TokenDeposit calldata deposit1,
        address rootAgentAddress
    ) external payable returns (
        uint256 nonfungiblePositionTokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1,
        uint256 strategyAgentID,
        address strategyAddress
    );

    /**
     * @notice Creates a new V3 strategy agent.
     * The new agent will be minted to a new explorer agent.
     * @param mintParams Parameters to use to mint the position.
     * @param deposit0 The first token and amount to deposit.
     * @param deposit1 The second token and amount to deposit.
     * @return nonfungiblePositionTokenId The ID of the concentrated liquidity position.
     * @return liquidity The amount of liquidity minted
     * @return amount0 The amount of token 0 used.
     * @return amount1 The amount of token 1 used.
     * @return strategyAgentID The ID of the newly created strategy agent.
     * @return strategyAddress The address of the newly created strategy agent.
     * @return explorerAgentID The ID of the newly created explorer agent.
     * @return explorerAddress The address of the newly created explorer agent.
     */
    function createConcentratedLiquidityAgentAndExplorer(
        MintBalanceParams calldata mintParams,
        TokenDeposit calldata deposit0,
        TokenDeposit calldata deposit1
    ) external payable returns (
        uint256 nonfungiblePositionTokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1,
        uint256 strategyAgentID,
        address strategyAddress,
        uint256 explorerAgentID,
        address explorerAddress
    );

    /***************************************
    OWNER FUNCTIONS
    ***************************************/

    struct AgentCreationSettings {
        address strategyAccountImpl;
        address explorerAccountImpl;
        bytes strategyInitializationCall;
        bytes explorerInitializationCall;
        bool isActive;
    }

    /**
     * @notice Posts a new AgentCreationSettings.
     * Can only be called by the contract owner.
     */
    function postAgentCreationSettings(
        AgentCreationSettings calldata creationSettings
    ) external payable;
}
