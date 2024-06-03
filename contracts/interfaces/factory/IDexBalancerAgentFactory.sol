// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IDexBalancerAgentFactory
 * @author AgentFi
 * @notice A factory for dex balancer strategy agents.
 *
 * Agent operators can use one of the create methods to create a new agent. The agent will be created based on settings stored in the factory by the contract owner. These settings can be viewed via [`getAgentCreationSettings()`](#getagentcreationsettings).
 */
interface IDexBalancerAgentFactory {

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

    struct TokenDeposit {
        address token;
        uint256 amount;
    }

    /**
     * @notice Creates a new Dex Balancer strategy agent.
     * The new agent will be minted to an existing root agent.
     * Can only be called by the owner of the root agent.
     * @param deposit0 The first token and amount to deposit.
     * @param deposit1 The second token and amount to deposit.
     * @param rootAgentAddress The address of the root agent to transfer the dex balancer agent to.
     * @return strategyAgentID The ID of the newly created strategy agent.
     * @return strategyAddress The address of the newly created strategy agent.
     */
    function createDexBalancerAgentForRoot(
        TokenDeposit calldata deposit0,
        TokenDeposit calldata deposit1,
        address rootAgentAddress
    ) external payable returns (
        uint256 strategyAgentID,
        address strategyAddress
    );

    /**
     * @notice Creates a new Dex Balancer strategy agent.
     * The new agent will be minted to a new explorer agent.
     * @param deposit0 The first token and amount to deposit.
     * @param deposit1 The second token and amount to deposit.
     * @return strategyAgentID The ID of the newly created strategy agent.
     * @return strategyAddress The address of the newly created strategy agent.
     * @return explorerAgentID The ID of the newly created explorer agent.
     * @return explorerAddress The address of the newly created explorer agent.
     */
    function createDexBalancerAgentAndExplorer(
        TokenDeposit calldata deposit0,
        TokenDeposit calldata deposit1
    ) external payable returns (
        uint256 strategyAgentID,
        address strategyAddress,
        uint256 explorerAgentID,
        address explorerAddress
    );

    /**
     * @notice Creates a new Dex Balancer strategy agent.
     * The new agent will be minted to an existing root agent.
     * Can only be called by the owner of the root agent.
     * @param deposit0 The first token and amount to deposit.
     * @param deposit1 The second token and amount to deposit.
     * @param rootAgentAddress The address of the root agent to transfer the dex balancer agent to.
     * @param receiver The receiver of excess funds.
     * @return strategyAgentID The ID of the newly created strategy agent.
     * @return strategyAddress The address of the newly created strategy agent.
     */
    function createDexBalancerAgentForRootAndRefundExcess(
        TokenDeposit calldata deposit0,
        TokenDeposit calldata deposit1,
        address rootAgentAddress,
        address receiver
    ) external payable returns (
        uint256 strategyAgentID,
        address strategyAddress
    );

    /**
     * @notice Creates a new Dex Balancer strategy agent.
     * The new agent will be minted to a new explorer agent.
     * @param deposit0 The first token and amount to deposit.
     * @param deposit1 The second token and amount to deposit.
     * @param receiver The receiver of excess funds.
     * @return strategyAgentID The ID of the newly created strategy agent.
     * @return strategyAddress The address of the newly created strategy agent.
     * @return explorerAgentID The ID of the newly created explorer agent.
     * @return explorerAddress The address of the newly created explorer agent.
     */
    function createDexBalancerAgentAndExplorerAndRefundExcess(
        TokenDeposit calldata deposit0,
        TokenDeposit calldata deposit1,
        address receiver
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
