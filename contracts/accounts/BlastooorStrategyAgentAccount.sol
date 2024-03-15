// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { BlastooorStrategyAccountBase } from "./BlastooorStrategyAccountBase.sol";
import { Errors } from "./../libraries/Errors.sol";
import { BlastableLibrary } from "./../libraries/BlastableLibrary.sol";
import { AccessControlLibrary } from "./../libraries/AccessControlLibrary.sol";
import { IBlastooorStrategyAgentAccount } from "./../interfaces/accounts/IBlastooorStrategyAgentAccount.sol";
import { IBlast } from "./../interfaces/external/Blast/IBlast.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { LibExecutor } from "./../lib/LibExecutor.sol";


/**
 * @title BlastooorStrategyAgentAccount
 * @author AgentFi
 * @notice An account type used by agents. Built on top of Tokenbound BlastooorStrategyAccountBase.
 *
 * Different functions within and across TBAs require different access control lists. Many of these functions are limited to just the TBA owner or its root owner. Some implementations allow a permissioned user to assume owner permissions. Role based access control allows the owner to grant and revoke access to a subset of protected functions as they see fit.
 *
 * Also comes with some features that integrate the accounts with the Blast ecosystem. The factory configures the account to automatically collect Blast yield and gas rewards on deployment. The TBA owner can claim these gas rewards with [`claimAllGas()`](#claimallgas) or [`claimMaxGas()`](#claimmaxgas). The rewards can also be quoted offchain with [`quoteClaimAllGas()`](#quoteclaimallgas) or [`quoteClaimMaxGas()`](#quoteclaimmaxgas).
 */
contract BlastooorStrategyAgentAccount is BlastooorStrategyAccountBase, Blastable, IBlastooorStrategyAgentAccount {

    /***************************************
    STATE VARIABLES
    ***************************************/

    /// @notice The role for strategy managers.
    bytes32 public constant STRATEGY_MANAGER_ROLE = keccak256("STRATEGY_MANAGER_ROLE");

    /***************************************
    CONSTRUCTOR
    ***************************************/

    /**
     * @notice Constructs the BlastooorStrategyAgentAccount contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param governor_ The address of the gas governor.
     * @param blastPoints_ The address of the blast points contract.
     * @param pointsOperator_ The address of the blast points operator.
     * @param entryPoint_ The ERC-4337 EntryPoint address.
     * @param multicallForwarder The MulticallForwarder address.
     * @param erc6551Registry The ERC-6551 Registry address.
     * @param _guardian The AccountGuardian address.
     */
    constructor(
        address blast_,
        address governor_,
        address blastPoints_,
        address pointsOperator_,
        address entryPoint_,
        address multicallForwarder,
        address erc6551Registry,
        address _guardian
    ) Blastable(blast_, governor_, blastPoints_, pointsOperator_) BlastooorStrategyAccountBase(entryPoint_, multicallForwarder, erc6551Registry, _guardian) {}

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
        _verifySenderIsValidExecutorOrHasRole(STRATEGY_MANAGER_ROLE);
        _verifyIsUnlocked();
        _updateState();
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
     * @notice Precheck for all execute by strategy manager calls.
     */
    function _strategyManagerPrecheck() internal {
        _verifySenderIsValidExecutorOrHasRole(STRATEGY_MANAGER_ROLE);
        _verifyIsUnlocked();
        _updateState();
        _beforeExecute();
    }

    /***************************************
    GAS REWARD CLAIM FUNCTIONS
    ***************************************/

    /**
     * @notice Claims all gas from the blast gas reward contract.
     * Can only be called by a valid executor or role owner for this TBA.
     * @return amountClaimed The amount of gas claimed.
     */
    function claimAllGas() external payable override returns (uint256 amountClaimed) {
        // checks
        _verifySenderIsValidExecutorOrHasRole(STRATEGY_MANAGER_ROLE);
        _verifyIsUnlocked();
        _updateState();
        // effects
        amountClaimed = IBlast(blast()).claimAllGas(address(this), address(this));
    }

    /**
     * @notice Claims max gas from the blast gas reward contract.
     * Can only be called by a valid executor or role owner for this TBA.
     * @return amountClaimed The amount of gas claimed.
     */
    function claimMaxGas() external payable override returns (uint256 amountClaimed) {
        // checks
        _verifySenderIsValidExecutorOrHasRole(STRATEGY_MANAGER_ROLE);
        _verifyIsUnlocked();
        _updateState();
        // effects
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
        try BlastooorStrategyAgentAccount(payable(address(this))).quoteClaimAllGasWithRevert() {}
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
        try BlastooorStrategyAgentAccount(payable(address(this))).quoteClaimMaxGasWithRevert() {}
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
    RECEIVE
    ***************************************/

    /**
     * @notice Allows this contract to receive the gas token.
     */
    // solhint-disable-next-line no-empty-blocks
    receive() external payable override (BlastooorStrategyAccountBase,Blastable) virtual {
        _handleOverride();
    }
}
