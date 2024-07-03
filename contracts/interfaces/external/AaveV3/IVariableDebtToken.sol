// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

/**
 * @title IVariableDebtToken
 * @author Aave
 * @notice Defines the basic interface for a variable debt token.
 */
interface IVariableDebtToken {
    function approveDelegation(address delegatee, uint256 amount) external;
}
