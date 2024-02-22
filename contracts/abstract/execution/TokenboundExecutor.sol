// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC2771Context } from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import { Context } from "@openzeppelin/contracts/utils/Context.sol";

import { IERC6551Executable } from "erc6551/interfaces/IERC6551Executable.sol";
import { IERC6551Account } from "erc6551/interfaces/IERC6551Account.sol";
import { ERC6551AccountLib } from "erc6551/lib/ERC6551AccountLib.sol";

import { Errors } from "./../../libraries/Errors.sol";
import { LibExecutor } from "./../../lib/LibExecutor.sol";
import { LibSandbox } from "./../../lib/LibSandbox.sol";
import { ERC6551Executor } from "./ERC6551Executor.sol";
import { BatchExecutor } from "./BatchExecutor.sol";
import { NestedAccountExecutor } from "./NestedAccountExecutor.sol";

/**
 * @title Tokenbound Executor
 * @dev Enables basic ERC-6551 execution as well as batch, nested, and mult-account execution
 */
abstract contract TokenboundExecutor is
    ERC6551Executor,
    BatchExecutor,
    NestedAccountExecutor,
    ERC2771Context
{
    constructor(address multicallForwarder, address _erc6551Registry)
        ERC2771Context(multicallForwarder)
        NestedAccountExecutor(_erc6551Registry)
    {
        if (multicallForwarder == address(0)) revert Errors.InvalidMulticallForwarder();
    }

    function _msgSender()
        internal
        view
        virtual
        override(Context, ERC2771Context)
        returns (address sender)
    {
        return super._msgSender();
    }

    function _msgData()
        internal
        view
        virtual
        override(Context, ERC2771Context)
        returns (bytes calldata)
    {
        return super._msgData();
    }

    /**
     * @dev ERC-2771 specifies the context as being a single address (20 bytes).
     */
    function _contextSuffixLength()
        internal
        view
        virtual
        override(Context, ERC2771Context)
        returns (uint256)
    {
        return 20;
    }
}
