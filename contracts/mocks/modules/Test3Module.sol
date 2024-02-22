// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title Test3Module
 * @author AgentFi
 * @notice A module used to test diamonds.
 */
contract Test3Module {

    /// @notice Emitted when any function is called.
    event Test3Event(uint256 funcNum);

    /// @notice A test function.
    function testFunc4() external payable {
        emit Test3Event(4);
    }
}
