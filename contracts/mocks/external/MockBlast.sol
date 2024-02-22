// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Calls } from "./../../libraries/Calls.sol";


/**
 * @title MockBlast
 * @author AgentFi
 * @notice A mock version of the blast rewards contract. Only used to test other contracts.
 */
contract MockBlast {

    mapping(address => bool) internal _isConfiguredAutomaticYield;
    mapping(address => bool) internal _isConfiguredClaimableGas;
    mapping(address => address) internal _governors;

    function configureAutomaticYield() external {
        _verifySenderIsGovernor(msg.sender); // check if the contract has governance rights over itself
        _isConfiguredAutomaticYield[msg.sender] = true;
    }

    function configureClaimableGas() external {
        _verifySenderIsGovernor(msg.sender); // check if the contract has governance rights over itself
        _isConfiguredClaimableGas[msg.sender] = true;
    }

    function configureVoidGas() external {
        _verifySenderIsGovernor(msg.sender); // check if the contract has governance rights over itself
        _isConfiguredClaimableGas[msg.sender] = false;
    }

    function configureGovernor(address gov) external {
        _verifySenderIsGovernor(msg.sender); // check if the contract has governance rights over itself
        _governors[msg.sender] = gov;
    }

    function claimAllGas(address contractAddress, address recipientOfGas) external returns (uint256) {
        _verifySenderIsGovernor(contractAddress);
        _verifyIsConfiguredClaimableGas(contractAddress);
        uint256 amount = 2255; // wei
        Calls.sendValue(recipientOfGas, amount);
        return amount;
    }

    function claimMaxGas(address contractAddress, address recipientOfGas) external returns (uint256) {
        _verifySenderIsGovernor(contractAddress);
        _verifyIsConfiguredClaimableGas(contractAddress);
        uint256 amount = 1500; // wei
        Calls.sendValue(recipientOfGas, amount);
        return amount;
    }

    function _verifySenderIsGovernor(address contractAddress) internal view {
        address gov = _governors[contractAddress];
        if(gov == address(0)) gov = contractAddress;
        if(msg.sender != gov) revert("not governor");
    }

    function _verifyIsConfiguredClaimableGas(address contractAddress) internal view {
        if(!_isConfiguredClaimableGas[contractAddress]) revert("not configured claimable gas");
    }

    function isConfiguredAutomaticYield(address contractAddress) external view returns (bool status) {
        status = _isConfiguredAutomaticYield[contractAddress];
    }

    function isConfiguredClaimableGas(address contractAddress) external view returns (bool status) {
        status = _isConfiguredClaimableGas[contractAddress];
    }

    function getGovernor(address contractAddress) external view returns (address gov) {
        gov = _governors[contractAddress];
    }

    receive() external payable {}
}
