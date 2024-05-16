// SPDX-License-Identifier: GPL-2.0-or-later
// Source: https://github.com/Uniswap/v3-core/blob/0.8/contracts/libraries/FixedPoint128.sol
pragma solidity >=0.4.0;

/// @title FixedPoint128
/// @notice A library for handling binary fixed point numbers, see https://en.wikipedia.org/wiki/Q_(number_format)
library FixedPoint128 {
    uint256 internal constant Q128 = 0x100000000000000000000000000000000;
}