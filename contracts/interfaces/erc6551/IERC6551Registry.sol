// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IERC6551Registry
 * @notice The registry is a singleton contract that serves as the entry point for all token bound account address queries.
 */
interface IERC6551Registry {

    /**
     * @notice The registry MUST emit the ERC6551AccountCreated event upon successful account creation.
     */
    event ERC6551AccountCreated(
        address account,
        address indexed implementation,
        bytes32 salt,
        uint256 chainId,
        address indexed tokenContract,
        uint256 indexed tokenId
    );

    /**
     * @notice The registry MUST revert with AccountCreationFailed error if the create2 operation fails.
     */
    error AccountCreationFailed();

    /**
     * @notice Creates a token bound account for a non-fungible token.
     *
     * If account has already been created, returns the account address without calling create2.
     *
     * Emits ERC6551AccountCreated event.
     *
     * @param implementation The address of the implementation contract.
     * @param salt Arbitrary value to modify resulting address.
     * @param chainId The id of the chain that the tokenContract is deployed on.
     * @param tokenContract The address of the nft contract.
     * @param tokenId The id of the nft.
     * @return account_ The address of the token bound account.
     */
    function createAccount(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external returns (address account_);

    /**
     * @notice Returns the computed token bound account address for a non-fungible token.
     * @param implementation The address of the implementation contract.
     * @param salt Arbitrary value to modify resulting address.
     * @param chainId The id of the chain that the tokenContract is deployed on.
     * @param tokenContract The address of the nft contract.
     * @param tokenId The id of the nft.
     * @return account_ The address of the token bound account.
     */
    function account(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external view returns (address account_);
}
