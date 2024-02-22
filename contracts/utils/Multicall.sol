// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Calls } from "./../libraries/Calls.sol";
import { IMulticall } from "./../interfaces/utils/IMulticall.sol";


/**
 * @title Multicall
 * @author AgentFi
 * @notice Provides a function to batch together multiple calls in a single external call.
 */
abstract contract Multicall is IMulticall {

    /**
     * @notice Receives and executes a batch of function calls on this contract.
     * @param data A list of function calls to execute.
     * @return results The results of each function call.
     */
    function multicall(bytes[] calldata data) external payable virtual returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; ) {
            results[i] = Calls.functionDelegateCall(address(this), data[i]);
            unchecked { i++; }
        }
        return results;
    }
}
