// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC6551AccountLib } from "erc6551/lib/ERC6551AccountLib.sol";

import { Errors } from "./../libraries/Errors.sol";
import { AccessControlLibrary } from "./../libraries/AccessControlLibrary.sol";

/**
 * @title StrategyOverridable
 * @dev Allows the root owner of a token bound account to override the implementation of a given function selector on the account.
 *
 * Compared to regular Overridable, these overrides are not keyed to an owner; they are only keyed by `msg.sig`, which means they will stick on transfer.
 *
 * Additionally, overrides will behave more like facets in ERC2535 - the implementation will be `delegatecall`ed from the TBA. It does NOT use the sandbox.
 *
 * Also gives more power to strategy managers.
 */
abstract contract StrategyOverridable {
    /**
     * @dev mapping from selector => implementation
     */
    mapping(bytes4 => address) public overrides;

    event OverrideUpdated(bytes4 selector, address implementation);

    /**
     * @dev Sets the implementation address for a given array of function selectors. Can only be
     * called by the root owner of the account
     *
     * @param selectors Array of selectors to override
     * @param implementations Array of implementation address corresponding to selectors
     */
    function _setOverrides(bytes4[] calldata selectors, address[] calldata implementations)
        internal
    {
        _beforeSetOverrides();

        uint256 length = selectors.length;

        if (implementations.length != length) revert Errors.LengthMismatch();

        for (uint256 i = 0; i < length; i++) {
            overrides[selectors[i]] = implementations[i];
            emit OverrideUpdated(selectors[i], implementations[i]);
        }
    }

    /**
     * @dev Calls into the implementation address using sandbox if override is set for the current
     * function selector. If an implementation is defined, this funciton will either revert or
     * return with the return value of the implementation
     */
    function _handleOverride() internal virtual {
        address implementation = overrides[msg.sig];
        if (implementation != address(0)) {
            (bool success, bytes memory result) = implementation.delegatecall(msg.data);
            assembly {
                if iszero(success) { revert(add(result, 32), mload(result)) }
                return(add(result, 32), mload(result))
            }
        }
    }

    /**
     * @dev Static calls into the implementation addressif override is set for the current function
     * selector. If an implementation is defined, this funciton will either revert or return with
     * the return value of the implementation
     */
    function _handleOverrideStatic() internal view virtual {
        address implementation = overrides[msg.sig];
        if (implementation != address(0)) {
            (bool success, bytes memory result) = implementation.staticcall(msg.data);
            assembly {
                if iszero(success) { revert(add(result, 32), mload(result)) }
                return(add(result, 32), mload(result))
            }
        }
    }

    function _beforeSetOverrides() internal virtual {}

    function _rootTokenOwner(uint256 chainId, address tokenContract, uint256 tokenId)
        internal
        view
        virtual
        returns (address);
}
