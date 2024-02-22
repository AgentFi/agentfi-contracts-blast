// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC2771Context } from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import { Context } from "@openzeppelin/contracts/utils/Context.sol";
import { ERC165 } from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import { IERC6551Executable } from "erc6551/interfaces/IERC6551Executable.sol";
import { IERC6551Account } from "erc6551/interfaces/IERC6551Account.sol";
import { ERC6551AccountLib } from "erc6551/lib/ERC6551AccountLib.sol";

import { Errors } from "./../../libraries/Errors.sol";
import { LibExecutor } from "./../../lib/LibExecutor.sol";
import { LibSandbox } from "./../../lib/LibSandbox.sol";
import { SandboxExecutor } from "./SandboxExecutor.sol";
import { BaseExecutor } from "./BaseExecutor.sol";

/**
 * @title ERC-6551 Executor
 * @dev Basic executor which implements the IERC6551Executable execution interface
 */
abstract contract ERC6551Executor is IERC6551Executable, ERC165, BaseExecutor {
    /**
     * Executes a low-level operation from this account if the caller is a valid executor
     *
     * @param to Account to operate on
     * @param value Value to send with operation
     * @param data Encoded calldata of operation
     * @param operation Operation type (0=CALL, 1=DELEGATECALL, 2=CREATE, 3=CREATE2)
     */
    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external
        payable
        virtual
        returns (bytes memory)
    {
        _verifySenderIsValidExecutor();

        _beforeExecute();

        return LibExecutor._execute(to, value, data, operation);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC6551Executable).interfaceId
            || super.supportsInterface(interfaceId);
    }

    function _verifySenderIsValidExecutor() internal view virtual {
        if (!_isValidExecutor(_msgSender())) revert Errors.NotAuthorized();
    }
}
