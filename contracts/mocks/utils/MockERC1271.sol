// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title MockERC1271
 * @notice A contract that validates ERC1271 signatures.
 */
contract MockERC1271 {

    /**
     * @notice Should return whether the signature provided is valid for the provided data.
     * @param hash Hash of the data to be signed.
     * @param signature Signature byte array associated with _data.
     */
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4 magicValue) {
        return MockERC1271.isValidSignature.selector;
    }

    function externalCall(address target, bytes calldata data) external {
        target.call(data);
    }
}
