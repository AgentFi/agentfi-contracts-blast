// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IL1GatewayRouter {
    function depositETH(
        address _to,
        uint256 _amount,
        uint256 _gasLimit
    ) external payable;

    function ethGateway() external view returns (address);
}
