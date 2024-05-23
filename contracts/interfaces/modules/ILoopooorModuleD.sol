// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title ILoopooorModuleD
 * @author AgentFi
 * @notice A module used in the Loopooor strategy.
 *
 * Designed for use on Blast Mainnet only.
 */
interface ILoopooorModuleD {

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    function moduleName() external pure returns (string memory name_);

    function strategyType() external pure returns (string memory type_);

    function weth() external pure returns (address weth_);
    function usdb() external pure returns (address usdb_);

    // todo


    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    // todo
    struct MintParams {
        uint256 loopCount;
    }

    function moduleD_depositBalance(MintParams memory params) external payable;

    function moduleD_withdrawBalance() external payable;

    function moduleD_withdrawBalanceTo(address receiver) external payable;
}
