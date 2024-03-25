// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Multicall } from "./Multicall.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IContractFactory } from "./../interfaces/utils/IContractFactory.sol";
import { Blastable } from "./Blastable.sol";
import { Ownable2Step } from "./../utils/Ownable2Step.sol";


/**
 * @title Contract Factory
 * @author AgentFi
 * @notice Exposes CREATE2 (EIP-1014) to deploy bytecode on deterministic addresses based on initialization code and salt.
 *
 * Inspired by ERC2470 but meant to be deployed with a known private key.
 *
 * Code borrowed from https://etherscan.io/address/0xce0042B868300000d44A59004Da54A005ffdcf9f
 */
contract ContractFactory is IContractFactory, Multicall, Blastable, Ownable2Step {

    /**
     * @notice Constructs the factory contract.
     * @param owner_ The owner of the contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param gasCollector_ The address of the gas collector.
     * @param blastPoints_ The address of the blast points contract.
     * @param pointsOperator_ The address of the blast points operator.
     */
    constructor(
        address owner_,
        address blast_,
        address gasCollector_,
        address blastPoints_,
        address pointsOperator_
    ) Blastable(blast_, gasCollector_, blastPoints_, pointsOperator_) {
        _transferOwnership(owner_);
    }

    /***************************************
    DEPLOYER FUNCTIONS
    ***************************************/

    /**
     * @notice Deploys `initCode` using `salt` for defining the deterministic address.
     * @param initCode Initialization code.
     * @param salt Arbitrary value to modify resulting address.
     * @return createdContract Created contract address.
     */
    function deploy(bytes memory initCode, bytes32 salt) external payable override returns (address payable createdContract) {
        createdContract = _deploy(initCode, salt);
    }

    /**
     * @notice Deploys `initCode` using `salt` for defining the deterministic address then calls the contract.
     * @param initCode Initialization code.
     * @param salt Arbitrary value to modify resulting address.
     * @param data The data to pass to the contract.
     * @return createdContract Created contract address.
     * @return returndata The data returned from the contract.
     */
    function deployAndCall(bytes memory initCode, bytes32 salt, bytes calldata data) external payable override returns (address payable createdContract, bytes memory returndata) {
        createdContract = _deploy(initCode, salt);
        returndata = Calls.functionCall(createdContract, data);
    }

    /**
     * @notice Deploys `initCode=msg.data` using `salt=0` for defining the deterministic address.
     */
    fallback () external payable override {
        _deploy(msg.data, bytes32(0));
    }

    /***************************************
    DEPLOYER HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Deploys the contract.
     * @param initCode Initialization code.
     * @param salt Arbitrary value to modify resulting address.
     * @return createdContract Created contract address.
     */
    function _deploy(bytes memory initCode, bytes32 salt) private returns (address payable createdContract) {
        assembly {
            createdContract := create2(0, add(initCode, 0x20), mload(initCode), salt)
        }
        if(createdContract == address(0)) revert Errors.ContractNotDeployed();
        emit ContractDeployed(createdContract);
    }
}
