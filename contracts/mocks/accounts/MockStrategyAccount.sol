// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./../../accounts/AccountV3WithAccessControl.sol"; // tokenbound base account contract

/**
 * @title MockStrategyAccount
 * @notice A mock TBA used to test other contracts.
 */
contract MockStrategyAccount is AccountV3WithAccessControl {

    /// @notice The role for strategy managers.
    bytes32 public constant STRATEGY_MANAGER_ROLE = keccak256("STRATEGY_MANAGER_ROLE");
    /// @notice Emitted when a strategy is managed.
    event StrategyManaged(uint256 num);

    constructor(
        address entryPoint_,
        address multicallForwarder,
        address erc6551Registry,
        address _guardian
    ) AccountV3WithAccessControl(entryPoint_, multicallForwarder, erc6551Registry, _guardian) {}

    /**
     * @notice Manages the strategy.
     * Can only be called by validated senders.
     * @param num An input to manage.
     */
    function manageStrategy(uint256 num) external {
        // checks
        _verifySenderIsValidExecutorOrHasRole(STRATEGY_MANAGER_ROLE);
        _verifyIsUnlocked();
        _updateState();
        // effects
        emit StrategyManaged(num);
    }
}
