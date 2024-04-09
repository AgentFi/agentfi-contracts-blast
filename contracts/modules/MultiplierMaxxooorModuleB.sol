// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Blastable } from "./../utils/Blastable.sol";


/**
 * @title MultiplierMaxxooorModuleB
 * @author AgentFi
 * @notice A module used in the Multiplier Maxxooor Strategy.
 */
contract MultiplierMaxxooorModuleB is Blastable {

    /***************************************
    CONSTRUCTOR
    ***************************************/

    /**
     * @notice Constructs the MultiplierMaxxooorModuleB contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param gasCollector_ The address of the gas collector.
     * @param blastPoints_ The address of the blast points contract.
     * @param pointsOperator_ The address of the blast points operator.
     */
    constructor(
        address blast_,
        address gasCollector_,
        address blastPoints_,
        address pointsOperator_
    ) Blastable(blast_, gasCollector_, blastPoints_, pointsOperator_) {}

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    function moduleName() external pure returns (string memory name_) {
        name_ = "MultiplierMaxxooorModuleB";
    }

    function strategyType() external pure returns (string memory type_) {
        type_ = "Multiplier Maxxooor";
    }
}
