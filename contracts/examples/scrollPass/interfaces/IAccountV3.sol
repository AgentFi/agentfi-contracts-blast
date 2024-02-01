// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IAccountV3 {
    function bridgeEthBalance(
        uint _bridgeGasLimit,
        uint _adminGasFee
    ) external payable;
}
