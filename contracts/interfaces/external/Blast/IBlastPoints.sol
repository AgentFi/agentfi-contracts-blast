// SPDX-License-Identifier: none
pragma solidity 0.8.24;

// https://docs.blast.io/airdrop/api

interface IBlastPoints {
    function configurePointsOperator(address operator) external;
    function configurePointsOperatorOnBehalf(address contractAddress, address operator) external;

    function operatorMap(address contractAddress) external view returns (address operator);
}
