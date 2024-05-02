// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC6551AccountLib } from "erc6551/lib/ERC6551AccountLib.sol";
import { ERC6551AccountLibV2 } from "./../lib/ERC6551AccountLibV2.sol";
import { BlastooorStrategyAccountBase } from "./BlastooorStrategyAccountBase.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { BlastableLibrary } from "./../libraries/BlastableLibrary.sol";
import { AccessControlLibrary } from "./../libraries/AccessControlLibrary.sol";
import { IExplorerAgentAccount } from "./../interfaces/accounts/IExplorerAgentAccount.sol";
import { IBlast } from "./../interfaces/external/Blast/IBlast.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { LibExecutor } from "./../lib/LibExecutor.sol";
import { IERC6551Account } from "erc6551/interfaces/IERC6551Account.sol";
import { OPAddressAliasHelper } from "./../lib/OPAddressAliasHelper.sol";


/**
 * @title ExplorerAgentAccount
 * @author AgentFi
 * @notice An account type used by agents. Built on top of Tokenbound AccountV3.
 *
 * Different functions within and across TBAs require different access control lists. Many of these functions are limited to just the TBA owner or its root owner. Some implementations allow a permissioned user to assume owner permissions. Role based access control allows the owner to grant and revoke access to a subset of protected functions as they see fit.
 *
 * Also comes with some features that integrate the accounts with the Blast ecosystem. The factory configures the account to automatically collect Blast yield and gas rewards on deployment. The TBA owner can claim these gas rewards with [`claimAllGas()`](#claimallgas) or [`claimMaxGas()`](#claimmaxgas). The rewards can also be quoted offchain with [`quoteClaimAllGas()`](#quoteclaimallgas) or [`quoteClaimMaxGas()`](#quoteclaimmaxgas).
 */
contract ExplorerAgentAccount is BlastooorStrategyAccountBase, Blastable, IExplorerAgentAccount {

    /***************************************
    STATE VARIABLES
    ***************************************/

    /// @notice The role for strategy managers.
    bytes32 public constant STRATEGY_MANAGER_ROLE = keccak256("STRATEGY_MANAGER_ROLE");

    /// @notice mapping from selector => implementation, requiredRole
    mapping(bytes4 => FunctionSetting) public overrides;

    event OverrideUpdated(bytes4 indexed selector, address indexed implementation, bytes32 requiredRole);

    bool internal _isBlastConfigured;

    /***************************************
    CONSTRUCTOR
    ***************************************/

    /**
     * @notice Constructs the ExplorerAgentAccount contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param gasCollector_ The address of the gas collector.
     * @param blastPoints_ The address of the blast points contract.
     * @param pointsOperator_ The address of the blast points operator.
     * @param entryPoint_ The ERC-4337 EntryPoint address.
     * @param multicallForwarder The MulticallForwarder address.
     * @param erc6551Registry The ERC-6551 Registry address.
     * @param _guardian The AccountGuardian address.
     */
    constructor(
        address blast_,
        address gasCollector_,
        address blastPoints_,
        address pointsOperator_,
        address entryPoint_,
        address multicallForwarder,
        address erc6551Registry,
        address _guardian
    ) Blastable(blast_, gasCollector_, blastPoints_, pointsOperator_) BlastooorStrategyAccountBase(entryPoint_, multicallForwarder, erc6551Registry, _guardian) {}

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the AccountGuardian address.
     * @return guardian_ The AccountGuardian address.
     */
    function getGuardian() external view override returns (address guardian_) {
        guardian_ = address(guardian);
    }

    /**
     * @notice Returns the address of the agent's implementation contract.
     * @return impl The implementation address.
     */
    function getAgentAccountImplementation() external view override returns (address impl) {
        impl = __self;
    }

    /***************************************
    ACCESS CONTROL FUNCTIONS
    ***************************************/

    /**
     * @notice Returns true if `account` has `role`.
     * @param role The role hash.
     * @param account The account to query.
     * @return hasRole_ True if account has the role, false otherwise.
     */
    function hasRole(bytes32 role, address account) external view override returns (bool hasRole_) {
        hasRole_ = AccessControlLibrary.hasRole(role, account);
    }

    /**
     * @notice Grants or revokes a set of roles.
     * Can only be called by a valid executor for this TBA.
     * @param params The list of roles to set.
     */
    function setRoles(SetRolesParam[] calldata params) external payable override {
        _strategyManagerPrecheck();
        AccessControlLibrary.AccessControlLibraryStorage storage acls = AccessControlLibrary.accessControlLibraryStorage();
        for(uint256 i = 0; i < params.length; ++i) {
            bytes32 role = params[i].role;
            address account = params[i].account;
            bool grantAccess = params[i].grantAccess;
            acls.assignedRoles[role][account] = grantAccess;
            emit RoleAccessChanged(role, account, grantAccess);
        }
    }

    /**
     * @notice Reverts if `_msgSender()` is not a valid executor and does not have have `role`.
     * @param role The role that the sender should have.
     */
    function _verifySenderIsValidExecutorOrHasRole(bytes32 role) internal view virtual {
        address sender = _msgSender();
        if(AccessControlLibrary.hasRole(role, sender)) return;
        if(_isValidExecutor(sender)) return;
        revert Errors.NotAuthorized();
    }

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Executes an external call from this account.
     * Can only be called by an authorized executor or strategy manager.
     */
    function executeByStrategyManager(ExecuteByStrategyManagerParam calldata params) external payable virtual override returns (bytes memory result) {
        _strategyManagerPrecheck();
        result = LibExecutor._execute(params.to, 0, params.data, 0);
    }

    /**
     * @notice Executes an external call from this account.
     * Can only be called by an authorized executor or strategy manager.
     */
    function executePayableByStrategyManager(ExecutePayableByStrategyManagerParam calldata params) external payable virtual override returns (bytes memory result) {
        _strategyManagerPrecheck();
        result = LibExecutor._execute(params.to, params.value, params.data, 0);
    }

    /**
     * @notice Executes a batch of external calls from this account.
     * Can only be called by an authorized executor or strategy manager.
     */
    function executeBatchByStrategyManager(ExecuteByStrategyManagerParam[] calldata params) external payable virtual override returns (bytes[] memory results) {
        _strategyManagerPrecheck();
        results = new bytes[](params.length);
        for(uint256 i = 0; i < params.length; ++i) {
            results[i] = LibExecutor._execute(params[i].to, 0, params[i].data, 0);
        }
    }

    /**
     * @notice Executes a batch of external calls from this account.
     * Can only be called by an authorized executor or strategy manager.
     */
    function executePayableBatchByStrategyManager(ExecutePayableByStrategyManagerParam[] calldata params) external payable virtual override returns (bytes[] memory results) {
        _strategyManagerPrecheck();
        results = new bytes[](params.length);
        for(uint256 i = 0; i < params.length; ++i) {
            results[i] = LibExecutor._execute(params[i].to, params[i].value, params[i].data, 0);
        }
    }

    /**
     * @notice Sets the implementation address for a given array of function selectors.
     * Can only be called by an authorized executor or strategy manager.
     * @param params The overrides to add.
     */
    function setOverrides(SetOverridesParam[] calldata params) external payable virtual override {
        _strategyManagerPrecheck();
        for(uint256 i = 0; i < params.length; ++i) {
            address implementation = params[i].implementation;
            for(uint256 j = 0; j < params[i].functionParams.length; ++j) {
                bytes4 selector = params[i].functionParams[j].selector;
                bytes32 requiredRole = params[i].functionParams[j].requiredRole;
                overrides[selector] = FunctionSetting({
                    implementation: implementation,
                    requiredRole: requiredRole
                });
                emit OverrideUpdated(selector, implementation, requiredRole);
            }
        }
    }

    /**
     * @notice Precheck for all execute by strategy manager calls.
     */
    function _strategyManagerPrecheck() internal {
        _verifySenderIsValidExecutorOrHasRole(STRATEGY_MANAGER_ROLE);
        _beforeExecute();
    }

    /***************************************
    MULTICALL
    ***************************************/

    /**
     * @notice Receives and executes a batch of function calls on this contract.
     * @param data A list of function calls to execute.
     * @return results The results of each function call.
     */
    function multicall(bytes[] calldata data) external payable override returns (bytes[] memory results) {
        results = new bytes[](data.length);
        address sender = _msgSender();
        bool isForwarder = msg.sender != sender;
        for(uint256 i = 0; i < data.length; ++i) {
            if(isForwarder) {
                results[i] = Calls.functionDelegateCall(address(this), abi.encodePacked(data[i], sender));
            } else {
                results[i] = Calls.functionDelegateCall(address(this), data[i]);
            }
        }
    }

    /***************************************
    GAS REWARD CLAIM FUNCTIONS
    ***************************************/

    /**
     * @notice Configures the Blast ETH native yield, gas rewards, and Blast Points for this contract.
     */
    function blastConfigure() external payable override {
        // if this account has not yet been configured, allow anyone to configure it. should be configured by the factory
        // if this account has been configured, only allow someone authorized to call it
        if(_isBlastConfigured) _verifySenderIsValidExecutor();
        else _isBlastConfigured = true;
        _verifyIsUnlocked();
        _updateState();
        // configure
        __blast.call(abi.encodeWithSignature("configureAutomaticYield()"));
        __blast.call(abi.encodeWithSignature("configureClaimableGas()"));
        if(__pointsOperator != address(0)) __blastPoints.call(abi.encodeWithSignature("configurePointsOperator(address)", __pointsOperator));
    }

    /**
     * @notice Claims all gas from the blast gas reward contract.
     * Can only be called by a valid executor or role owner for this TBA.
     * @return amountClaimed The amount of gas claimed.
     */
    function claimAllGas() external payable override returns (uint256 amountClaimed) {
        _strategyManagerPrecheck();
        amountClaimed = IBlast(blast()).claimAllGas(address(this), address(this));
    }

    /**
     * @notice Claims max gas from the blast gas reward contract.
     * Can only be called by a valid executor or role owner for this TBA.
     * @return amountClaimed The amount of gas claimed.
     */
    function claimMaxGas() external payable override returns (uint256 amountClaimed) {
        _strategyManagerPrecheck();
        amountClaimed = IBlast(blast()).claimMaxGas(address(this), address(this));
    }

    /***************************************
    GAS REWARD QUOTE CLAIM FUNCTIONS
    ***************************************/

    /**
     * @notice Quotes the amount of gas expected when claiming all gas.
     * This _should_ be a view function, except that it relies on the state change then reverting it.
     * This _should_ be called with an offchain staticcall.
     * This _should not_ be called onchain.
     * Can be called by anyone.
     * @return quoteAmount The amount of gas that can be claimed.
     */
    function quoteClaimAllGas() external payable override virtual returns (uint256 quoteAmount) {
        try ExplorerAgentAccount(payable(address(this))).quoteClaimAllGasWithRevert() {}
        catch (bytes memory reason) {
            quoteAmount = BlastableLibrary.parseRevertReasonForAmount(reason);
        }
    }

    /**
     * @notice Quotes the amount of gas expected when claiming all gas.
     * This function will revert, including the amount in the error.
     * This _should_ only be called via [`quoteClaimAllGas()`](#quoteclaimallgas).
     */
    function quoteClaimAllGasWithRevert() external payable override virtual {
        uint256 quoteAmount = IBlast(blast()).claimAllGas(address(this), address(this));
        revert Errors.RevertForAmount(quoteAmount);
    }

    /**
     * @notice Quotes the amount of gas expected when claiming max gas.
     * This _should_ be a view function, except that it relies on the state change then reverting it.
     * This _should_ be called with an offchain staticcall.
     * This _should not_ be called onchain.
     * Can be called by anyone.
     * @return quoteAmount The amount of gas that can be claimed.
     */
    function quoteClaimMaxGas() external payable override virtual returns (uint256 quoteAmount) {
        try ExplorerAgentAccount(payable(address(this))).quoteClaimMaxGasWithRevert() {}
        catch (bytes memory reason) {
            quoteAmount = BlastableLibrary.parseRevertReasonForAmount(reason);
        }
    }

    /**
     * @notice Quotes the amount of gas expected when claiming max gas.
     * This function will revert, including the amount in the error.
     * This _should_ only be called via [`quoteClaimMaxGas()`](#quoteclaimmaxgas).
     */
    function quoteClaimMaxGasWithRevert() external payable override virtual {
        uint256 quoteAmount = IBlast(blast()).claimMaxGas(address(this), address(this));
        revert Errors.RevertForAmount(quoteAmount);
    }

    /***************************************
    OVERRIDES
    ***************************************/

    /**
     * @notice Delegatecalls into the implementation address using sandbox if override is set for the current
     * function selector. If an implementation is defined, this function will either revert or
     * return with the return value of the implementation.
     */
    function _handleOverride() internal virtual override {
        FunctionSetting memory settings = overrides[msg.sig];
        address implementation = settings.implementation;
        if(implementation != address(0)) {
            if(settings.requiredRole != bytes32(0)) _verifySenderIsValidExecutorOrHasRole(settings.requiredRole);
            _beforeExecute();
            (bool success, bytes memory result) = implementation.delegatecall(msg.data);
            assembly {
                if iszero(success) { revert(add(result, 32), mload(result)) }
                return(add(result, 32), mload(result))
            }
        }
    }

    /**
     * @notice Static calls into the implementation address if override is set for the current function
     * selector. If an implementation is defined, this function will either revert or return with
     * the return value of the implementation.
     */
    function _handleOverrideStatic() internal view virtual override {
        FunctionSetting memory settings = overrides[msg.sig];
        address implementation = settings.implementation;
        if(implementation != address(0)) {
            if(settings.requiredRole != bytes32(0)) _verifySenderIsValidExecutorOrHasRole(settings.requiredRole);
            (bool success, bytes memory result) = implementation.staticcall(msg.data);
            assembly {
                if iszero(success) { revert(add(result, 32), mload(result)) }
                return(add(result, 32), mload(result))
            }
        }
    }

    /***************************************
    RECEIVE
    ***************************************/

    /**
     * @notice Allows this contract to receive the gas token.
     */
    // solhint-disable-next-line no-empty-blocks
    receive() external payable override (BlastooorStrategyAccountBase,Blastable) virtual {
        _handleOverride();
    }

    /***************************************
    AUTHENTICATION HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Returns whether a given account is authorized to sign on behalf of this account
     *
     * @param signer The address to query authorization for
     * @return True if the signer is valid, false otherwise
     */
    function _isValidSigner(address signer, bytes memory)
        internal
        view
        virtual
        override
        returns (bool)
    {
        (uint256 chainId, address tokenContract, uint256 tokenId) = ERC6551AccountLib.token();

        // Single level account owner is valid signer
        address _owner = _tokenOwner(chainId, tokenContract, tokenId);
        if (signer == _owner) return true;

        // Allow signing from any ancestor in account tree
        while (ERC6551AccountLibV2.isERC6551Account(_owner, erc6551Registry)) {
            (chainId, tokenContract, tokenId) = IERC6551Account(payable(_owner)).token();
            _owner = _tokenOwner(chainId, tokenContract, tokenId);
            if (signer == _owner) return true;
        }

        // Accounts granted permission by root owner are valid signers
        return hasPermission(signer, _owner);
    }

    /**
     * @notice Returns whether a given account is authorized to execute transactions on behalf of
     * this account
     *
     * @param executor The address to query authorization for
     * @return True if the executor is authorized, false otherwise
     */
    function _isValidExecutor(address executor) internal view virtual override returns (bool) {
        // Allow execution from ERC-4337 EntryPoint
        if (executor == address(entryPoint())) return true;

        (uint256 chainId, address tokenContract, uint256 tokenId) = ERC6551AccountLib.token();

        // Allow cross chain execution
        if (chainId != block.chainid) {
            // Allow execution from L1 account on OPStack chains
            if (OPAddressAliasHelper.undoL1ToL2Alias(_msgSender()) == address(this)) {
                return true;
            }

            // Allow execution from trusted cross chain bridges
            if (guardian.isTrustedExecutor(executor)) return true;
        }

        // Allow execution from owner
        address _owner = _tokenOwner(chainId, tokenContract, tokenId);
        if (executor == _owner) return true;

        // Allow execution from any ancestor in account tree
        while (ERC6551AccountLibV2.isERC6551Account(_owner, erc6551Registry)) {
            (chainId, tokenContract, tokenId) = IERC6551Account(payable(_owner)).token();
            _owner = _tokenOwner(chainId, tokenContract, tokenId);
            if (executor == _owner) return true;
        }

        // Allow execution from permissioned account
        if (hasPermission(executor, _owner)) return true;

        return false;
    }
}
