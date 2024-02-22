// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title RevertModule
 * @author AgentFi
 * @notice A module containing functions that revert.
 *
 * Used to test how Diamond handles calls that revert.
 */
contract RevertModule {

    error RevertWithReason();

    /**
     * @notice Reverts with a reason.
     */
    function revertWithReason() external pure {
        revert RevertWithReason();
    }

    /**
     * @notice Reverts without a reason.
     */
    function revertWithoutReason() external pure {
        revert();
    }
}
