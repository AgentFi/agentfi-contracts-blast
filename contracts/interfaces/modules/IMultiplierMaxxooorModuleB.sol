// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IMultiplierMaxxooorModuleB
 * @author AgentFi
 * @notice A module used in the Multiplier Maxxooor Strategy.
 */
interface IMultiplierMaxxooorModuleB {

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    function moduleName() external pure returns (string memory name_);

    function strategyType() external pure returns (string memory type_);
}
