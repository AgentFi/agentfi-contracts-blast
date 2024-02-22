// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IUniversalRouter
 * @notice Uniswap's UniversalRouter rewritten for use in Ring Protocol.
 */
interface IUniversalRouter {

    /**
     * @notice Executes encoded commands along with provided inputs.
     * @param commands A set of concatenated commands, each 1 byte in length
     * @param inputs An array of byte strings containing abi encoded inputs for each command
     */
    function execute(bytes calldata commands, bytes[] calldata inputs) external payable;
}
