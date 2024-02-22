// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";


/**
 * @title MockERC721
 * @notice A mock ERC721 token used to test other contracts.
 *
 * This implementation should NOT be used in production (unguarded mint).
 */
contract MockERC721 is ERC721 {

    /**
     * @notice Constructs the MockERC721 contract.
     * @param name_ The name of the token.
     * @param symbol_ The symbol of the token.
     */
    constructor(
        string memory name_,
        string memory symbol_
    ) ERC721(name_, symbol_) {}

    /**
     * @notice Mints a token.
     * @param receiver The address to receive the new token.
     * @param tokenId The ID of the token to mint.
     */
    function mint(address receiver, uint256 tokenId) external {
        _mint(receiver, tokenId);
    }
}
