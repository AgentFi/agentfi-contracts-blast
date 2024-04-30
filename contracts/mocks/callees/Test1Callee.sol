// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title Test1Callee
 * @author AgentFi
 * @notice A contract used to test calls.
 */
contract Test1Callee {

    /// @notice Emitted when any function is called.
    event Test1Event(uint256 funcNum);

    /// @notice A test function.
    function testFunc1() external payable {
        emit Test1Event(1);
    }

    /// @notice A test function.
    function testFunc2() external payable {
        emit Test1Event(2);
    }

    /// @notice A test function.
    function testFunc3() external payable {
        emit Test1Event(3);
    }

    receive () external payable {
        emit Test1Event(999);
    }
}
