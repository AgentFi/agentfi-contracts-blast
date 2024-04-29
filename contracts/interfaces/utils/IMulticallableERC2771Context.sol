// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IMulticallableERC2771Context
 * @author AgentFi
 * @notice An extension to ERC2771Context that also allows for self `multicall()`.
 *
 * Separately these two standards are safe. The combination of the two can cause an address spoofing vulnerability if not implemented properly.
 *
 * If your contract has the two (extends both Multicall and ERC2771Context) then inherit this contract instead.
 */
interface IMulticallableERC2771Context {

    /***************************************
    MULTICALL
    ***************************************/

    /**
     * @notice Receives and executes a batch of function calls on this contract.
     * @param data A list of function calls to execute.
     * @return results The results of each function call.
     */
    function multicall(bytes[] calldata data) external returns (bytes[] memory results);
}
