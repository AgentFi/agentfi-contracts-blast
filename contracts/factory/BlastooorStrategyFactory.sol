// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Multicall } from "./../utils/Multicall.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IAgents } from "./../interfaces/tokens/IAgents.sol";
import { IBlastooorStrategyFactory } from "./../interfaces/factory/IBlastooorStrategyFactory.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { Ownable2Step } from "./../utils/Ownable2Step.sol";


/**
 * @title BlastooorStrategyFactory
 * @author AgentFi
 * @notice A factory for strategy agents.
 *
 * Users can use [`createAgent()`](#createagent) to create a new agent. The agent will be created based on settings stored in the factory by the contract owner. These settings can be viewed via [`getAgentCreationSettings()`](#getagentcreationsettings).
 */
contract BlastooorStrategyFactory is Multicall, Blastable, Ownable2Step, IBlastooorStrategyFactory {

    /***************************************
    STATE VARIABLES
    ***************************************/

    address internal _genesisAgentNft;
    address internal _strategyAgentNft;

    mapping(uint256 => AgentCreationSettings) internal _agentCreationSettings;

    uint256 internal _agentCreationSettingsCount;

    mapping(address => uint256) internal _createCount;
    uint256 internal _maxCreationsPerGenesisAgent;

    /***************************************
    CONSTRUCTOR
    ***************************************/

    /**
     * @notice Constructs the factory contract.
     * @param owner_ The owner of the contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param governor_ The address of the gas governor.
     * @param blastPoints_ The address of the blast points contract.
     * @param pointsOperator_ The address of the blast points operator.
     * @param genesisAgentNft The genesis agents contract.
     * @param strategyAgentNft The strategy agents contract.
     */
    constructor(
        address owner_,
        address blast_,
        address governor_,
        address blastPoints_,
        address pointsOperator_,
        address genesisAgentNft,
        address strategyAgentNft
    ) Blastable(blast_, governor_, blastPoints_, pointsOperator_) {
        _transferOwnership(owner_);
        _genesisAgentNft = genesisAgentNft;
        _strategyAgentNft = strategyAgentNft;
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
     * @return genesisAgentNft The genesis agents contract.
     * @return strategyAgentNft The strategy agents contract.
     * @return agentImplementation The agent implementation.
     * @return initializationCalls The calls to initialize the agent.
     * @return isActive True if these creation settings are active, false otherwise.
     */
    function getAgentCreationSettings(uint256 creationSettingsID) external view override returns (
        address genesisAgentNft,
        address strategyAgentNft,
        address agentImplementation,
        bytes[] memory initializationCalls,
        bool isActive
    ) {
        if(creationSettingsID == 0 || creationSettingsID > _agentCreationSettingsCount) revert Errors.OutOfRange();
        genesisAgentNft = _genesisAgentNft;
        strategyAgentNft = _strategyAgentNft;
        AgentCreationSettings memory creationSettings = _agentCreationSettings[creationSettingsID];
        agentImplementation = creationSettings.agentImplementation;
        initializationCalls = creationSettings.initializationCalls;
        isActive = creationSettings.isActive;
    }

    /**
    * @notice Gets the number of agents created by the user.
    * @return count The count.
    */
    function getCreateCount(address user) external view override returns (uint256 count) {
        count = _createCount[user];
    }

    /**
    * @notice Gets the maximum number of strategy agents that can be created per genesis agent.
    * @return count The count.
    */
    function maxCreationsPerGenesisAgent() external view override returns (uint256 count) {
        count = _maxCreationsPerGenesisAgent;
    }

    /***************************************
    CREATE AGENT FUNCTIONS
    ***************************************/

    /**
     * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @param creationSettingsID The creation settings to use.
     * @return info Information about the newly created agent.
     */
    function createAgent(uint256 creationSettingsID) external payable override returns (AgentInfo memory info) {
        IAgents strategyAgentNft = IAgents(_strategyAgentNft);
        info = _createAgents(strategyAgentNft, creationSettingsID, 1)[0];
    }

    /**
     * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @param creationSettingsID The creation settings to use.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @return info Information about the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, bytes[] calldata callDatas) external payable override returns (AgentInfo memory info) {
        IAgents strategyAgentNft = IAgents(_strategyAgentNft);
        info = _createAgents(strategyAgentNft, creationSettingsID, callDatas, 1)[0];
    }

    /**
     * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @param creationSettingsID The creation settings to use.
     * @param deposits Tokens to transfer from `msg.sender` to the new agents.
     * @return info Information about the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, TokenDeposit[] calldata deposits) external payable override returns (AgentInfo memory info) {
        IAgents strategyAgentNft = IAgents(_strategyAgentNft);
        info = _createAgents(strategyAgentNft, creationSettingsID, deposits, 1)[0];
    }

    /**
     * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @param creationSettingsID The creation settings to use.
     * @param deposits Tokens to transfer from `msg.sender` to the new agents.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @return info Information about the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, bytes[] calldata callDatas, TokenDeposit[] calldata deposits) external payable override returns (AgentInfo memory info) {
        IAgents strategyAgentNft = IAgents(_strategyAgentNft);
        info = _createAgents(strategyAgentNft, creationSettingsID, deposits, callDatas, 1)[0];
    }

    /**
     * @notice Creates multiple new agents.
     * The new agents will be transferred to `msg.sender`.
     * @param creationSettingsID The creation settings to use.
     * @param count The number of agents to create.
     * @return info Information about the newly created agents.
     */
    function createAgents(uint256 creationSettingsID, uint256 count) external payable override returns (AgentInfo[] memory info) {
        IAgents strategyAgentNft = IAgents(_strategyAgentNft);
        info = _createAgents(strategyAgentNft, creationSettingsID, count);
    }

    /**
     * @notice Creates multiple new agents.
     * The new agents will be transferred to `msg.sender`.
     * @param creationSettingsID The creation settings to use.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @param count The number of agents to create.
     * @return info Information about the newly created agents.
     */
    function createAgents(uint256 creationSettingsID, bytes[] calldata callDatas, uint256 count) external payable override returns (AgentInfo[] memory info) {
        IAgents strategyAgentNft = IAgents(_strategyAgentNft);
        info = _createAgents(strategyAgentNft, creationSettingsID, callDatas, count);
    }

    /**
     * @notice Creates multiple new agents.
     * The new agents will be transferred to `msg.sender`.
     * @param creationSettingsID The creation settings to use.
     * @param deposits Tokens to transfer from `msg.sender` to the new agents.
     * @param count The number of agents to create.
     * @return info Information about the newly created agents.
     */
    function createAgents(uint256 creationSettingsID, TokenDeposit[] calldata deposits, uint256 count) external payable override returns (AgentInfo[] memory info) {
        IAgents strategyAgentNft = IAgents(_strategyAgentNft);
        info = _createAgents(strategyAgentNft, creationSettingsID, deposits, count);
    }

    /**
     * @notice Creates multiple new agents.
     * The new agents will be transferred to `msg.sender`.
     * @param creationSettingsID The creation settings to use.
     * @param deposits Tokens to transfer from `msg.sender` to the new agents.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @param count The number of agents to create.
     * @return info Information about the newly created agents.
     */
    function createAgents(uint256 creationSettingsID, bytes[] calldata callDatas, TokenDeposit[] calldata deposits, uint256 count) external payable override returns (AgentInfo[] memory info) {
        IAgents strategyAgentNft = IAgents(_strategyAgentNft);
        info = _createAgents(strategyAgentNft, creationSettingsID, deposits, callDatas, count);
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
        emit AgentCreationSettingsActivated(creationSettingsID, creationSettings.isActive);
    }

    /**
     * @notice Sets the active state of a creationSettings.
     * Can only be called by the contract owner.
     * @param status True to activate, false to deactivate.
     */
    function setActiveStatus(uint256 creationSettingsID, bool status) external payable override onlyOwner {
        // checks
        if(creationSettingsID == 0 || creationSettingsID > _agentCreationSettingsCount) revert Errors.OutOfRange();
        // set
        _agentCreationSettings[creationSettingsID].isActive = status;
        emit AgentCreationSettingsActivated(creationSettingsID, status);
    }

    /**
    * @notice Sets the maximum number of strategy agents that can be created per genesis agent.
    * Can only be called by the contract owner.
    * @param count The count to set.
    */
    function setMaxCreationsPerGenesisAgent(uint256 count) external payable override {
        _maxCreationsPerGenesisAgent = count;
        emit SetMaxCreationsPerGenesisAgent(count);
    }

    /***************************************
    HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Creates multiple new agents.
     * @param agentNft The agent nft contract.
     * @param creationSettingsID The creation settings to use.
     * @param count The number of agents to create.
     * @return info Information about the newly created agent.
     */
    function _createAgents(
        IAgents agentNft,
        uint256 creationSettingsID,
        uint256 count
    ) internal returns (AgentInfo[] memory info) {
        // checks
        AgentCreationSettings memory creationSettings = _createAgentPrecheck(creationSettingsID, count);
        // create agents
        info = new AgentInfo[](count);
        for(uint256 i = 0; i < count; ++i) {
            (uint256 agentID, address agentAddress) = agentNft.createAgent(creationSettings.agentImplementation);
            info[i].agentID = agentID;
            info[i].agentAddress = agentAddress;
            // initialize
            for(uint256 j = 0; j < creationSettings.initializationCalls.length; ++j) {
                _callAgent(agentAddress, creationSettings.initializationCalls[j]);
            }
        }
        for(uint256 i = 0; i < count; ++i) {
            agentNft.transferFrom(address(this), msg.sender, info[i].agentID);
        }
    }

    /**
     * @notice Creates multiple new agents.
     * @param agentNft The agent nft contract.
     * @param creationSettingsID The creation settings to use.
     * @param deposits Tokens to transfer from `msg.sender` to the new agent.
     * @param count The number of agents to create.
     * @return info Information about the newly created agents.
     */
    function _createAgents(
        IAgents agentNft,
        uint256 creationSettingsID,
        TokenDeposit[] calldata deposits,
        uint256 count
    ) internal returns (AgentInfo[] memory info) {
        // checks
        AgentCreationSettings memory creationSettings = _createAgentPrecheck(creationSettingsID, count);
        // create agents
        info = new AgentInfo[](count);
        for(uint256 i = 0; i < count; ++i) {
            (uint256 agentID, address agentAddress) = agentNft.createAgent(creationSettings.agentImplementation);
            info[i].agentID = agentID;
            info[i].agentAddress = agentAddress;
            // deposit tokens
            for(uint256 j = 0; j < deposits.length; ++j) {
                address token = deposits[j].token;
                uint256 amount = deposits[j].amount;
                if(token == address(0)) Calls.sendValue(agentAddress, amount);
                else SafeERC20.safeTransferFrom(IERC20(token), msg.sender, agentAddress, amount);
            }
            // initialize
            for(uint256 j = 0; j < creationSettings.initializationCalls.length; ++j) {
                _callAgent(agentAddress, creationSettings.initializationCalls[j]);
            }
        }
        for(uint256 i = 0; i < count; ++i) {
            agentNft.transferFrom(address(this), msg.sender, info[i].agentID);
        }
    }

    /**
     * @notice Creates multiple new agents.
     * @param agentNft The agent nft contract.
     * @param creationSettingsID The creation settings to use.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @param count The number of agents to create.
     * @return info Information about the newly created agent.
     */
    function _createAgents(
        IAgents agentNft,
        uint256 creationSettingsID,
        bytes[] calldata callDatas,
        uint256 count
    ) internal returns (AgentInfo[] memory info) {
        // checks
        AgentCreationSettings memory creationSettings = _createAgentPrecheck(creationSettingsID, count);
        // create agents
        info = new AgentInfo[](count);
        for(uint256 i = 0; i < count; ++i) {
            (uint256 agentID, address agentAddress) = agentNft.createAgent(creationSettings.agentImplementation);
            info[i].agentID = agentID;
            info[i].agentAddress = agentAddress;
            // initialize
            for(uint256 j = 0; j < creationSettings.initializationCalls.length; ++j) {
                _callAgent(agentAddress, creationSettings.initializationCalls[j]);
            }
            _multicallAgent(agentAddress, callDatas);
        }
        for(uint256 i = 0; i < count; ++i) {
            agentNft.transferFrom(address(this), msg.sender, info[i].agentID);
        }
    }

    /**
     * @notice Creates multiple new agents.
     * @param agentNft The agent nft contract.
     * @param creationSettingsID The creation settings to use.
     * @param deposits Tokens to transfer from `msg.sender` to the new agent.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @param count The number of agents to create.
     * @return info Information about the newly created agents.
     */
    function _createAgents(
        IAgents agentNft,
        uint256 creationSettingsID,
        TokenDeposit[] calldata deposits,
        bytes[] calldata callDatas,
        uint256 count
    ) internal returns (AgentInfo[] memory info) {
        // checks
        AgentCreationSettings memory creationSettings = _createAgentPrecheck(creationSettingsID, count);
        // create agents
        info = new AgentInfo[](count);
        for(uint256 i = 0; i < count; ++i) {
            (uint256 agentID, address agentAddress) = agentNft.createAgent(creationSettings.agentImplementation);
            info[i].agentID = agentID;
            info[i].agentAddress = agentAddress;
            // deposit tokens
            for(uint256 j = 0; j < deposits.length; ++j) {
                address token = deposits[j].token;
                uint256 amount = deposits[j].amount;
                if(token == address(0)) Calls.sendValue(agentAddress, amount);
                else SafeERC20.safeTransferFrom(IERC20(token), msg.sender, agentAddress, amount);
            }
            // initialize
            for(uint256 j = 0; j < creationSettings.initializationCalls.length; ++j) {
                _callAgent(agentAddress, creationSettings.initializationCalls[j]);
            }
            _multicallAgent(agentAddress, callDatas);
        }
        for(uint256 i = 0; i < count; ++i) {
            agentNft.transferFrom(address(this), msg.sender, info[i].agentID);
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

    function _createAgentPrecheck(
        uint256 creationSettingsID,
        uint256 count
    ) internal returns (AgentCreationSettings memory creationSettings) {
        uint256 genesisAgentID = IAgents(_genesisAgentNft).getAgentID(msg.sender);
        if(genesisAgentID == 0) revert Errors.NotAuthorized();
        uint256 newCount = _createCount[msg.sender] + count;
        if(newCount > _maxCreationsPerGenesisAgent) revert Errors.OverMaxCreationsPerUser();
        _createCount[msg.sender] = newCount;
        if(creationSettingsID == 0 || creationSettingsID > _agentCreationSettingsCount) revert Errors.OutOfRange();
        creationSettings = _agentCreationSettings[creationSettingsID];
        if(!creationSettings.isActive) revert Errors.CreationSettingsPaused();
    }
}
