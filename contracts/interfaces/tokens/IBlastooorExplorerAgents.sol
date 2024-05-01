// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";


/**
 * @title IBlastooorExplorerAgents
 * @author AgentFi
 * @notice The Blastooor Explorer ERC721 token contract. Creates new agents and manages ownership of agents in the AgentFi protocol.
 *
 * Each agent is represented as an NFT. The owner of the NFT is the owner of the agent. Transferring the NFT means transferring the agent and its contents.
 *
 * Each agent is also a smart contract account. The account is created at the same time the agent is created. Ownership of the account is delegated to the owner of the NFT using ERC6551 Token Bound Accounts.
 *
 * Agents can be created via [`createAgent()`](#createagent). Only whitelisted accounts may create agents - these may be any address, but are designed to be smart contracts called factories. This ERC721 contract manages the creation and registration of agents. The factory contract handles any additional logic - verifying implementation, initializing the agent, etc. A user that wants to create an agent should call a factory contract, which in turn calls this contract.
 *
 * The list of factories can be queried via [`factoryIsWhitelisted()`](#factoryiswhitelisted) and maintained by the contract owner via [`setWhitelist()`](#setwhitelist).
 *
 * Agents are ERC721s with the enumerable, metadata, and exists extensions. Info about the associated TBAs is stored in another contract.
 */
interface IBlastooorExplorerAgents is IERC721Enumerable {

    /// @notice Emitted when a factory is whitelisted or blacklisted.
    event FactoryWhitelisted(address indexed factory, bool wasWhitelisted);
    /// @notice Emitted when the base URI is set.
    event BaseURISet(string baseURI);
    /// @notice Emitted when the contract URI is set.
    event ContractURISet(string contractURI);

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns true if the agent exists.
     * @param agentID The ID of the agent to query.
     * @return status True if the agent exists, false otherwise.
     */
    function exists(uint256 agentID) external view returns (bool status);

    /***************************************
    CREATE AGENT FUNCTIONS
    ***************************************/

    /**
     * @notice Creates a new agent.
     * @dev The new agent will be minted to `msg.sender`. This function is designed to be called from another contract to perform additional setup.
     * @return agentID The ID of the newly created agent.
     */
    function createAgent() external payable returns (uint256 agentID);

    /***************************************
    WHITELIST FUNCTIONS
    ***************************************/

    /**
     * @notice Returns true if the factory has been whitelisted.
     * All addresses are whitelisted if address zero is whitelisted.
     * @param factory The address of the factory to query.
     * @return isWhitelisted True if the factory has been whitelisted, false otherwise.
     */
    function factoryIsWhitelisted(address factory) external view returns (bool isWhitelisted);

    struct SetWhitelistParam {
        address factory;
        bool shouldWhitelist;
    }

    /**
     * @notice Adds or removes factories to the whitelist.
     * Can only be called by the contract owner.
     * @param params The list of factories and if they should be whitelisted or blacklisted.
     */
    function setWhitelist(SetWhitelistParam[] memory params) external payable;

    /***************************************
    METADATA FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the base URI for computing tokenURI.
     * @return uri The base URI.
     */
    function baseURI() external view returns (string memory uri);

    /**
     * @notice Sets the base URI for computing tokenURI.
     * Can only be called by the contract owner.
     * @param uri The new base URI.
     */
    function setBaseURI(string calldata uri) external payable;

    /**
     * @notice Returns the contract URI.
     * @return uri The contract URI.
     */
    function contractURI() external view returns (string memory uri);

    /**
     * @notice Sets the contract URI.
     * Can only be called by the contract owner.
     * @param uri The new contract URI.
     */
    function setContractURI(string calldata uri) external payable;
}
