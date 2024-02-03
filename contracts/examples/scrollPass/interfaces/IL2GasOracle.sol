// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IL2GasOracle {
    function l2BaseFee() external view returns (uint256);
}
