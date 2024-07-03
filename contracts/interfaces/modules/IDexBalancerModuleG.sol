// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IDexBalancerModuleG
 * @author AgentFi
 * @notice A module used in the dex balancer strategy.
 *
 * Designed for use on Blast Mainnet only.
 */
interface IDexBalancerModuleG {

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    function moduleName() external pure returns (string memory name_);

    function strategyType() external pure returns (string memory type_);

    function weth() external pure returns (address weth_);
    function usdb() external pure returns (address usdb_);

    function thrusterRouter100() external pure returns (address thrusterRouter100_);
    function thrusterRouter030() external pure returns (address thrusterRouter030_);
    function thrusterLpToken() external pure returns (address thrusterLpToken_);
    function hyperlockStaking() external pure returns (address hyperlockStaking_);

    function ringSwapV2Router() external pure returns (address ringSwapV2Router_);
    function ringFwWeth() external pure returns (address ringFwWeth_);
    function ringFwUsdb() external pure returns (address ringFwUsdb_);
    function ringLpToken() external pure returns (address ringLpToken_);
    function ringFwLpToken() external pure returns (address ringFwLpToken_);
    function ringStakingRewards() external pure returns (address ringStakingRewards_);
    function ringStakingIndex() external pure returns (uint256 ringStakingIndex_);
    function ringTokenClaimer() external pure returns (address ringTokenClaimer_);
    function ring() external pure returns (address ring_);

    function blasterswapRouter() external pure returns (address blasterswapRouter_);
    function blasterswapLpToken() external pure returns (address blasterswapLpToken_);

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    function moduleG_depositBalance() external payable;

    function moduleG_depositBalanceAndRefundTo(address receiver) external payable;

    function moduleG_withdrawBalance() external payable;

    function moduleG_withdrawBalanceTo(address receiver) external payable;

    function moduleG_claimRingTo(address receiver) external payable;

}
