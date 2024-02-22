// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title FallbackModule
 * @author AgentFi
 * @notice A module used to test diamonds.
 */
contract FallbackModule {

    /// @notice Calls to this module will never fail.
    // solhint-disable-next-line no-empty-blocks
    fallback() external payable {}
}
