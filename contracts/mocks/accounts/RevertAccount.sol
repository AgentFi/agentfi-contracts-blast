// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title RevertAccount
 * @notice An account that reverts on every call.
 *
 * Only used to test other contracts.
*/
contract RevertAccount {

    receive () external payable {
        revert();
    }

    fallback () external payable {
        revert();
    }
}
