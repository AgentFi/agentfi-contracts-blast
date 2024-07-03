// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;


interface IRingTokenClaimer {

    function claim(uint256 index) external;

    function getClaimed(uint256 index, address user) external view returns (uint256 amountClaimed);
}
