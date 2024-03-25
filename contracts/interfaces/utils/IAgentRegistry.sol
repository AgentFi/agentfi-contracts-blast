// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IAgentRegistry
 * @author AgentFi
 * @notice Tracks Agents, NFTs, and TBAs in the AgentFi ecosystem.
 *
 * Does NOT replace the ERC6551Registry, merely an enumeration on top of it.
 */
interface IAgentRegistry {

    /***************************************
    STATE VARIABLES
    ***************************************/

    /// @notice Emitted when an operator is added or removed.
    event OperatorSet(address indexed account, bool isOperator);
    /// @notice Emitted when an agent is registered.
    event AgentRegistered(address indexed agentAddress, address indexed collection, uint256 indexed agentID);

    struct AgentInfo {
        address agentAddress;
        address implementationAddress;
    }

    struct TokenInfo {
        address collection;
        uint256 agentID;
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns true if the account is an operator.
     * @param account The account to query.
     * @return isAuthorized True if is an operator, false otherwise.
     */
    function isOperator(address account) external view returns (bool isAuthorized);

    /**
     * @notice Returns the list of known agent TBAs for an agent NFT.
     * @param collection The address of the collection to query.
     * @param agentID The ID of the agent to query.
     * @return tbas The list of registered TBAs for this agent.
     */
    function getTbasOfNft(address collection, uint256 agentID) external view returns (AgentInfo[] memory tbas);

    /**
     * @notice Returns the NFT associated with an agent TBA.
     * Returns zeros if not registered.
     * @param tba The address of the TBA to query.
     * @return collection The address of the NFT collection.
     * @return agentID The ID of the agent.
     */
    function getNftOfTba(address tba) external view returns (address collection, uint256 agentID);

    /**
     * @notice Returns true if the TBA is known.
     * @param tba The address of the TBA to query.
     * @return isRegistered True if the agent is registerd, false otherwise.
     */
    function isTbaRegisteredAgent(address tba) external view returns (bool isRegistered);

    /***************************************
    OPERATOR FUNCTIONS
    ***************************************/

    struct RegisterAgentParam {
        address agentAddress;
        address implementationAddress;
        address collection;
        uint256 agentID;
    }

    /**
     * @notice Registers a new agent.
     * Can only be called by an operator.
     * @param params The agent to register.
     */
    function registerAgent(RegisterAgentParam calldata params) external payable;

    /**
     * @notice Registers a new agent. Fails gracefully if the agent has already been registered.
     * Can only be called by an operator.
     * @param params The agent to register.
     */
    function tryRegisterAgent(RegisterAgentParam calldata params) external payable;

    /**
     * @notice Registers a list of new agents.
     * Can only be called by an operator.
     * @param params The agents to register.
     */
    function registerAgents(RegisterAgentParam[] calldata params) external payable;

    /**
     * @notice Registers a list of new agents. Fails gracefully if the agent has already been registered.
     * Can only be called by an operator.
     * @param params The agents to register.
     */
    function tryRegisterAgents(RegisterAgentParam[] calldata params) external payable;

    /***************************************
    OWNER FUNCTIONS
    ***************************************/

    struct SetOperatorParam {
        address account;
        bool isAuthorized;
    }

    /**
     * @notice Sets the status of a list of operators.
     * Can only be called by the contract owner.
     * @param params The list to set.
     */
    function setOperators(SetOperatorParam[] calldata params) external payable;
}
