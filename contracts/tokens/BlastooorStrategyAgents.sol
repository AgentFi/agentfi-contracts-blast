// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Multicall } from "./../utils/Multicall.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IERC6551Registry } from "./../interfaces/erc6551/IERC6551Registry.sol";
import { IBlastooorStrategyAgents } from "./../interfaces/tokens/IBlastooorStrategyAgents.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { Ownable2Step } from "./../utils/Ownable2Step.sol";


/**
 * @title BlastooorStrategyAgents
 * @author AgentFi
 * @notice The Blastooor Strategy ERC721 token contract. Creates new agents and manages ownership of agents in the AgentFi protocol.
 *
 * Each agent is represented as an NFT. The owner of the NFT is the owner of the agent. Transferring the NFT means transferring the agent and its contents.
 *
 * Each agent is also a smart contract account. The account is created at the same time the agent is created. Ownership of the account is delegated to the owner of the NFT using ERC6551 Token Bound Accounts.
 *
 * Agents can be created via [`createAgent()`](#createagent). Only whitelisted accounts may create agents - these may be any address, but are designed to be smart contracts called factories. This ERC721 contract manages the creation and registration of agents. The factory contract handles any additional logic - verifying implementation, initializing the agent, etc. A user that wants to create an agent should call a factory contract, which in turn calls this contract.
 *
 * The list of factories can be queried via [`factoryIsWhitelisted()`](#factoryiswhitelisted) and maintained by the contract owner via [`setWhitelist()`](#setwhitelist).
 *
 * Agents are ERC721s with the enumerable extension. Additional information about each agent can be queried via [`getAgentInfo()`](#getagentinfo) and [`exists()`](#exists).
 */
contract BlastooorStrategyAgents is IBlastooorStrategyAgents, ERC721Enumerable, Blastable, Ownable2Step, Multicall {

    mapping(address => bool) internal _factoryIsWhitelisted;

    struct AgentInfo {
        address agentAddress;
        address implementationAddress;
    }
    mapping(uint256 => AgentInfo) internal _agentInfo;
    mapping(address => uint256) internal _agentAddressToID;

    address internal _erc6551Registry;

    // uri data

    string internal _tokenURIbase;
    string internal _contractURI;


    /**
     * @notice Constructs the BlastooorStrategyAgents nft contract.
     * @param owner_ The owner of the contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param governor_ The address of the gas governor.
     * @param blastPoints_ The address of the blast points contract.
     * @param pointsOperator_ The address of the blast points operator.
     * @param erc6551Registry_ The address of the ERC6551Registry.
     */
    constructor(
        address owner_,
        address blast_,
        address governor_,
        address blastPoints_,
        address pointsOperator_,
        address erc6551Registry_
    ) Blastable(blast_, governor_, blastPoints_, pointsOperator_) ERC721("Blastooor Strategy", "BLASTOOOR STRATEGY") {
        _transferOwnership(owner_);
        _erc6551Registry = erc6551Registry_;
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the address of an agent.
     * Reverts if the agent does not exist.
     * @param agentID The ID of the agent to query.
     * @return agentAddress The address of the agent account.
     * @return implementationAddress The address of the agent implementation.
     */
    function getAgentInfo(uint256 agentID) external view override returns (
        address agentAddress,
        address implementationAddress
    ) {
        _requireMinted(agentID);
        AgentInfo memory agentinfo = _agentInfo[agentID];
        agentAddress = agentinfo.agentAddress;
        implementationAddress = agentinfo.implementationAddress;
    }

    /**
     * @notice Returns the ID of an agent given its address.
     * Returns ID 0 if the address is not an agent.
     * @param agentAddress The address of the agent to query.
     * @return agentID The ID of the agent.
     */
    function getAgentID(address agentAddress) external view override returns (uint256 agentID) {
        agentID = _agentAddressToID[agentAddress];
    }

    /**
     * @notice Given the address of the agent, returns if it is a known agent.
     * @param agentAddress The address of the agent to query.
     * @return isAgent True if is a known agent, false otherwise.
     */
    function isAddressAgent(address agentAddress) external view override returns (bool isAgent) {
        uint256 agentID = _agentAddressToID[agentAddress];
        isAgent = agentID > 0;
    }

    /**
     * @notice Returns true if the agent exists.
     * @param agentID The ID of the agent to query.
     * @return status True if the agent exists, false otherwise.
     */
    function exists(uint256 agentID) external view override returns (bool status) {
        status = _exists(agentID);
    }

    /**
     * @notice Returns the address of the ERC6551 registry.
     * @return registry_ The address of the registry.
     */
    function getERC6551Registry() external view override returns (address registry_) {
        registry_ = _erc6551Registry;
    }

    /***************************************
    CREATE AGENT FUNCTIONS
    ***************************************/

    /**
     * @notice Creates a new agent.
     * @dev The new agent will be minted to `msg.sender`. This function is designed to be called from another contract to perform additional setup.
     * @param implementation The address of the implementation to use in the new agent.
     * @return agentID The ID of the newly created agent.
     * @return agentAddress The address of the newly created agent.
     */
    function createAgent(
        address implementation
    ) external payable override returns (
        uint256 agentID,
        address agentAddress
    ) {
        // msg.sender must be whitelisted
        if(!(_factoryIsWhitelisted[address(0)]||_factoryIsWhitelisted[msg.sender])) revert Errors.FactoryNotWhitelisted();
        // calculate agentID. autoincrement from 1
        agentID = totalSupply() + 1;
        // mint nft
        _mint(msg.sender, agentID);
        // combine many sources of randomness for address salt
        uint256 chainid = block.chainid;
        bytes32 salt = keccak256(abi.encode(agentID, implementation, chainid, block.number, block.timestamp, blockhash(block.number), tx.origin, gasleft()));
        // use erc6551 to create and register the account
        agentAddress = IERC6551Registry(_erc6551Registry).createAccount(
            implementation,
            salt,
            chainid,
            address(this),
            agentID
        );
        // store agent info
        _agentInfo[agentID].agentAddress = agentAddress;
        _agentInfo[agentID].implementationAddress = implementation;
        _agentAddressToID[agentAddress] = agentID;
    }

    /***************************************
    WHITELIST FUNCTIONS
    ***************************************/

    /**
     * @notice Returns true if the factory has been whitelisted.
     * All addresses are whitelisted if address zero is whitelisted.
     * @param factory The address of the factory to query.
     * @return isWhitelisted True if the factory has been whitelisted, false otherwise.
     */
    function factoryIsWhitelisted(address factory) external view override returns (bool isWhitelisted) {
        isWhitelisted = _factoryIsWhitelisted[factory];
    }

    /**
     * @notice Adds or removes factories to the whitelist.
     * Can only be called by the contract owner.
     * @param params The list of factories and if they should be whitelisted or blacklisted.
     */
    function setWhitelist(SetWhitelistParam[] memory params) external payable override onlyOwner {
        for(uint256 i = 0; i < params.length; ) {
            address factory = params[i].factory;
            bool shouldWhitelist = params[i].shouldWhitelist;
            _factoryIsWhitelisted[factory] = shouldWhitelist;
            emit FactoryWhitelisted(factory, shouldWhitelist);
            unchecked { ++i; }
        }
    }

    /***************************************
    METADATA FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the Uniform Resource Identifier (URI) for `agentID` token.
     * Reverts if the token does not exist.
     * @param agentID The ID of the pool to query.
     * @return uri The token uri.
     */
    function tokenURI(uint256 agentID) public view override returns (string memory uri) {
        _requireMinted(agentID);
        uri = string(abi.encodePacked(_tokenURIbase, Strings.toString(agentID)));
    }

    /**
     * @notice Returns the base URI for computing tokenURI.
     * @return uri The base URI.
     */
    function baseURI() external view override returns (string memory uri) {
        uri = _tokenURIbase;
    }

    /**
     * @notice Sets the base URI for computing tokenURI.
     * Can only be called by the contract owner.
     * @param uri The new base URI.
     */
    function setBaseURI(string calldata uri) external payable override onlyOwner {
        _tokenURIbase = uri;
        emit BaseURISet(uri);
    }

    /**
     * @notice Returns the contract URI.
     * @return uri The contract URI.
     */
    function contractURI() external view override returns (string memory uri) {
        uri = _contractURI;
    }

    /**
     * @notice Sets the contract URI.
     * Can only be called by the contract owner.
     * @param uri The new contract URI.
     */
    function setContractURI(string calldata uri) external payable override onlyOwner {
        _contractURI = uri;
        emit ContractURISet(uri);
    }

    /***************************************
    ERC721 HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Returns true if the agent exists.
     * @param agentID The ID of the agent to query.
     * @return status True if the agent exists, false otherwise.
     */
    function _exists(uint256 agentID) internal view returns (bool status) {
        status = (_ownerOf(agentID) != address(0));
    }

    /**
     * @notice Reverts if the `agentID` has not been minted yet.
     * @param agentID The ID of the agent to query.
     */
    function _requireMinted(uint256 agentID) internal view {
        if(!_exists(agentID)) revert Errors.AgentDoesNotExist();
    }
}
