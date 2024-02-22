// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IMulticall
 * @author AgentFi
 * @notice Provides a function to batch together multiple calls in a single external call.
 */
interface IMulticall {

    /**
     * @notice Receives and executes a batch of function calls on this contract.
     * @param data A list of function calls to execute.
     * @return results The results of each function call.
     */
    function multicall(bytes[] calldata data) external payable returns (bytes[] memory results);
}
