// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { LibSandbox } from "./../../lib/LibSandbox.sol";


contract MockSandbox {
    function sandbox(address owner) external view returns (address) {
        return LibSandbox.sandbox(owner);
    }
}
