// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IBlastable } from "./../interfaces/utils/IBlastable.sol";


/**
 * @title Blastable
 * @author AgentFi
 * @notice An abstract contract that configures the connection to Blast during deployment
 *
 * This involves collecting ETH yield, gas rewards, and Blast Points. ETH yield is earned by this contract automatically, while gas rewards and Blast Points are delegated to dedicated collectors.
 */
abstract contract Blastable is IBlastable {

    address internal immutable __blast;
    address internal immutable __gasCollector;
    address internal immutable __blastPoints;
    address internal immutable __pointsOperator;

    /**
     * @notice Constructs the Blastable contract.
     * Configures the contract to receive automatic yield, claimable gas, and assigns a gas collector.
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
    ) {
        __blast = blast_;
        __gasCollector = gasCollector_;
        __blastPoints = blastPoints_;
        __pointsOperator = pointsOperator_;
        // allow these calls to fail on local fork
        // check success after deployment
        blast_.call(abi.encodeWithSignature("configureAutomaticYield()"));
        blast_.call(abi.encodeWithSignature("configureClaimableGas()"));
        if(gasCollector_ != address(0)) blast_.call(abi.encodeWithSignature("configureGovernor(address)", gasCollector_));
        if(pointsOperator_ != address(0)) blastPoints_.call(abi.encodeWithSignature("configurePointsOperator(address)", pointsOperator_));
    }

    /**
     * @notice Returns the address of the Blast contract.
     * @return blast_ The adress of the Blast contract.
     */
    function blast() public view override returns (address blast_) {
        blast_ = __blast;
    }

    /**
     * @notice Returns the address of the BlastPoints contract.
     * @return blastPoints_ The adress of the BlastPoints contract.
     */
    function blastPoints() public view override returns (address blastPoints_) {
        blastPoints_ = __blastPoints;
    }

    /**
     * @notice Allows this contract to receive the gas token.
     */
    // solhint-disable-next-line no-empty-blocks
    receive() external payable virtual {}
}
