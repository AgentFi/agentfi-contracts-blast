// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./../accounts/AccountV3WithAccessControl.sol";

/**
 * @title LmaoAgentAccount
 * @author LMAO Labs
 * @notice A TBA used in an LMAO agent.
 */
contract LmaoAgentAccount is AccountV3WithAccessControl {

    constructor(
        address entryPoint_,
        address multicallForwarder,
        address erc6551Registry,
        address _guardian
    ) AccountV3WithAccessControl(entryPoint_, multicallForwarder, erc6551Registry, _guardian) {}
}
