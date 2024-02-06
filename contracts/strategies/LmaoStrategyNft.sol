// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "./../examples/scrollPass/interfaces/IERC6551Registry.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./../utils/Errors.sol";

contract LmaoStrategyNft is Ownable2Step, ERC721Enumerable {

    /// @notice Emitted when a factory is whitelisted or blacklisted.
    event FactoryWhitelisted(address indexed factory, bool wasWhitelisted);
    /// @notice Emitted when the base URI is set.
    event BaseURISet(string baseURI);
    /// @notice Emitted when the contract URI is set.
    event ContractURISet(string contractURI);

    mapping(address => bool) internal _factoryIsWhitelisted;

    struct StrategyInfo {
        address strategyAddress;
        address implementationAddress;
    }
    mapping(uint256 => StrategyInfo) internal _strategyInfo;
    mapping(address => uint256) internal _strategyAddressToID;

    address internal _erc6551Registry;

    // uri data

    string internal _tokenURIbase;
    string internal _contractURI;

    constructor(
        address erc6551Registry_,
        address owner_
    ) ERC721("LmaoStrategyNft", "STRATEGY") Ownable(owner_) {
        _erc6551Registry = erc6551Registry_;
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the address of a strategy.
     * Reverts if the strategy does not exist.
     * @param strategyID The ID of the strategy to query.
     * @return strategyAddress The address of the strategy account.
     * @return implementationAddress The address of the strategy implementation.
     */
    function getStrategyInfo(uint256 strategyID) external view returns (
        address strategyAddress,
        address implementationAddress
    ) {
        _requireMinted(strategyID);
        StrategyInfo memory strategyinfo = _strategyInfo[strategyID];
        strategyAddress = strategyinfo.strategyAddress;
        implementationAddress = strategyinfo.implementationAddress;
    }

    /**
     * @notice Returns the ID of a strategy given its address.
     * Returns ID 0 if the address is not a strategy.
     * @param strategyAddress The address of the strategy to query.
     * @return strategyID The ID of the strategy.
     */
    function getStrategyID(address strategyAddress) external view returns (uint256 strategyID) {
        strategyID = _strategyAddressToID[strategyAddress];
    }

    /**
     * @notice Given the address of the strategy, returns if it is a known strategy.
     * @param strategyAddress The address of the strategy to query.
     * @return isStrategy True if is a known strategy, false otherwise.
     */
    function isAddressStrategy(address strategyAddress) external view returns (bool isStrategy) {
        uint256 strategyID = _strategyAddressToID[strategyAddress];
        isStrategy = strategyID > 0;
    }

    /**
     * @notice Returns true if the strategy exists.
     * @param strategyID The ID of the strategy to query.
     * @return status True if the strategy exists, false otherwise.
     */
    function exists(uint256 strategyID) external view returns (bool status) {
        status = _exists(strategyID);
    }

    /**
     * @notice Returns the address of the ERC6551 registry.
     * @return registry_ The address of the registry.
     */
    function getERC6551Registry() external view returns (address registry_) {
        registry_ = _erc6551Registry;
    }

    /***************************************
    CREATE STRATEGY FUNCTIONS
    ***************************************/

    /**
     * @notice Creates a new strategy.
     * @dev The new strategy will be minted to `msg.sender`. This function is designed to be called from another contract to perform additional setup.
     * @param implementation The address of the implementation to use in the new strategy.
     * @return strategyID The ID of the newly created strategy.
     * @return strategyAddress The address of the newly created strategy.
     */
    function createStrategy(
        address implementation
    ) external returns (
        uint256 strategyID,
        address strategyAddress
    ) {
        // msg.sender must be whitelisted
        if(!(_factoryIsWhitelisted[address(0)]||_factoryIsWhitelisted[msg.sender])) revert FactoryNotWhitelisted();
        // calculate strategyID. autoincrement from 1
        strategyID = totalSupply() + 1;
        // mint nft
        _mint(msg.sender, strategyID);
        // combine many sources of randomness for address salt
        uint256 chainid = block.chainid;
        bytes32 salt = keccak256(abi.encode(strategyID, implementation, chainid, block.number, block.timestamp, blockhash(block.number), tx.origin, gasleft()));
        // use erc6551 to create and register the account
        strategyAddress = IERC6551Registry(_erc6551Registry).createAccount(
            implementation,
            salt,
            chainid,
            address(this),
            strategyID
        );
        // store strategy info
        _strategyInfo[strategyID].strategyAddress = strategyAddress;
        _strategyInfo[strategyID].implementationAddress = implementation;
        _strategyAddressToID[strategyAddress] = strategyID;
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
     * @notice Returns the Uniform Resource Identifier (URI) for `strategyID` token.
     * Reverts if the token does not exist.
     * @param strategyID The ID of the pool to query.
     * @return uri The token uri.
     */
    function tokenURI(uint256 strategyID) public view override returns (string memory uri) {
        _requireMinted(strategyID);
        uri = string(abi.encodePacked(_tokenURIbase, Strings.toString(strategyID)));
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
     * @notice Returns true if the strategy exists.
     * @param strategyID The ID of the strategy to query.
     * @return status True if the strategy exists, false otherwise.
     */
    function _exists(uint256 strategyID) internal view returns (bool status) {
        status = (_ownerOf(strategyID) != address(0));
    }

    /**
     * @notice Reverts if the `strategyID` has not been minted yet.
     * @param strategyID The ID of the strategy to query.
     */
    function _requireMinted(uint256 strategyID) internal view {
        if(!_exists(strategyID)) revert TokenDoesNotExist();
    }
}
