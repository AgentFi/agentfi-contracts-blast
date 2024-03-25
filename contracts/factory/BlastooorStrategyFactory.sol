// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Multicall } from "./../utils/Multicall.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IBlastooorStrategyAgents } from "./../interfaces/tokens/IBlastooorStrategyAgents.sol";
import { IERC6551Registry } from "./../interfaces/erc6551/IERC6551Registry.sol";
import { IAgentRegistry } from "./../interfaces/utils/IAgentRegistry.sol";
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
    address internal _erc6551Registry;
    address internal _agentRegistry;

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
     * @param gasCollector_ The address of the gas collector.
     * @param blastPoints_ The address of the blast points contract.
     * @param pointsOperator_ The address of the blast points operator.
     * @param genesisAgentNft_ The genesis agents contract.
     * @param strategyAgentNft_ The strategy agents contract.
     * @param erc6551Registry_ The erc6551 registry contract.
     * @param agentRegistry_ The agent registry contract.
     */
    constructor(
        address owner_,
        address blast_,
        address gasCollector_,
        address blastPoints_,
        address pointsOperator_,
        address genesisAgentNft_,
        address strategyAgentNft_,
        address erc6551Registry_,
        address agentRegistry_
    ) Blastable(blast_, gasCollector_, blastPoints_, pointsOperator_) {
        _transferOwnership(owner_);
        _genesisAgentNft = genesisAgentNft_;
        _strategyAgentNft = strategyAgentNft_;
        _erc6551Registry = erc6551Registry_;
        _agentRegistry = agentRegistry_;
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
     * @param creationSettingsID The ID of the creation settings to use.
     * @return info Information about the newly created agent.
     */
    function createAgent(uint256 creationSettingsID) external payable override returns (AgentInfo memory info) {
        AgentCreationSettings memory creationSettings = _createAgentPrecheck(creationSettingsID);
        address strategyAgentNft = _strategyAgentNft;
        info = _createAgent(strategyAgentNft, creationSettings.agentImplementation);
        _initCalls(info.agentAddress, creationSettings.initializationCalls);
        IBlastooorStrategyAgents(strategyAgentNft).transferFrom(address(this), msg.sender, info.agentID);
    }

    /**
     * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @param creationSettingsID The ID of the creation settings to use.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @return info Information about the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, bytes[] calldata callDatas) external payable override returns (AgentInfo memory info) {
        AgentCreationSettings memory creationSettings = _createAgentPrecheck(creationSettingsID);
        address strategyAgentNft = _strategyAgentNft;
        info = _createAgent(strategyAgentNft, creationSettings.agentImplementation);
        _initCalls(info.agentAddress, creationSettings.initializationCalls);
        _setupCalls(info.agentAddress, callDatas);
        IBlastooorStrategyAgents(strategyAgentNft).transferFrom(address(this), msg.sender, info.agentID);
    }

    /**
     * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @param creationSettingsID The ID of the creation settings to use.
     * @param deposits Tokens to transfer from `msg.sender` to the new agent.
     * @return info Information about the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, TokenDeposit[] calldata deposits) external payable override returns (AgentInfo memory info) {
        AgentCreationSettings memory creationSettings = _createAgentPrecheck(creationSettingsID);
        address strategyAgentNft = _strategyAgentNft;
        info = _createAgent(strategyAgentNft, creationSettings.agentImplementation);
        _deposit(info.agentAddress, deposits);
        _initCalls(info.agentAddress, creationSettings.initializationCalls);
        IBlastooorStrategyAgents(strategyAgentNft).transferFrom(address(this), msg.sender, info.agentID);
    }

    /**
     * @notice Creates a new agent.
     * The new agent will be transferred to `msg.sender`.
     * @param creationSettingsID The ID of the creation settings to use.
     * @param deposits Tokens to transfer from `msg.sender` to the new agent.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @return info Information about the newly created agent.
     */
    function createAgent(uint256 creationSettingsID, bytes[] calldata callDatas, TokenDeposit[] calldata deposits) external payable override returns (AgentInfo memory info) {
        AgentCreationSettings memory creationSettings = _createAgentPrecheck(creationSettingsID);
        address strategyAgentNft = _strategyAgentNft;
        info = _createAgent(strategyAgentNft, creationSettings.agentImplementation);
        _deposit(info.agentAddress, deposits);
        _initCalls(info.agentAddress, creationSettings.initializationCalls);
        _setupCalls(info.agentAddress, callDatas);
        IBlastooorStrategyAgents(strategyAgentNft).transferFrom(address(this), msg.sender, info.agentID);
    }

    /***************************************
    HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice A series of checks performed before any agent is created.
     * @param creationSettingsID The ID of the creation settings to use.
     * @return creationSettings The creation settings to use.
     */
    function _createAgentPrecheck(
        uint256 creationSettingsID
    ) internal returns (AgentCreationSettings memory creationSettings) {
        // dev: for efficiency also returns the creation settings
        // can only be called from registered genesis TBAs
        (address collection, ) = IAgentRegistry(_agentRegistry).getNftOfTba(msg.sender);
        if(collection != _genesisAgentNft) revert Errors.NotAuthorized();
        // can only create a maximum amount per sender
        uint256 newCount = _createCount[msg.sender] + 1;
        if(newCount > _maxCreationsPerGenesisAgent) revert Errors.OverMaxCreationsPerUser();
        _createCount[msg.sender] = newCount;
        // creation settings id must be valid
        if(creationSettingsID == 0 || creationSettingsID > _agentCreationSettingsCount) revert Errors.OutOfRange();
        creationSettings = _agentCreationSettings[creationSettingsID];
        // creation settings must not be paused
        if(!creationSettings.isActive) revert Errors.CreationSettingsPaused();
    }

    /**
     * @notice Creates a new agent.
     * @param strategyAgentNft The strategy agent nft contract.
     * @param agentImplementation The implementation contract for the agent TBA.
     * @return info Information about the newly created agent.
     */
    function _createAgent(
        address strategyAgentNft,
        address agentImplementation
    ) internal returns (AgentInfo memory info) {
        uint256 agentID = IBlastooorStrategyAgents(strategyAgentNft).createAgent();
        info.agentID = agentID;
        address agentAddress = IERC6551Registry(_erc6551Registry).createAccount(
            agentImplementation,
            bytes32(0),
            block.chainid,
            strategyAgentNft,
            agentID
        );
        info.agentAddress = agentAddress;
        IAgentRegistry(_agentRegistry).registerAgent(IAgentRegistry.RegisterAgentParam({
            agentAddress: agentAddress,
            implementationAddress: agentImplementation,
            collection: strategyAgentNft,
            agentID: agentID
        }));
    }

    /**
     * @notice Deposits tokens into the new agent.
     * Assumes tokens are in this contract.
     * @param agentAddress The account to deposit into.
     * @param deposits Tokens to transfer from `msg.sender` to the new agent.
     */
    function _deposit(address agentAddress, TokenDeposit[] calldata deposits) internal {
        for(uint256 i = 0; i < deposits.length; ++i) {
            address token = deposits[i].token;
            uint256 amount = deposits[i].amount;
            if(token == address(0)) Calls.sendValue(agentAddress, amount);
            else SafeERC20.safeTransfer(IERC20(token), agentAddress, amount);
        }
    }

    /**
     * @notice Makes the initialization calls on the agent.
     * @param agentAddress The account to initialize.
     * @param callDatas The calls to make.
     */
    function _initCalls(address agentAddress, bytes[] memory callDatas) internal {
        for(uint256 i = 0; i < callDatas.length; ++i) {
            Calls.functionCall(agentAddress, callDatas[i]);
        }
    }

    /**
     * @notice Makes the setup calls on the agent.
     * @param agentAddress The account to setup.
     * @param callDatas The calls to make.
     */
    function _setupCalls(address agentAddress, bytes[] calldata callDatas) internal {
        for(uint256 i = 0; i < callDatas.length; ++i) {
            Calls.functionCall(agentAddress, callDatas[i]);
        }
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
    function setMaxCreationsPerGenesisAgent(uint256 count) external payable override onlyOwner {
        _maxCreationsPerGenesisAgent = count;
        emit SetMaxCreationsPerGenesisAgent(count);
    }
}
