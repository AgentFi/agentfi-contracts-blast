// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IConcentratedLiquidityHyperlockModuleC
 * @author AgentFi
 * @notice A module used in the Concentrated liquidity strategy.
 * @dev Designed for use on Blast Mainnet only
 */
interface IConcentratedLiquidityHyperlockModuleC { // is IConcentratedLiquidityModuleC

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    function hyperlockStaking() external view returns (address hyperlockStaking_);
}
