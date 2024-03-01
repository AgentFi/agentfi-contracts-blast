// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { Multicall } from "./../utils/Multicall.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IAgents } from "./../interfaces/tokens/IAgents.sol";
import { IBlastooorGenesisFactory } from "./../interfaces/factory/IBlastooorGenesisFactory.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { Ownable2Step } from "./../utils/Ownable2Step.sol";


/**
 * @title BlastooorGenesisFactory
 * @author AgentFi
 * @notice A factory for agents.
 *
 * Users can use [`createAgent()`](#createagent) to create a new agent. The agent will be created based on settings stored in the factory by the contract owner. These settings can be viewed via [`getAgentCreationSettings()`](#getagentcreationsettings).
 */
contract BlastooorGenesisFactory is Multicall, Blastable, Ownable2Step, IBlastooorGenesisFactory, EIP712 {

    /***************************************
    STATE VARIABLES
    ***************************************/

    address internal _agentNft;
    AgentCreationSettings internal _agentCreationSettings;

    uint256 internal _allowlistMintedTotal;
    mapping(address => uint256) internal _allowlistMintedByAccount;

    bytes32 internal _MINT_FROM_ALLOWLIST_TYPEHASH = keccak256("MintFromAllowlist(address receiver)");

    /// @notice The authorized signers.
    mapping(address => bool) internal _isAuthorizedSigner;

    uint256 internal constant MAX_TOTAL_SUPPLY = 6551;
    uint256 internal constant MAX_ALLOWLIST_MINT_TOTAL = 1200;
    uint256 internal constant MAX_ALLOWLIST_MINT_PER_ACCOUNT = 2;
    uint256 internal constant MAX_MINT_PER_TX = 10;

    /***************************************
    CONSTRUCTOR
    ***************************************/

    /**
     * @notice Constructs the factory contract.
     * @param owner_ The owner of the contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param governor_ The address of the gas governor.
     * @param agentNft The Agents contract.
     */
    constructor(
        address owner_,
        address blast_,
        address governor_,
        address agentNft
    ) Blastable(blast_, governor_) EIP712("AgentFi-BlastooorGenesisFactory", "1") {
        _transferOwnership(owner_);
        _agentNft = agentNft;
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Gets the agent creation settings.
     * @return agentNft The Agents contract.
     * @return agentImplementation The agent implementation.
     * @return initializationCalls The calls to initialize the agent.
     * @return isActive True if these creation settings are active, false otherwise.
     * @return paymentToken The address of the token to pay with.
     * @return paymentAmount The amount of the token to pay.
     * @return paymentReceiver The receiver of the payment.
     */
    function getAgentCreationSettings() external view override returns (
        address agentNft,
        address agentImplementation,
        bytes[] memory initializationCalls,
        bool isActive,
        address paymentToken,
        uint256 paymentAmount,
        address paymentReceiver,
        uint256 mintStartTime,
        uint256 allowlistStopTime
    ) {
        agentNft = _agentNft;
        AgentCreationSettings memory creationSettings = _agentCreationSettings;
        agentImplementation = creationSettings.agentImplementation;
        initializationCalls = creationSettings.initializationCalls;
        isActive = creationSettings.isActive;
        paymentToken = creationSettings.paymentToken;
        paymentAmount = creationSettings.paymentAmount;
        paymentReceiver = creationSettings.paymentReceiver;
        mintStartTime = creationSettings.mintStartTime;
        allowlistStopTime = creationSettings.allowlistStopTime;
    }

    function allowlistMintedTotal() external view returns (uint256 amount) {
        amount = _allowlistMintedTotal;
    }

    function allowlistMintedTotal(address account) external view returns (uint256 amount) {
        amount = _allowlistMintedByAccount[account];
    }

    function isAuthorizedSigner(address account) external view returns (bool isAuthorized) {
        isAuthorized = _isAuthorizedSigner[account];
    }

    /***************************************
    CREATE AGENT FUNCTIONS
    ***************************************/

    /**
     * @notice Creates new agents.
     * The new agents will be transferred to `msg.sender`.
     * @param count The number of agents to create.
     * @return info Information about the newly created agents.
     */
    function blastooorPublicMint(uint256 count) external payable returns (AgentInfo[] memory info) {
        IAgents agentNft = IAgents(_agentNft);
        _createBlastooorChecks(agentNft, count);
        _handlePayment(count);
        info = _createBlastooor(agentNft, count);
    }

    /**
     * @notice Creates new agents. The
     * The new agents will be transferred to `msg.sender`.
     * @param count The number of agents to create.
     * @param signature Signature from the signer.
     * @return info Information about the newly created agents.
     */
    function blastooorMintWithAllowlist(uint256 count, bytes calldata signature) external payable returns (AgentInfo[] memory info) {
        IAgents agentNft = IAgents(_agentNft);
        _createBlastooorChecks(agentNft, count);
        _createBlastooorCheckAllowlist(agentNft, count, signature);
        _handlePayment(count);
        info = _createBlastooor(agentNft, count);
    }

    /**
     * @notice Creates new agents. The
     * The new agents will be transferred to `msg.sender`.
     * @param countAllowlist The number of agents to create via the allowlist.
     * @param countPublic The number of agents to create via public mint.
     * @param signature Signature from the signer.
     * @return info Information about the newly created agents.
     */
    function blastooorMintWithAllowlistAndPublic(uint256 countAllowlist, uint256 countPublic, bytes calldata signature) external payable returns (AgentInfo[] memory info) {
        IAgents agentNft = IAgents(_agentNft);
        uint256 count = countAllowlist + countPublic;
        _createBlastooorChecks(agentNft, count);
        _createBlastooorCheckAllowlist(agentNft, countAllowlist, signature);
        _handlePayment(count);
        info = _createBlastooor(agentNft, count);
    }

    /***************************************
    HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice A set of checks before minting.
     * @param agentNft The agent nft contract.
     * @param count The number of agents to create.
     */
    function _createBlastooorChecks(
        IAgents agentNft,
        uint256 count
    ) internal {
        if(count == 0) revert Errors.AmountZero();
        if(count > MAX_MINT_PER_TX) revert Errors.OverMaxMintPerTx();
        AgentCreationSettings storage creationSettings = _agentCreationSettings;
        if(!creationSettings.isActive) revert Errors.CreationSettingsPaused();
        uint256 supply = agentNft.totalSupply();
        if(supply + count > MAX_TOTAL_SUPPLY) revert Errors.OverMaxSupply();
        if(creationSettings.mintStartTime > block.timestamp) revert Errors.MintNotStarted();
    }

    /**
     * @notice A set of checks before minting from the allowlist.
     * @param agentNft The agent nft contract.
     * @param count The number of agents to create.
     * @param signature Signature from the signer.
     */
    function _createBlastooorCheckAllowlist(
        IAgents agentNft,
        uint256 count,
        bytes calldata signature
    ) internal {
        AgentCreationSettings storage creationSettings = _agentCreationSettings;
        // check time
        if(creationSettings.allowlistStopTime < block.timestamp) revert Errors.AllowlistMintEnded();
        // check mint total
        uint256 mintedTotal = _allowlistMintedTotal;
        mintedTotal += count;
        if(mintedTotal > MAX_ALLOWLIST_MINT_TOTAL) revert Errors.OverMaxAllowlistMintTotal();
        _allowlistMintedTotal = mintedTotal;
        // check mint by account
        uint256 mintedByAccount = _allowlistMintedByAccount[msg.sender];
        mintedByAccount += count;
        if(mintedByAccount > MAX_ALLOWLIST_MINT_PER_ACCOUNT) revert Errors.OverMaxAllowlistMintPerAccount();
        _allowlistMintedByAccount[msg.sender] = mintedByAccount;
        // verify signature
        bytes32 structHash = keccak256(abi.encode(_MINT_FROM_ALLOWLIST_TYPEHASH, msg.sender));
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, signature);
        if(!_isAuthorizedSigner[signer]) revert Errors.InvalidSignature();
    }

    /**
     * @notice Handles payment to creates a new agent.
     * @param count The number of agents to create.
     */
    function _handlePayment(
        uint256 count
    ) internal {
        AgentCreationSettings storage creationSettings = _agentCreationSettings;
        address paymentToken = creationSettings.paymentToken;
        uint256 paymentAmount = creationSettings.paymentAmount * count;
        if(paymentToken == address(0)) {
            Calls.sendValue(creationSettings.paymentReceiver, paymentAmount);
        } else {
            SafeERC20.safeTransferFrom(IERC20(paymentToken), msg.sender, address(this), paymentAmount);
            SafeERC20.safeTransfer(IERC20(paymentToken), creationSettings.paymentReceiver, paymentAmount);
        }
    }

    /**
     * @notice Creates a new agent.
     * @param agentNft The agent nft contract.
     * @param count The number of agents to create.
     * @return info Information about the newly created agents.
     */
    function _createBlastooor(
        IAgents agentNft,
        uint256 count
    ) internal returns (AgentInfo[] memory info) {
        AgentCreationSettings storage creationSettings = _agentCreationSettings;
        info = new AgentInfo[](count);
        address agentImplementation = creationSettings.agentImplementation;
        bytes[] memory initializationCalls = creationSettings.initializationCalls;
        for(uint256 i = 0; i < count; ++i) {
            (uint256 agentID, address agentAddress) = agentNft.createAgent(agentImplementation);
            info[i].agentID = agentID;
            info[i].agentAddress = agentAddress;
            // initialize
            for(uint256 j = 0; j < initializationCalls.length; ++j) {
                _callAgent(agentAddress, initializationCalls[j]);
            }
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
    ) external payable onlyOwner returns (
        uint256 creationSettingsID
    ) {
        // checks
        Calls.verifyHasCode(creationSettings.agentImplementation);
        // post
        _agentCreationSettings = creationSettings;
        emit AgentCreationSettingsPosted();
    }

    /**
     * @notice Adds a new signer that can authorize claims.
     * Can only be called by the contract owner.
     * @param signer The signer to add.
     */
    function addSigner(address signer) external payable onlyOwner {
        require(signer != address(0x0), "zero address signer");
        _isAuthorizedSigner[signer] = true;
        emit SignerAdded(signer);
    }

    /**
     * @notice Removes a signer.
     * Can only be called by the contract owner.
     * @param signer The signer to remove.
     */
    function removeSigner(address signer) external payable onlyOwner {
        _isAuthorizedSigner[signer] = false;
        emit SignerRemoved(signer);
    }
}
