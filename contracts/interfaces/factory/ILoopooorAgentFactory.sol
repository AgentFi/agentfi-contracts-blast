// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { ILoopooorModuleD } from "./../modules/ILoopooorModuleD.sol";


/**
 * @title ILoopooorAgentFactory
 * @author AgentFi
 * @notice A factory for v3 strategy agents.
 *
 * Users can use [`createAgent()`](#createagent) to create a new agent. The agent will be created based on settings stored in the factory by the contract owner. These settings can be viewed via [`getAgentCreationSettings()`](#getagentcreationsettings).
 */
interface ILoopooorAgentFactory {

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

    struct MintParams {
        ILoopooorModuleD.MODE mode;
        address wrapMint;
        address exchange;
        address token;
        uint256 amountIn;
        uint256 amountOutMin;
        uint256 minLockedYield;
        bytes data;
    }

    struct TokenDeposit {
        address token;
        uint256 amount;
    }

    /**
     * @notice Creates a new Loopooor strategy agent.
     * The new agent will be minted to an existing root agent.
     * Can only be called by the owner of the root agent.
     * @param mintParams Parameters to use to mint the position.
     * @param deposit The token and amount to deposit.
     * @param rootAgentAddress The address of the root agent to transfer the v3 agent to.
     * @return strategyAgentID The ID of the newly created strategy agent.
     * @return strategyAddress The address of the newly created strategy agent.
     */
    function createLoopooorAgentForRoot(
        MintParams calldata mintParams,
        TokenDeposit calldata deposit,
        address rootAgentAddress
    ) external payable returns (
        uint256 strategyAgentID,
        address strategyAddress
    );

    /**
     * @notice Creates a new Loopooor strategy agent.
     * The new agent will be minted to a new explorer agent.
     * @param mintParams Parameters to use to mint the position.
     * @param deposit The token and amount to deposit.
     * @return strategyAgentID The ID of the newly created strategy agent.
     * @return strategyAddress The address of the newly created strategy agent.
     * @return explorerAgentID The ID of the newly created explorer agent.
     * @return explorerAddress The address of the newly created explorer agent.
     */
    function createLoopooorAgentAndExplorer(
        MintParams calldata mintParams,
        TokenDeposit calldata deposit
    ) external payable returns (
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
