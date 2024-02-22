// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";


/**
 * @title MockERC1155
 * @notice A mock ERC1155 token used to test other contracts.
 *
 * This implementation should NOT be used in production (unguarded mint).
 */
contract MockERC1155 is ERC1155 {

    /**
     * @notice Constructs the MockERC1155 contract.
     * @param uri The uri of the token.
     */
    constructor(
        string memory uri
    ) ERC1155(uri) {}

    /**
     * @notice Mints a token.
     */
    function mint(address to, uint256 id, uint256 amount, bytes memory data) external {
        _mint(to, id, amount, data);
    }
}
