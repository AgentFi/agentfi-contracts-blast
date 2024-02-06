// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Multicall } from "@openzeppelin/contracts/utils/Multicall.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { Calls } from "./../utils/Calls.sol";
import "./../utils/Errors.sol";
import { LmaoAgentNft } from "./LmaoAgentNft.sol";


/**
 * @title LmaoAgentFactory
 * @author LMAO Labs
 * @notice A factory for LMAO agents.
 *
 * Users can use [`createAgent()`](#createagent) to create a new agent. The agent will be created based on settings stored in the factory by the contract owner. These settings can be viewed via [`getAgentCreationSettings()`](#getagentcreationsettings).
 */
contract LmaoAgentFactory is Multicall, Ownable2Step {

    /***************************************
    EVENTS
    ***************************************/

    /// @notice Emitted when the agent implementation is set.
    event AgentImplementationSet(address indexed agentImplementation);
    /// @notice Emitted when the agent initialization code is set.
    event AgentInitializationCodeSet(bytes agentInitializationCode1, bytes agentInitializationCode2);
    /// @notice Emitted when the pause state is set.
    event PauseSet(bool status);

    address internal _agentNft;
    address internal _agentImplementation;
    bytes internal _agentInitializationCode1;
    bytes internal _agentInitializationCode2;
    bool internal _isPaused;

    /**
     * @notice Constructs the factory contract.
     * @param owner_ The contract owner.
     * @param agentNft The LmaoAgents contract.
     * @param agentImplementation The agent implementation.
     * @param agentInitializationCode1 The first part of the agent initialization code.
     * @param agentInitializationCode2 The second part of the agent initialization code.
     */
    constructor(
        address owner_,
        address agentNft,
        address agentImplementation,
        bytes memory agentInitializationCode1,
        bytes memory agentInitializationCode2
    ) Ownable(owner_) {
        _agentNft = agentNft;
        _setAgentImplementationAddress(agentImplementation);
        _setAgentInitializationCode(agentInitializationCode1, agentInitializationCode2);
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Gets the agent creation settings.
     * @return agentNft The LmaoAgents contract.
     * @return agentImplementation The agent implementation.
     * @return agentInitializationCode1 The first part of the agent initialization code.
     * @return agentInitializationCode2 The second part of the agent initialization code.
     */
    function getAgentCreationSettings() external view returns (
        address agentNft,
        address agentImplementation,
        bytes memory agentInitializationCode1,
        bytes memory agentInitializationCode2
    ) {
        agentNft = _agentNft;
        agentImplementation = _agentImplementation;
        agentInitializationCode1 = _agentInitializationCode1;
        agentInitializationCode2 = _agentInitializationCode2;
    }

    /**
     * @notice Returns true if creation of new agents via this factory is paused.
     * @return isPaused_ True if creation is paused, false otherwise.
     */
    function isPaused() external view returns (bool isPaused_) {
        return _isPaused;
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
    function createAgent() external payable returns (uint256 agentID, address agentAddress) {
        LmaoAgentNft agentNft = LmaoAgentNft(_agentNft);
        (agentID, agentAddress) = _createAgent(agentNft);
        agentNft.transferFrom(address(this), msg.sender, agentID);
    }

    /**
     * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @param callData Extra data to pass to the agent after it is created.
     * @return agentID The ID of the newly created agent.
     * @return agentAddress The address of the newly created agent.
     */
    function createAgent(bytes calldata callData) external payable returns (uint256 agentID, address agentAddress) {
        LmaoAgentNft agentNft = LmaoAgentNft(_agentNft);
        (agentID, agentAddress) = _createAgent(agentNft);
        _callAgent(agentAddress, callData);
        agentNft.transferFrom(address(this), msg.sender, agentID);
    }

    /***************************************
    OWNER FUNCTIONS
    ***************************************/

    /**
     * @notice Sets the agent implementation.
     * Can only be called by the contract owner.
     * @param agentImplementation The address of the agent implementation.
     */
    function setAgentImplementationAddress(address agentImplementation) external payable onlyOwner {
        _setAgentImplementationAddress(agentImplementation);
    }

    /**
     * @notice Sets the agent initialization code.
     * Can only be called by the contract owner.
     * @param agentInitializationCode1 The first part of the agent initialization code.
     * @param agentInitializationCode2 The second part of the agent initialization code.
     */
    function setAgentInitializationCode(bytes memory agentInitializationCode1, bytes memory agentInitializationCode2) external payable onlyOwner {
        _setAgentInitializationCode(agentInitializationCode1, agentInitializationCode2);
    }

    /**
     * @notice Sets the pause state of the contract.
     * Allows or disallows creation of new agents.
     * Can only be called by the contract owner.
     * @param status True to pause, false to unpause.
     */
    function setPaused(bool status) external payable onlyOwner {
        _isPaused = status;
        emit PauseSet(status);
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
    function _createAgent(LmaoAgentNft agentNft) internal returns (uint256 agentID, address agentAddress) {
        if(_isPaused) revert ContractPaused();
        (agentID, agentAddress) = agentNft.createAgent(_agentImplementation);
        _callAgent(agentAddress, _agentInitializationCode1);
        _callAgent(agentAddress, _agentInitializationCode2);
    }

    /**
     * @notice Calls a agent.
     * @param agentAddress The address of the agent.
     * @param callData The data to pass to the agent.
     */
    function _callAgent(address agentAddress, bytes memory callData) internal {
        if(callData.length == 0) return;
        Calls.functionCall(agentAddress, callData);
    }

    /**
     * @notice Sets the agent implementation.
     * @param agentImplementation The address of the agent implementation.
     */
    function _setAgentImplementationAddress(address agentImplementation) internal {
        uint256 contractSize;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            contractSize := extcodesize(agentImplementation)
        }
        if(contractSize == 0) revert NotAContract();
        _agentImplementation = agentImplementation;
        emit AgentImplementationSet(agentImplementation);
    }

    /**
     * @notice Sets the agent initialization code.
     * Can only be called by the contract owner.
     * @param agentInitializationCode1 The first part of the agent initialization code.
     * @param agentInitializationCode2 The second part of the agent initialization code.
     */
    function _setAgentInitializationCode(bytes memory agentInitializationCode1, bytes memory agentInitializationCode2) internal {
        _agentInitializationCode1 = agentInitializationCode1;
        _agentInitializationCode2 = agentInitializationCode2;
        emit AgentInitializationCodeSet(agentInitializationCode1, agentInitializationCode2);
    }
}
