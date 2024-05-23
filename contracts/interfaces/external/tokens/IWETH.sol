// SPDX-License-Identifier: none
pragma solidity 0.8.24;

interface IWETH {
    function transferFrom(address src, address dst, uint wad) external returns (bool);

    function withdraw(uint wad) external;
}