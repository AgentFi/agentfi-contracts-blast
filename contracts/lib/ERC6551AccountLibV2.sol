// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ERC6551AccountLib } from "erc6551/lib/ERC6551AccountLib.sol";


library ERC6551AccountLibV2 {

    function isERC6551Account(address account, address registry)
        internal
        view
        returns (bool)
    {
        // invalid bytecode size
        if (account.code.length != 0xAD) return false;

        address _implementation = ERC6551AccountLib.implementation(account);

        // implementation does not exist
        if (_implementation.code.length == 0) return false;

        (bytes32 _salt, uint256 chainId, address tokenContract, uint256 tokenId) = ERC6551AccountLib.context(account);

        return account
            == ERC6551AccountLib.computeAddress(registry, _implementation, _salt, chainId, tokenContract, tokenId);
    }
}
