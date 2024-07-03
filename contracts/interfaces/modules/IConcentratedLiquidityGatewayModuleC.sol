// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IConcentratedLiquidityGatewayModuleC
 * @author AgentFi
 * @notice A module used in the Concentrated liquidity strategy.
 * @dev Designed for use on Blast Mainnet only
 */
interface IConcentratedLiquidityGatewayModuleC { // is IConcentratedLiquidityModuleC

    function moduleC_wrap() external payable;
}
