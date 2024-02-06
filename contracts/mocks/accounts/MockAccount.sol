// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./../../accounts/AccountV3.sol"; // tokenbound base account contract

/**
 * @title MockAccount
 * @notice A mock TBA used to test other contracts.
 */
contract MockAccount is AccountV3 {

    address immutable _anotherAddress;
    uint256 internal _someValue;

    constructor(
        address entryPoint_,
        address multicallForwarder,
        address erc6551Registry,
        address _guardian,
        address anotherAddress
    ) AccountV3(entryPoint_, multicallForwarder, erc6551Registry, _guardian) {
        _anotherAddress = anotherAddress;
    }

    function getEntryPoint() external view returns (address) {
        return address(_entryPoint);
    }

    function getERC6551Registry() external view returns (address) {
        return erc6551Registry;
    }

    function getGuardian() external view returns (address) {
        return address(guardian);
    }

    function getSelf() external view returns (address) {
        return __self;
    }

    function getAddressThis() external view returns (address) {
        return address(this);
    }

    function getAnotherAddress() external view returns (address) {
        return _anotherAddress;
    }

    function getSomeValue() external view returns (uint256) {
        return _someValue;
    }

    function setSomeValue(uint256 val) external {
        _verifySenderIsValidExecutor();
        _verifyIsUnlocked();
        _updateState();
        _someValue = val;
    }
}
