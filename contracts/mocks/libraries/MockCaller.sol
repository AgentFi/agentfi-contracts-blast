// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Calls } from "./../../libraries/Calls.sol";


contract MockCaller {

    /**
     * @notice Safely transfers the gas token using a low level `call`.
     * @dev If `target` reverts with a revert reason, it is bubbled up by this function.
     * @param target The address of the contract to `call`.
     * @return result The result of the function call.
     */
    function sendValue(
        address target,
        uint256 value
    ) external payable returns (bytes memory result) {
        result = Calls.sendValue(target, value);
    }

    /**
     * @notice Safely performs a Solidity function call using a low level `call`.
     * @dev If `target` reverts with a revert reason, it is bubbled up by this function.
     * @param target The address of the contract to `delegatecall`.
     * @param data The data to pass to the target.
     * @return result The result of the function call.
     */
    function functionCall(
        address target,
        bytes memory data
    ) external payable returns (bytes memory result) {
        result = Calls.functionCall(target, data);
    }

    /**
     * @notice Safely performs a Solidity function call using a low level `call`.
     * @dev If `target` reverts with a revert reason, it is bubbled up by this function.
     * @param target The address of the contract to `delegatecall`.
     * @param data The data to pass to the target.
     * @return result The result of the function call.
     */
    function functionCallWithValue(
        address target,
        bytes memory data,
        uint256 value
    ) external payable returns (bytes memory result) {
        result = Calls.functionCallWithValue(target, data, value);
    }

    /**
     * @notice Safely performs a Solidity function call using a low level `delegatecall`.
     * @dev If `target` reverts with a revert reason, it is bubbled up by this function.
     * @param target The address of the contract to `delegatecall`.
     * @param data The data to pass to the target.
     * @return result The result of the function call.
     */
    function functionDelegateCall(
        address target,
        bytes memory data
    ) external payable returns (bytes memory result) {
        result = Calls.functionDelegateCall(target, data);
    }

    /**
     * @notice Verify that an address has contract code, otherwise reverts.
     * @param target The address to verify.
     */
    function verifyHasCode(
        address target
    ) external view {
        Calls.verifyHasCode(target);
    }

    receive () external payable {}
}
