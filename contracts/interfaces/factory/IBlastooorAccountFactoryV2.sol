// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IBlastooorAccountFactoryV2
 * @author AgentFi
 * @notice A factory for Agent accounts.
 *
 * Creates new agents for an existing collection. Loops over the supply and if an nft doesn't have an account, creates one.
 */
interface IBlastooorAccountFactoryV2 {

    /***************************************
    EVENTS
    ***************************************/

    /// @notice Emitted when a new AgentCreationSettings is posted.
    event AgentCreationSettingsPosted();

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Gets the agent creation settings.
     * @return agentNft The agents contract.
     * @return agentImplementation The agent implementation.
     * @return initializationCalls The calls to initialize the agent.
     */
    function getAgentCreationSettings() external view returns (
        address agentNft,
        address agentImplementation,
        bytes[] memory initializationCalls
    );

    /**
    * @notice Gets the ID of the last checked agent.
    * @return agentID The ID of the agent.
    */
    function lastCheckedAgentID() external view returns (uint256 agentID);

    /***************************************
    OWNER FUNCTIONS
    ***************************************/

    struct AgentCreationSettings {
        address agentImplementation;
        bytes[] initializationCalls;
    }

    /**
     * @notice Posts a new AgentCreationSettings.
     * Can only be called by the contract owner.
     * @param creationSettings The new creation settings to post.
     */
    function postAgentCreationSettings(
        AgentCreationSettings calldata creationSettings
    ) external payable;

    /**
     * @notice Creates new accounts.
     * Can only be called by the contract owner.
     */
    function createAccounts() external payable;
}
