// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IExplorerAgentAccount
 * @author AgentFi
 * @notice An account type used by agents.
 *
 * These accounts build on top of Tokenbound's AccountV3 with two key additions.
 *
 * The first is role based access control. Different functions within and across TBAs require different access control lists. Many of these functions are limited to just the TBA owner or its root owner. Some implementations allow a permissioned user to assume owner permissions. Role based access control allows the owner to grant and revoke access to a subset of protected functions as they see fit.
 *
 * Also comes with some features that integrate the accounts with the Blast ecosystem. The factory configures the account to automatically collect Blast yield and gas rewards on deployment. The TBA owner can claim these gas rewards with [`claimAllGas()`](#claimallgas) or [`claimMaxGas()`](#claimmaxgas). The rewards can also be quoted offchain with [`quoteClaimAllGas()`](#quoteclaimallgas) or [`quoteClaimMaxGas()`](#quoteclaimmaxgas).
*/
interface IExplorerAgentAccount {

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the AccountGuardian address.
     * @return guardian_ The AccountGuardian address.
     */
    function getGuardian() external view returns (address guardian_);

    /**
     * @notice Returns the address of the agent's implementation contract.
     * @return impl The implementation address.
     */
    function getAgentAccountImplementation() external view returns (address impl);

    /***************************************
    ACCESS CONTROL FUNCTIONS
    ***************************************/

    /// @notice Emitted when a role is granted or revoked.
    event RoleAccessChanged(bytes32 indexed role, address indexed account, bool accessGranted);

    /**
     * @notice Returns true if `account` has `role`.
     * @param role The role hash.
     * @param account The account to query.
     * @return hasRole_ True if account has the role, false otherwise.
     */
    function hasRole(bytes32 role, address account) external view returns (bool hasRole_);

    struct SetRolesParam {
        bytes32 role;
        address account;
        bool grantAccess;
    }

    /**
     * @notice Grants or revokes a set of roles.
     * Can only be called by a valid executor for this TBA.
     * @param params The list of roles to set.
     */
    function setRoles(SetRolesParam[] calldata params) external payable;

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    struct ExecuteByStrategyManagerParam {
        address to;
        bytes data;
    }

    struct ExecutePayableByStrategyManagerParam {
        address to;
        uint256 value;
        bytes data;
    }

    /**
     * @notice Executes an external call from this account.
     * Can only be called by an authorized executor or strategy manager.
     * @param params The call to execute.
     * @return result The result of the call.
     */
    function executeByStrategyManager(ExecuteByStrategyManagerParam calldata params) external payable returns (bytes memory result);

    /**
     * @notice Executes an external call from this account.
     * Can only be called by an authorized executor or strategy manager.
     * @param params The call to execute.
     * @return result The result of the call.
     */
    function executePayableByStrategyManager(ExecutePayableByStrategyManagerParam calldata params) external payable returns (bytes memory result);

    /**
     * @notice Executes a batch of external calls from this account.
     * Can only be called by an authorized executor or strategy manager.
     * @param params The calls to execute.
     * @return results The results of the calls.
     */
    function executeBatchByStrategyManager(ExecuteByStrategyManagerParam[] calldata params) external payable returns (bytes[] memory results);

    /**
     * @notice Executes a batch of external calls from this account.
     * Can only be called by an authorized executor or strategy manager.
     * @param params The calls to execute.
     * @return results The results of the calls.
     */
    function executePayableBatchByStrategyManager(ExecutePayableByStrategyManagerParam[] calldata params) external payable returns (bytes[] memory results);

    struct FunctionSetting {
        address implementation;
        bytes32 requiredRole;
    }

    struct FunctionParam {
        bytes4 selector;
        bytes32 requiredRole;
    }

    struct SetOverridesParam {
        address implementation;
        FunctionParam[] functionParams;
    }

    /**
     * @notice Sets the implementation address for a given array of function selectors.
     * Can only be called by an authorized executor or strategy manager.
     * @param params The overrides to add.
     */
    function setOverrides(SetOverridesParam[] calldata params) external payable;

    /***************************************
    MULTICALL
    ***************************************/

    /**
     * @notice Receives and executes a batch of function calls on this contract.
     * @param data A list of function calls to execute.
     * @return results The results of each function call.
     */
    function multicall(bytes[] calldata data) external payable returns (bytes[] memory results);

    /***************************************
    GAS REWARD CLAIM FUNCTIONS
    ***************************************/

    /**
     * @notice Configures the Blast ETH native yield, gas rewards, and Blast Points for this contract.
     */
    function blastConfigure() external payable;

    /**
     * @notice Claims all gas from the blast gas reward contract.
     * Can only be called by a valid executor or role owner for this TBA.
     * @return amountClaimed The amount of gas claimed.
     */
    function claimAllGas() external payable returns (uint256 amountClaimed);

    /**
     * @notice Claims max gas from the blast gas reward contract.
     * Can only be called by a valid executor or role owner for this TBA.
     * @return amountClaimed The amount of gas claimed.
     */
    function claimMaxGas() external payable returns (uint256 amountClaimed);

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
    function quoteClaimAllGas() external payable returns (uint256 quoteAmount);

    /**
     * @notice Quotes the amount of gas expected when claiming all gas.
     * This function will revert, including the amount in the error.
     * This _should_ only be called via [`quoteClaimAllGas()`](#quoteclaimallgas).
     */
    function quoteClaimAllGasWithRevert() external payable;

    /**
     * @notice Quotes the amount of gas expected when claiming max gas.
     * This _should_ be a view function, except that it relies on the state change then reverting it.
     * This _should_ be called with an offchain staticcall.
     * This _should not_ be called onchain.
     * Can be called by anyone.
     * @return quoteAmount The amount of gas that can be claimed.
     */
    function quoteClaimMaxGas() external payable returns (uint256 quoteAmount);

    /**
     * @notice Quotes the amount of gas expected when claiming max gas.
     * This function will revert, including the amount in the error.
     * This _should_ only be called via [`quoteClaimMaxGas()`](#quoteclaimmaxgas).
     */
    function quoteClaimMaxGasWithRevert() external payable;
}
