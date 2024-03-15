// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IBlastooorStrategyFactory
 * @author AgentFi
 * @notice A factory for strategy agents.
 *
 * Users can use [`createAgent()`](#createagent) to create a new agent. The agent will be created based on settings stored in the factory by the contract owner. These settings can be viewed via [`getAgentCreationSettings()`](#getagentcreationsettings).
 */
interface IBlastooorStrategyFactory {

    /***************************************
    EVENTS
    ***************************************/

    /// @notice Emitted when a new AgentCreationSettings is posted.
    event AgentCreationSettingsPosted(uint256 indexed creationSettingsID);
    /// @notice Emitted when a new AgentCreationSettings is activated or deactivated.
    event AgentCreationSettingsActivated(uint256 indexed creationSettingsID, bool isActive);
    /// @notice Emitted when the maxCreationsPerGenesisAgent is set.
    event SetMaxCreationsPerGenesisAgent(uint256 count);

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    struct AgentCreationSettings {
        address agentImplementation;
        bytes[] initializationCalls;
        bool isActive;
    }

    /**
     * @notice Gets the number of agent creation settings.
     * @return count The count.
     */
    function getAgentCreationSettingsCount() external view returns (uint256 count);

    /**
     * @notice Gets the agent creation settings.
     * @return genesisAgentNft The genesis agents contract.
     * @return strategyAgentNft The strategy agents contract.
     * @return agentImplementation The agent implementation.
     * @return initializationCalls The calls to initialize the agent.
     * @return isActive True if these creation settings are active, false otherwise.
     */
    function getAgentCreationSettings(uint256 creationSettingsID) external view returns (
        address genesisAgentNft,
        address strategyAgentNft,
        address agentImplementation,
        bytes[] memory initializationCalls,
        bool isActive
    );

    /**
    * @notice Gets the number of agents created by the user.
    * @return count The count.
    */
    function getCreateCount(address user) external view returns (uint256 count);

    /**
    * @notice Gets the maximum number of strategy agents that can be created per genesis agent.
    * @return count The count.
    */
    function maxCreationsPerGenesisAgent() external view returns (uint256 count);

    /***************************************
    CREATE AGENT FUNCTIONS
    ***************************************/

    struct TokenDeposit {
        address token;
        uint256 amount;
    }

    struct AgentInfo {
        uint256 agentID;
        address agentAddress;
    }

    /**
     * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @param creationSettingsID The creation settings to use.
     * @return info Information about the newly created agent.
     */
    function createAgent(uint256 creationSettingsID) external payable returns (AgentInfo memory info);

    /**
     * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @param creationSettingsID The creation settings to use.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @return info Information about the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, bytes[] calldata callDatas) external payable returns (AgentInfo memory info);

    /**
    * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @param creationSettingsID The creation settings to use.
     * @param deposits Tokens to transfer from `msg.sender` to the new agent.
     * @return info Information about the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, TokenDeposit[] calldata deposits) external payable returns (AgentInfo memory info);

    /**
     * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @param creationSettingsID The creation settings to use.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @param deposits Tokens to transfer from `msg.sender` to the new agent.
     * @return info Information about the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, bytes[] calldata callDatas, TokenDeposit[] calldata deposits) external payable returns (AgentInfo memory info);

    /**
     * @notice Creates multiple new agents.
     * The new agents will be transferred to `msg.sender`.
     * @param creationSettingsID The creation settings to use.
     * @param count The number of agents to create.
     * @return info Information about the newly created agents.
     */
    function createAgents(uint256 creationSettingsID, uint256 count) external payable returns (AgentInfo[] memory info);

    /**
     * @notice Creates multiple new agents.
     * The new agents will be transferred to `msg.sender`.
     * @param creationSettingsID The creation settings to use.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @param count The number of agents to create.
     * @return info Information about the newly created agents.
     */
    function createAgents(uint256 creationSettingsID, bytes[] calldata callDatas, uint256 count) external payable returns (AgentInfo[] memory info);

    /**
     * @notice Creates multiple new agents.
     * The new agents will be transferred to `msg.sender`.
     * @param creationSettingsID The creation settings to use.
     * @param deposits Tokens to transfer from `msg.sender` to the new agents.
     * @param count The number of agents to create.
     * @return info Information about the newly created agents.
     */
    function createAgents(uint256 creationSettingsID, TokenDeposit[] calldata deposits, uint256 count) external payable returns (AgentInfo[] memory info);

    /**
     * @notice Creates multiple new agents.
     * The new agents will be transferred to `msg.sender`.
     * @param creationSettingsID The creation settings to use.
     * @param deposits Tokens to transfer from `msg.sender` to the new agents.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @param count The number of agents to create.
     * @return info Information about the newly created agents.
     */
    function createAgents(uint256 creationSettingsID, bytes[] calldata callDatas, TokenDeposit[] calldata deposits, uint256 count) external payable returns (AgentInfo[] memory info);

    /***************************************
    OWNER FUNCTIONS
    ***************************************/

    /**
     * @notice Posts a new AgentCreationSettings.
     * Can only be called by the contract owner.
     * @param creationSettings The new creation settings to post.
     */
    function postAgentCreationSettings(
        AgentCreationSettings calldata creationSettings
    ) external payable returns (
        uint256 creationSettingsID
    );

    /**
     * @notice Sets the active state of a creationSettings.
     * Can only be called by the contract owner.
     * @param status True to activate, false to deactivate.
     */
    function setActiveStatus(uint256 creationSettingsID, bool status) external payable;

    /**
    * @notice Sets the maximum number of strategy agents that can be created per genesis agent.
    * Can only be called by the contract owner.
    * @param count The count to set.
    */
    function setMaxCreationsPerGenesisAgent(uint256 count) external payable;
}
