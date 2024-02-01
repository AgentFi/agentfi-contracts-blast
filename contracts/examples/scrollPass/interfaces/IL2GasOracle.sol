// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IL2GasOracle {
    function l2BaseFee() external view returns (uint256);
}
