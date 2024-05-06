// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Multicall } from "./Multicall.sol";
import { IAgentRegistry } from "./../interfaces/utils/IAgentRegistry.sol";
import { Blastable } from "./Blastable.sol";
import { Errors } from "./../libraries/Errors.sol";
import { Ownable2Step } from "./../utils/Ownable2Step.sol";


/**
 * @title AgentRegistry
 * @author AgentFi
 * @notice Tracks Agents, NFTs, and TBAs in the AgentFi ecosystem.
 *
 * Does NOT replace the ERC6551Registry, merely an enumeration on top of it.
 */
contract AgentRegistry is IAgentRegistry, Blastable, Ownable2Step, Multicall {

    /***************************************
    STATE VARIABLES
    ***************************************/

    // the addresses that can register new tbas
    mapping(address => bool) internal _isOperator;

    // collection => agentID => tbas
    mapping(address => mapping(uint256 => AgentInfo[])) internal _agentInfo;

    // agent tba address => info about the associated nft
    mapping(address => TokenInfo) internal _agentAddressToInfo;

    /***************************************
    CONSTRUCTOR
    ***************************************/

    /**
     * @notice Constructs the AgentRegistry contract.
     * @param owner_ The owner of the contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param gasCollector_ The address of the gas collector.
     * @param blastPoints_ The address of the blast points contract.
     * @param pointsOperator_ The address of the blast points operator.
     */
    constructor(
        address owner_,
        address blast_,
        address gasCollector_,
        address blastPoints_,
        address pointsOperator_
    ) Blastable(blast_, gasCollector_, blastPoints_, pointsOperator_) {
        _transferOwnership(owner_);
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns true if the account is an operator.
     * @param account The account to query.
     * @return isAuthorized True if is an operator, false otherwise.
     */
    function isOperator(address account) external view override returns (bool isAuthorized) {
        isAuthorized = _isOperator[account];
    }

    /**
     * @notice Returns the list of known agent TBAs for an agent NFT.
     * @param collection The address of the collection to query.
     * @param agentID The ID of the agent to query.
     * @return tbas The list of registered TBAs for this agent.
     */
    function getTbasOfNft(address collection, uint256 agentID) external view override returns (AgentInfo[] memory tbas) {
        tbas = _agentInfo[collection][agentID];
    }

    /**
     * @notice Returns the NFT associated with an agent TBA.
     * Returns zeros if not registered.
     * @param tba The address of the TBA to query.
     * @return collection The address of the NFT collection.
     * @return agentID The ID of the agent.
     */
    function getNftOfTba(address tba) external view override returns (address collection, uint256 agentID) {
        TokenInfo memory info = _agentAddressToInfo[tba];
        collection = info.collection;
        agentID = info.agentID;
    }

    /**
     * @notice Returns true if the TBA is known.
     * @param tba The address of the TBA to query.
     * @return isRegistered True if the agent is registerd, false otherwise.
     */
    function isTbaRegisteredAgent(address tba) external view override returns (bool isRegistered) {
        TokenInfo storage info = _agentAddressToInfo[tba];
        isRegistered = (info.collection != address(0));
    }

    /***************************************
    OPERATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Registers a new agent.
     * Can only be called by an operator.
     * @param params The agent to register.
     */
    function registerAgent(RegisterAgentParam calldata params) external payable override {
        _validateSenderIsOperator();
        _registerAgent(params);
    }

    /**
     * @notice Registers a new agent. Fails gracefully if the agent has already been registered.
     * Can only be called by an operator.
     * @param params The agent to register.
     */
    function tryRegisterAgent(RegisterAgentParam calldata params) external payable override {
        _validateSenderIsOperator();
        _tryRegisterAgent(params);
    }

    /**
     * @notice Registers a list of new agents.
     * Can only be called by an operator.
     * @param params The agents to register.
     */
    function registerAgents(RegisterAgentParam[] calldata params) external payable override {
        _validateSenderIsOperator();
        for(uint256 i = 0; i < params.length; ++i) {
            _registerAgent(params[i]);
        }
    }

    /**
     * @notice Registers a list of new agents. Fails gracefully if the agent has already been registered.
     * Can only be called by an operator.
     * @param params The agents to register.
     */
    function tryRegisterAgents(RegisterAgentParam[] calldata params) external payable override {
        _validateSenderIsOperator();
        for(uint256 i = 0; i < params.length; ++i) {
            _tryRegisterAgent(params[i]);
        }
    }

    /***************************************
    OWNER FUNCTIONS
    ***************************************/

    /**
     * @notice Sets the status of a list of operators.
     * Can only be called by the contract owner.
     * @param params The list to set.
     */
    function setOperators(SetOperatorParam[] calldata params) external payable override onlyOwner {
        for(uint256 i = 0; i < params.length; ++i) {
            _isOperator[params[i].account] = params[i].isAuthorized;
            emit OperatorSet(params[i].account, params[i].isAuthorized);
        }
    }

    /***************************************
    HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Reverts if `msg.sender` is not an operator.
     */
    function _validateSenderIsOperator() internal view {
        if(!_isOperator[msg.sender]) revert Errors.NotOperator();
    }

    /**
     * @notice Registers a new agent.
     * @param params The agent to register.
     */
    function _registerAgent(RegisterAgentParam calldata params) internal {
        TokenInfo storage info = _agentAddressToInfo[params.agentAddress];
        if(info.collection != address(0)) revert Errors.AlreadyRegistered();
        info.collection = params.collection;
        info.agentID = params.agentID;
        _agentInfo[params.collection][params.agentID].push(AgentInfo({
            agentAddress: params.agentAddress,
            implementationAddress: params.implementationAddress
        }));
        emit AgentRegistered(params.agentAddress, params.collection, params.agentID);
    }

    /**
     * @notice Registers a new agent.
     * @param params The agent to register.
     */
    function _tryRegisterAgent(RegisterAgentParam calldata params) internal {
        TokenInfo storage info = _agentAddressToInfo[params.agentAddress];
        if(info.collection != address(0)) return;
        info.collection = params.collection;
        info.agentID = params.agentID;
        _agentInfo[params.collection][params.agentID].push(AgentInfo({
            agentAddress: params.agentAddress,
            implementationAddress: params.implementationAddress
        }));
        emit AgentRegistered(params.agentAddress, params.collection, params.agentID);
    }
}
