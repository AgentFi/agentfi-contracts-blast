// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IBlastooorAccountFactory
 * @author AgentFi
 * @notice A factory for Agent accounts.
 */
interface IBlastooorAccountFactory {

    /***************************************
    EVENTS
    ***************************************/

    /// @notice Emitted when a new AgentCreationSettings is posted.
    event AgentCreationSettingsPosted(uint256 indexed creationSettingsID);
    /// @notice Emitted when a new AgentCreationSettings is activated or deactivated.
    event AgentCreationSettingsActivated(uint256 indexed creationSettingsID, bool isActive);
    /// @notice Emitted when the maxCreationsPerAgent is set.
    event SetMaxCreationsPerAgent(uint256 count);

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
     * @return agentNft The agents contract.
     * @return agentImplementation The agent implementation.
     * @return initializationCalls The calls to initialize the agent.
     * @return isActive True if these creation settings are active, false otherwise.
     */
    function getAgentCreationSettings(uint256 creationSettingsID) external view returns (
        address agentNft,
        address agentImplementation,
        bytes[] memory initializationCalls,
        bool isActive
    );

    /**
    * @notice Gets the number of agents created by the user.
    * @return count The count.
    */
    function getCreateCount(uint256 agentID) external view returns (uint256 count);

    /**
    * @notice Gets the maximum number of strategy agents that can be created per genesis agent.
    * @return count The count.
    */
    function maxCreationsPerAgent() external view returns (uint256 count);

    /***************************************
    CREATE AGENT FUNCTIONS
    ***************************************/

    /**
     * @notice Creates a new account for an agent.
     * Can only be called by the owner of the agent.
     * @param agentID The ID of the agent to create an account for.
     * @param creationSettingsID The creation settings to use.
     * @return account The address of the newly created account.
     */
    function createAccount(uint256 agentID, uint256 creationSettingsID) external payable returns (address account);

    /**
     * @notice Creates a new account for an agent.
     * Can only be called by the owner of the agent.
     * @param agentID The ID of the agent to create an account for.
     * @param creationSettingsID The creation settings to use.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @return account The address of the newly created account.
     */
    function createAccount(uint256 agentID, uint256 creationSettingsID, bytes[] calldata callDatas) external payable returns (address account);

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
    function setMaxCreationsPerAgent(uint256 count) external payable;
}
