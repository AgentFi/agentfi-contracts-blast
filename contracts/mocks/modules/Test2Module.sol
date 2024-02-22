// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title Test2Module
 * @author AgentFi
 * @notice A module used to test diamonds.
 */
contract Test2Module {

    /// @notice Emitted when any function is called.
    event Test2Event(uint256 funcNum);

    /// @notice A test function.
    function testFunc1() external payable {
        emit Test2Event(1);
    }

    /// @notice A test function.
    function testFunc2() external payable {
        emit Test2Event(2);
    }

    /// @notice A test function.
    function testFunc3() external payable {
        emit Test2Event(3);
    }
}
