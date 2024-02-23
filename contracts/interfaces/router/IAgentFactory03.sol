// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IAgentFactory03
 * @author AgentFi
 * @notice A factory for agents.
 *
 * Users can use [`createAgent()`](#createagent) to create a new agent. The agent will be created based on settings stored in the factory by the contract owner. These settings can be viewed via [`getAgentCreationSettings()`](#getagentcreationsettings).
 */
interface IAgentFactory03 {

    /***************************************
    EVENTS
    ***************************************/

    /// @notice Emitted when a new AgentCreationSettings is posted.
    event AgentCreationSettingsPosted(uint256 indexed creationSettingsID);
    /// @notice Emitted when a new AgentCreationSettings is paused or unpaused.
    event AgentCreationSettingsPaused(uint256 indexed creationSettingsID, bool isPaused);

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    struct AgentCreationSettings {
      address agentImplementation;
      bytes[] initializationCalls;
      bool isPaused;
    }

    /**
     * @notice Gets the number of agent creation settings.
     * @return count The count.
     */
    function getAgentCreationSettingsCount() external view returns (uint256 count);

    /**
     * @notice Gets the agent creation settings.
     * @return agentNft The Agents contract.
     * @return agentImplementation The agent implementation.
     * @return initializationCalls The calls to initialize the agent.
     * @return isPaused True if these creation settings are paused, false otherwise.
     */
    function getAgentCreationSettings(uint256 creationSettingsID) external view returns (
        address agentNft,
        address agentImplementation,
        bytes[] memory initializationCalls,
        bool isPaused
    );

    /***************************************
    CREATE AGENT FUNCTIONS
    ***************************************/

    struct TokenDeposit {
        address token;
        uint256 amount;
    }

    /**
     * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @return agentID The ID of the newly created agent.
     * @return agentAddress The address of the newly created agent.
     */
    function createAgent(uint256 creationSettingsID) external payable returns (uint256 agentID, address agentAddress);

    /**
     * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @return agentID The ID of the newly created agent.
     * @return agentAddress The address of the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, bytes[] calldata callDatas) external payable returns (uint256 agentID, address agentAddress);

    /**
     * @notice Creates a new agent.
     * @param receiver The address to mint the new agent to.
     * @return agentID The ID of the newly created agent.
     * @return agentAddress The address of the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, address receiver) external payable returns (uint256 agentID, address agentAddress);

    /**
     * @notice Creates a new agent.
     * @param receiver The address to mint the new agent to.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @return agentID The ID of the newly created agent.
     * @return agentAddress The address of the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, bytes[] calldata callDatas, address receiver) external payable returns (uint256 agentID, address agentAddress);

    /**
     * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @param deposits Tokens to transfer from `msg.sender` to the new agent.
     * @return agentID The ID of the newly created agent.
     * @return agentAddress The address of the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, TokenDeposit[] calldata deposits) external payable returns (uint256 agentID, address agentAddress);

    /**
     * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @param deposits Tokens to transfer from `msg.sender` to the new agent.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @return agentID The ID of the newly created agent.
     * @return agentAddress The address of the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, bytes[] calldata callDatas, TokenDeposit[] calldata deposits) external payable returns (uint256 agentID, address agentAddress);

    /**
     * @notice Creates a new agent.
     * @param receiver The address to mint the new agent to.
     * @param deposits Tokens to transfer from `msg.sender` to the new agent.
     * @return agentID The ID of the newly created agent.
     * @return agentAddress The address of the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, address receiver, TokenDeposit[] calldata deposits) external payable returns (uint256 agentID, address agentAddress);

    /**
     * @notice Creates a new agent.
     * @param receiver The address to mint the new agent to.
     * @param deposits Tokens to transfer from `msg.sender` to the new agent.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @return agentID The ID of the newly created agent.
     * @return agentAddress The address of the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, bytes[] calldata callDatas, address receiver, TokenDeposit[] calldata deposits) external payable returns (uint256 agentID, address agentAddress);

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
     * @notice Sets the pause state of the contract.
     * Allows or disallows creation of new agents.
     * Can only be called by the contract owner.
     * @param status True to pause, false to unpause.
     */
    function setPaused(uint256 creationSettingsID, bool status) external payable;
}
