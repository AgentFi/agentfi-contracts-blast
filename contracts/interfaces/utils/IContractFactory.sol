// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IContractFactory
 * @author AgentFi
 * @notice Exposes CREATE2 (EIP-1014) to deploy bytecode on deterministic addresses based on initialization code and salt.
 *
 * Inspired by ERC2470 but meant to be deployed with a known private key.
 *
 * Code borrowed from https://etherscan.io/address/0xce0042B868300000d44A59004Da54A005ffdcf9f
 */
interface IContractFactory {

    /// @notice Emitted when this contract deploys another contract.
    event ContractDeployed(address indexed createdContract);

    /***************************************
    DEPLOYER FUNCTIONS
    ***************************************/

    /**
     * @notice Deploys `initCode` using `salt` for defining the deterministic address.
     * @param initCode Initialization code.
     * @param salt Arbitrary value to modify resulting address.
     * @return createdContract Created contract address.
     */
    function deploy(bytes memory initCode, bytes32 salt) external payable returns (address payable createdContract);

    /**
     * @notice Deploys `initCode` using `salt` for defining the deterministic address then calls the contract.
     * @param initCode Initialization code.
     * @param salt Arbitrary value to modify resulting address.
     * @param data The data to pass to the contract.
     * @return createdContract Created contract address.
     * @return returndata The data returned from the contract.
     */
    function deployAndCall(bytes memory initCode, bytes32 salt, bytes calldata data) external payable returns (address payable createdContract, bytes memory returndata);

    /**
     * @notice Deploys `initCode=msg.data` using `salt=0` for defining the deterministic address.
     */
    fallback () external payable;
}
