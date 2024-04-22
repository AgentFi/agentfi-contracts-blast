// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title RevertOnCreateAccount
 * @notice An account that reverts on every call.
 *
 * Only used to test other contracts.
*/
contract RevertOnCreateAccount {

    constructor(bool shouldRevert) {
        if(shouldRevert) revert();
    }

    receive () external payable {
        revert();
    }

    fallback () external payable {
        revert();
    }
}
