// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Multicall } from "./../utils/Multicall.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IAgents } from "./../interfaces/tokens/IAgents.sol";
import { IAgentFactory01 } from "./../interfaces/router/IAgentFactory01.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { Ownable2Step } from "./../utils/Ownable2Step.sol";


/**
 * @title AgentFactory01
 * @author AgentFi
 * @notice A factory for agents.
 *
 * Users can use [`createAgent()`](#createagent) to create a new agent. The agent will be created based on settings stored in the factory by the contract owner. These settings can be viewed via [`getAgentCreationSettings()`](#getagentcreationsettings).
 */
contract AgentFactory01 is Multicall, Blastable, Ownable2Step, IAgentFactory01 {

    /***************************************
    STATE VARIABLES
    ***************************************/

    address internal _agentNft;

    mapping(uint256 => AgentCreationSettings) internal _agentCreationSettings;

    uint256 internal _agentCreationSettingsCount;

    /**
     * @notice Constructs the factory contract.
     * @param owner_ The owner of the contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param governor_ The address of the gas governor.
     * @param agentNft The Agents contract.
     */
    constructor(
        address owner_,
        address blast_,
        address governor_,
        address agentNft
    ) Blastable(blast_, governor_) {
        _transferOwnership(owner_);
        _agentNft = agentNft;
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Gets the number of agent creation settings.
     * @return count The count.
     */
    function getAgentCreationSettingsCount() external view override returns (uint256 count) {
        return _agentCreationSettingsCount;
    }

    /**
     * @notice Gets the agent creation settings.
     * @return agentNft The Agents contract.
     * @return agentImplementation The agent implementation.
     * @return initializationCalls The calls to initialize the agent.
     * @return isPaused True if these creation settings are paused, false otherwise.
     */
    function getAgentCreationSettings(uint256 creationSettingsID) external view override returns (
        address agentNft,
        address agentImplementation,
        bytes[] memory initializationCalls,
        bool isPaused
    ) {
        if(creationSettingsID == 0 || creationSettingsID > _agentCreationSettingsCount) revert Errors.OutOfRange();
        agentNft = _agentNft;
        AgentCreationSettings memory creationSettings = _agentCreationSettings[creationSettingsID];
        agentImplementation = creationSettings.agentImplementation;
        initializationCalls = creationSettings.initializationCalls;
        isPaused = creationSettings.isPaused;
    }

    /***************************************
    CREATE AGENT FUNCTIONS
    ***************************************/

    /**
     * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @return agentID The ID of the newly created agent.
     * @return agentAddress The address of the newly created agent.
     */
    function createAgent(uint256 creationSettingsID) external payable override returns (uint256 agentID, address agentAddress) {
        IAgents agentNft = IAgents(_agentNft);
        (agentID, agentAddress) = _createAgent(agentNft, creationSettingsID);
        _optionalSendToAgent(agentAddress);
        agentNft.transferFrom(address(this), msg.sender, agentID);
    }

    /**
     * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @return agentID The ID of the newly created agent.
     * @return agentAddress The address of the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, bytes[] calldata callDatas) external payable override returns (uint256 agentID, address agentAddress) {
        IAgents agentNft = IAgents(_agentNft);
        (agentID, agentAddress) = _createAgent(agentNft, creationSettingsID);
        _multicallAgent(agentAddress, callDatas);
        _optionalSendToAgent(agentAddress);
        agentNft.transferFrom(address(this), msg.sender, agentID);
    }

    /**
     * @notice Creates a new agent.
     * @param receiver The address to mint the new agent to.
     * @return agentID The ID of the newly created agent.
     * @return agentAddress The address of the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, address receiver) external payable override returns (uint256 agentID, address agentAddress) {
        IAgents agentNft = IAgents(_agentNft);
        (agentID, agentAddress) = _createAgent(agentNft, creationSettingsID);
        _optionalSendToAgent(agentAddress);
        agentNft.transferFrom(address(this), receiver, agentID);
    }

    /**
     * @notice Creates a new agent.
     * @param receiver The address to mint the new agent to.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @return agentID The ID of the newly created agent.
     * @return agentAddress The address of the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, bytes[] calldata callDatas, address receiver) external payable override returns (uint256 agentID, address agentAddress) {
        IAgents agentNft = IAgents(_agentNft);
        (agentID, agentAddress) = _createAgent(agentNft, creationSettingsID);
        _multicallAgent(agentAddress, callDatas);
        _optionalSendToAgent(agentAddress);
        agentNft.transferFrom(address(this), receiver, agentID);
    }

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
    ) external payable override onlyOwner returns (
        uint256 creationSettingsID
    ) {
        // checks
        Calls.verifyHasCode(creationSettings.agentImplementation);
        // post
        creationSettingsID = ++_agentCreationSettingsCount;
        _agentCreationSettings[creationSettingsID] = creationSettings;
        emit AgentCreationSettingsPosted(creationSettingsID);
        emit AgentCreationSettingsPaused(creationSettingsID, creationSettings.isPaused);
    }

    /**
     * @notice Sets the pause state of the contract.
     * Allows or disallows creation of new agents.
     * Can only be called by the contract owner.
     * @param status True to pause, false to unpause.
     */
    function setPaused(uint256 creationSettingsID, bool status) external payable override onlyOwner {
        // checks
        if(creationSettingsID == 0 || creationSettingsID > _agentCreationSettingsCount) revert Errors.OutOfRange();
        // set
        _agentCreationSettings[creationSettingsID].isPaused = status;
        emit AgentCreationSettingsPaused(creationSettingsID, status);
    }

    /***************************************
    HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Creates a new agent.
     * @param agentNft The agent nft contract.
     * @return agentID The ID of the newly created agent.
     * @return agentAddress The address of the newly created agent.
     */
    function _createAgent(
        IAgents agentNft,
        uint256 creationSettingsID
    ) internal returns (uint256 agentID, address agentAddress) {
        // checks
        if(creationSettingsID == 0 || creationSettingsID > _agentCreationSettingsCount) revert Errors.OutOfRange();
        AgentCreationSettings memory creationSettings = _agentCreationSettings[creationSettingsID];
        if(creationSettings.isPaused) revert Errors.CreationSettingsPaused();
        // create agent
        (agentID, agentAddress) = agentNft.createAgent(creationSettings.agentImplementation);
        // initialize
        for(uint256 i = 0; i < creationSettings.initializationCalls.length; ++i) {
            _callAgent(agentAddress, creationSettings.initializationCalls[i]);
        }
    }

    /**
     * @notice Calls an agent.
     * @param agentAddress The address of the agent.
     * @param callData The data to pass to the agent.
     */
    function _callAgent(address agentAddress, bytes memory callData) internal {
        uint256 balance = address(this).balance;
        Calls.functionCallWithValue(agentAddress, callData, balance);
    }

    /**
     * @notice Calls an agent multiple times.
     * @param agentAddress The address of the agent.
     * @param callDatas The data to pass to the agent.
     */
    function _multicallAgent(address agentAddress, bytes[] calldata callDatas) internal {
        for(uint256 i = 0; i < callDatas.length; ++i) {
            _callAgent(agentAddress, callDatas[i]);
        }
    }

    /**
     * @notice Sends any contract balance to the agent.
     * @param agentAddress The address of the agent.
     */
    function _optionalSendToAgent(address agentAddress) internal {
        uint256 balance = address(this).balance;
        if(balance > 0) {
            Calls.sendValue(agentAddress, balance);
        }
    }
}
