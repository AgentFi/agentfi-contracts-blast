// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { ERC2771Context } from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import { Multicall } from "./../utils/Multicall.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IAgents } from "./../interfaces/tokens/IAgents.sol";
import { IBlastooorAccountFactory } from "./../interfaces/factory/IBlastooorAccountFactory.sol";
import { IAgentRegistry } from "./../interfaces/utils/IAgentRegistry.sol";
import { IERC6551Registry } from "./../interfaces/erc6551/IERC6551Registry.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { Ownable2Step } from "./../utils/Ownable2Step.sol";


/**
 * @title BlastooorAccountFactory
 * @author AgentFi
 * @notice A factory for Agent accounts.
 */
contract BlastooorAccountFactory is IBlastooorAccountFactory, Multicall, Blastable, Ownable2Step, ERC2771Context {

    /***************************************
    STATE VARIABLES
    ***************************************/

    address internal _agentNft;
    address internal _agentRegistry;
    address internal _erc6551Registry;

    mapping(uint256 => AgentCreationSettings) internal _agentCreationSettings;

    uint256 internal _agentCreationSettingsCount;

    mapping(uint256 => uint256) internal _createCount;
    uint256 internal _maxCreationsPerAgent;

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
     * @param multicallForwarder_ The MulticallForwarder address.
     * @param agentNft_ The Agents contract.
     * @param agentRegistry_ The AgentRegistry contract.
     * @param erc6551Registry_ The ERC6551Registry contract.
     */
    constructor(
        address owner_,
        address blast_,
        address gasCollector_,
        address blastPoints_,
        address pointsOperator_,
        address multicallForwarder_,
        address agentNft_,
        address agentRegistry_,
        address erc6551Registry_
    ) Blastable(blast_, gasCollector_, blastPoints_, pointsOperator_) ERC2771Context(multicallForwarder_) {
        _transferOwnership(owner_);
        _agentNft = agentNft_;
        _agentRegistry = agentRegistry_;
        _erc6551Registry = erc6551Registry_;
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
     * @return agentNft The agents contract.
     * @return agentImplementation The agent implementation.
     * @return initializationCalls The calls to initialize the agent.
     * @return isActive True if these creation settings are active, false otherwise.
     */
    function getAgentCreationSettings(uint256 creationSettingsID) external view override returns (
        address agentNft,
        address agentImplementation,
        bytes[] memory initializationCalls,
        bool isActive
    ) {
        if(creationSettingsID == 0 || creationSettingsID > _agentCreationSettingsCount) revert Errors.OutOfRange();
        agentNft = _agentNft;
        AgentCreationSettings memory creationSettings = _agentCreationSettings[creationSettingsID];
        agentImplementation = creationSettings.agentImplementation;
        initializationCalls = creationSettings.initializationCalls;
        isActive = creationSettings.isActive;
    }

    /**
    * @notice Gets the number of accounts created for the agent.
    * @return count The count.
    */
    function getCreateCount(uint256 agentID) external view override returns (uint256 count) {
        count = _createCount[agentID];
    }

    /**
    * @notice Gets the maximum number of strategy agents that can be created per genesis agent.
    * @return count The count.
    */
    function maxCreationsPerAgent() external view override returns (uint256 count) {
        count = _maxCreationsPerAgent;
    }

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
    function createAccount(uint256 agentID, uint256 creationSettingsID) external payable returns (address account) {
        account = _createAccount(agentID, creationSettingsID);
    }

    /**
     * @notice Creates a new account for an agent.
     * Can only be called by the owner of the agent.
     * @param agentID The ID of the agent to create an account for.
     * @param creationSettingsID The creation settings to use.
     * @param callDatas Extra data to pass to the agent after it is created.
     * @return account The address of the newly created account.
     */
    function createAccount(uint256 agentID, uint256 creationSettingsID, bytes[] calldata callDatas) external payable returns (address account) {
        account = _createAccount(agentID, creationSettingsID);
        // initialize account
        for(uint256 i = 0; i < callDatas.length; ++i) {
            Calls.functionCall(account, callDatas[i]);
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
    function setMaxCreationsPerAgent(uint256 count) external payable override onlyOwner {
        _maxCreationsPerAgent = count;
        emit SetMaxCreationsPerAgent(count);
    }

    /***************************************
    HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Creates a new account for an agent.
     * @param agentID The ID of the agent to create an account for.
     * @param creationSettingsID The creation settings to use.
     * @return account The address of the newly created account.
     */
    function _createAccount(uint256 agentID, uint256 creationSettingsID) internal returns (address account) {
        // checks
        address agentNft = _agentNft;
        if(IAgents(agentNft).ownerOf(agentID) != _msgSender()) revert Errors.NotOwnerOfAgent();
        uint256 createIndex = _createCount[agentID] + 1;
        if(createIndex > _maxCreationsPerAgent) revert Errors.OverMaxCreationsPerAgent();
        _createCount[agentID] = createIndex;
        if(creationSettingsID == 0 || creationSettingsID > _agentCreationSettingsCount) revert Errors.OutOfRange();
        AgentCreationSettings memory creationSettings = _agentCreationSettings[creationSettingsID];
        if(!creationSettings.isActive) revert Errors.CreationSettingsPaused();
        // create account
        account = IERC6551Registry(_erc6551Registry).createAccount(
            creationSettings.agentImplementation,
            bytes32(createIndex),
            block.chainid,
            agentNft,
            agentID
        );
        // register account
        IAgentRegistry(_agentRegistry).registerAgent(IAgentRegistry.RegisterAgentParam({
            agentAddress: account,
            implementationAddress: creationSettings.agentImplementation,
            collection: agentNft,
            agentID: agentID
        }));
        // transfer in gas token
        uint256 balance = address(this).balance;
        if(balance > 0) Calls.sendValue(account, balance);
        // initialize account
        for(uint256 i = 0; i < creationSettings.initializationCalls.length; ++i) {
            Calls.functionCall(account, creationSettings.initializationCalls[i]);
        }
    }
}
