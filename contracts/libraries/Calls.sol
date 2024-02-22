// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Errors } from "./Errors.sol";


/**
 * @title Calls
 * @author AgentFi
 * @notice A library for safely making low level calls.
 */
library Calls {

    /**
     * @notice Safely transfers the gas token using a low level `call`.
     * @dev If `target` reverts with a revert reason, it is bubbled up by this function.
     * @param target The address of the contract to `call`.
     * @return result The result of the function call.
     */
    function sendValue(
        address target,
        uint256 value
    ) internal returns (bytes memory result) {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = target.call{value:value}("");
        if(success) {
            result = returndata;
        } else {
            // look for revert reason and bubble it up if present
            if(returndata.length > 0) {
                // the easiest way to bubble the revert reason is using memory via assembly
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert Errors.CallFailed();
            }
        }
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
    ) internal returns (bytes memory result) {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = target.call(data);
        if(success) {
            result = returndata;
        } else {
            // look for revert reason and bubble it up if present
            if(returndata.length > 0) {
                // the easiest way to bubble the revert reason is using memory via assembly
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert Errors.CallFailed();
            }
        }
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
    ) internal returns (bytes memory result) {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = target.call{value:value}(data);
        if(success) {
            result = returndata;
        } else {
            // look for revert reason and bubble it up if present
            if(returndata.length > 0) {
                // the easiest way to bubble the revert reason is using memory via assembly
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert Errors.CallFailed();
            }
        }
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
    ) internal returns (bytes memory result) {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = target.delegatecall(data);
        if(success) {
            result = returndata;
        } else {
            // look for revert reason and bubble it up if present
            if(returndata.length > 0) {
                // the easiest way to bubble the revert reason is using memory via assembly
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert Errors.DelegateCallFailed();
            }
        }
    }

    /**
     * @notice Verify that an address has contract code, otherwise reverts.
     * @param target The address to verify.
     */
    function verifyHasCode(
        address target
    ) internal view {
        // checks
        uint256 contractSize;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            contractSize := extcodesize(target)
        }
        if(contractSize == 0) revert Errors.NotAContract();
    }
}
