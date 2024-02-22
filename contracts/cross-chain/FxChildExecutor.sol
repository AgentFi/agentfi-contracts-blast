// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Errors } from "./../libraries/Errors.sol";

interface IFxMessageProcessor {
    function processMessageFromRoot(uint256 stateId, address rootMessageSender, bytes calldata data)
        external;
}

contract FxChildExecutor is IFxMessageProcessor {
    address public immutable fxChild;

    event Executed(bool success, bytes data);

    constructor(address _fxChild) {
        fxChild = _fxChild;
    }

    function processMessageFromRoot(uint256, address rootMessageSender, bytes calldata data)
        external
    {
        if (msg.sender != fxChild) revert Errors.InvalidSender();
        (bool success, bytes memory result) = rootMessageSender.call(data);
        emit Executed(success, result);
    }
}
