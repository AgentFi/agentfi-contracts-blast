// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Multicall3 } from "./Multicall3.sol";
import { Blastable } from "./Blastable.sol";


/**
 * @title Multicall3Blastable
 * @notice A variant of Multicall3 that allows collecting the gas rewards.
 */
contract Multicall3Blastable is Multicall3, Blastable {

    /**
     * @notice Constructs the Multicall3Blastable contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param governor_ The address of the gas governor.
     * @param blastPoints_ The address of the blast points contract.
     * @param pointsOperator_ The address of the blast points operator.
     */
    constructor(
        address blast_,
        address governor_,
        address blastPoints_,
        address pointsOperator_
    ) Blastable(blast_, governor_, blastPoints_, pointsOperator_) {}
}
