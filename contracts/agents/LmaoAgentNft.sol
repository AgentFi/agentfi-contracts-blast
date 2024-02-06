// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "./../examples/scrollPass/interfaces/IERC6551Registry.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./../utils/Errors.sol";

contract LmaoAgentNft is Ownable2Step, ERC721Enumerable {

    /// @notice Emitted when a factory is whitelisted or blacklisted.
    event FactoryWhitelisted(address indexed factory, bool wasWhitelisted);
    /// @notice Emitted when the base URI is set.
    event BaseURISet(string baseURI);
    /// @notice Emitted when the contract URI is set.
    event ContractURISet(string contractURI);

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

    constructor(
        address erc6551Registry_,
        address owner_
    ) ERC721("LmaoAgentNft", "AGENT") Ownable(owner_) {
        _erc6551Registry = erc6551Registry_;
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the address of a agent.
     * Reverts if the agent does not exist.
     * @param agentID The ID of the agent to query.
     * @return agentAddress The address of the agent account.
     * @return implementationAddress The address of the agent implementation.
     */
    function getAgentInfo(uint256 agentID) external view returns (
        address agentAddress,
        address implementationAddress
    ) {
        _requireMinted(agentID);
        AgentInfo memory agentinfo = _agentInfo[agentID];
        agentAddress = agentinfo.agentAddress;
        implementationAddress = agentinfo.implementationAddress;
    }

    /**
     * @notice Returns the ID of a agent given its address.
     * Returns ID 0 if the address is not a agent.
     * @param agentAddress The address of the agent to query.
     * @return agentID The ID of the agent.
     */
    function getAgentID(address agentAddress) external view returns (uint256 agentID) {
        agentID = _agentAddressToID[agentAddress];
    }

    /**
     * @notice Given the address of the agent, returns if it is a known agent.
     * @param agentAddress The address of the agent to query.
     * @return isAgent True if is a known agent, false otherwise.
     */
    function isAddressAgent(address agentAddress) external view returns (bool isAgent) {
        uint256 agentID = _agentAddressToID[agentAddress];
        isAgent = agentID > 0;
    }

    /**
     * @notice Returns true if the agent exists.
     * @param agentID The ID of the agent to query.
     * @return status True if the agent exists, false otherwise.
     */
    function exists(uint256 agentID) external view returns (bool status) {
        status = _exists(agentID);
    }

    /**
     * @notice Returns the address of the ERC6551 registry.
     * @return registry_ The address of the registry.
     */
    function getERC6551Registry() external view returns (address registry_) {
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
    ) external returns (
        uint256 agentID,
        address agentAddress
    ) {
        // msg.sender must be whitelisted
        if(!(_factoryIsWhitelisted[address(0)]||_factoryIsWhitelisted[msg.sender])) revert FactoryNotWhitelisted();
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
    function factoryIsWhitelisted(address factory) external view returns (bool isWhitelisted) {
        isWhitelisted = _factoryIsWhitelisted[factory];
    }

    struct SetWhitelistParam {
        address factory;
        bool shouldWhitelist;
    }

    /**
     * @notice Adds or removes factories to the whitelist.
     * Can only be called by the contract owner.
     * @param params The list of factories and if they should be whitelisted or blacklisted.
     */
    function setWhitelist(SetWhitelistParam[] memory params) external onlyOwner {
        for(uint256 i; i < params.length; ) {
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
    function baseURI() external view returns (string memory uri) {
        uri = _tokenURIbase;
    }

    /**
     * @notice Sets the base URI for computing tokenURI.
     * Can only be called by the contract owner.
     * @param uri The new base URI.
     */
    function setBaseURI(string calldata uri) external payable onlyOwner {
        _tokenURIbase = uri;
        emit BaseURISet(uri);
    }

    /**
     * @notice Returns the contract URI.
     * @return uri The contract URI.
     */
    function contractURI() external view returns (string memory uri) {
        uri = _contractURI;
    }

    /**
     * @notice Sets the contract URI.
     * Can only be called by the contract owner.
     * @param uri The new contract URI.
     */
    function setContractURI(string calldata uri) external payable onlyOwner {
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
        if(!_exists(agentID)) revert TokenDoesNotExist();
    }
}
