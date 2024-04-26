// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC2771Context } from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import { Calls } from "./../libraries/Calls.sol";
import { IMulticallableERC2771Context } from "./../interfaces/utils/IMulticallableERC2771Context.sol";


/**
 * @title MulticallableERC2771Context
 * @author AgentFi
 * @notice An extension to ERC2771Context that also allows for self `multicall()`.
 *
 * Separately these two standards are safe. The combination of the two can cause an address spoofing vulnerability if not implemented properly.
 *
 * If your contract has the two (extends both Multicall and ERC2771Context) then inherit this contract instead.
 */
abstract contract MulticallableERC2771Context is ERC2771Context, IMulticallableERC2771Context {

    /***************************************
    CONSTRUCTOR
    ***************************************/

    /**
     * @notice Initializes the contract with a trusted forwarder, which will be able to invoke functions on this contract on behalf of other accounts.
     * @param multicallForwarder_ The MulticallForwarder address.
     */
    constructor(address multicallForwarder_) ERC2771Context(multicallForwarder_) {}

    /***************************************
    MULTICALL
    ***************************************/

    /**
     * @notice Receives and executes a batch of function calls on this contract.
     * @param data A list of function calls to execute.
     * @return results The results of each function call.
     */
    function multicall(bytes[] calldata data) external override returns (bytes[] memory results) {
        results = new bytes[](data.length);
        address sender = _msgSender();
        bool isForwarder = msg.sender != sender;
        for(uint256 i = 0; i < data.length; ++i) {
            if(isForwarder) {
                results[i] = Calls.functionDelegateCall(address(this), abi.encodePacked(data[i], sender));
            } else {
                results[i] = Calls.functionDelegateCall(address(this), data[i]);
            }
        }
    }
}
