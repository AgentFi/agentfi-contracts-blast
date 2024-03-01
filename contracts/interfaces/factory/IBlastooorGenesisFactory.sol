// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IBlastooorGenesisAgents
 * @author AgentFi
 * @notice A factory for agents.
 *
 * Users can use [`createAgent()`](#createagent) to create a new agent. The agent will be created based on settings stored in the factory by the contract owner. These settings can be viewed via [`getAgentCreationSettings()`](#getagentcreationsettings).
 */
interface IBlastooorGenesisFactory {

    /***************************************
    EVENTS
    ***************************************/

    /// @notice Emitted when a AgentCreationSettings is posted.
    event AgentCreationSettingsPosted();
    /// @notice Emitted when a new Agent is created.
    event AgentCreated(uint256 indexed agentID, bool fromAllowlist);

    /// @notice Emitted when a claim signer is added.
    event SignerAdded(address indexed signer);
    /// @notice Emitted when a claim signer is removed.
    event SignerRemoved(address indexed signer);

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    struct AgentCreationSettings {
        address agentImplementation;
        bytes[] initializationCalls;
        bool isActive;
        address paymentToken;
        uint256 paymentAmount;
        address paymentReceiver;
        uint256 mintStartTime;
        uint256 allowlistStopTime;
    }

    /**
     * @notice Gets the agent creation settings.
     * @return agentNft The Agents contract.
     * @return agentImplementation The agent implementation.
     * @return initializationCalls The calls to initialize the agent.
     * @return isActive True if these creation settings are active, false otherwise.
     * @return paymentToken The address of the token to pay with.
     * @return paymentAmount The amount of the token to pay.
     * @return paymentReceiver The receiver of the payment.
     */
    function getAgentCreationSettings() external view returns (
        address agentNft,
        address agentImplementation,
        bytes[] memory initializationCalls,
        bool isActive,
        address paymentToken,
        uint256 paymentAmount,
        address paymentReceiver,
        uint256 mintStartTime,
        uint256 allowlistStopTime
    );

    /***************************************
    CREATE AGENT FUNCTIONS
    ***************************************/

    struct AgentInfo {
        uint256 agentID;
        address agentAddress;
    }

    /***************************************
    OWNER FUNCTIONS
    ***************************************/


}
