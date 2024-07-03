// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Shared interface for both fixed rate and variable rate contracts.
interface IFewWrappedToken {
    function token() external view returns (address);
}
