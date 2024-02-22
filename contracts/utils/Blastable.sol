// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IBlastable } from "./../interfaces/utils/IBlastable.sol";


/**
 * @title Blastable
 * @author AgentFi
 * @notice An abstract contract that configures the connection to Blast during deployment
 *
 * This primarily involves collecting ETH yield and gas rewards. Control is delegated to a governor.
 */
abstract contract Blastable is IBlastable {

    address private immutable _blast;

    /**
     * @notice Constructs the Blastable contract.
     * Configures the contract to receive automatic yield, claimable gas, and assigns a governor.
     * @param blast_ The address of the blast gas reward contract.
     * @param governor_ The address of the gas governor.
     */
    constructor(address blast_, address governor_) {
        _blast = blast_;
        // allow these calls to fail on local fork
        // check success after deployment
        blast_.call(abi.encodeWithSignature("configureAutomaticYield()"));
        blast_.call(abi.encodeWithSignature("configureClaimableGas()"));
        if(governor_ != address(0)) blast_.call(abi.encodeWithSignature("configureGovernor(address)", governor_));
    }

    /**
     * @notice Returns the address of the Blast contract.
     * @return blast_ The adress of the Blast contract.
     */
    function blast() public view override returns (address blast_) {
        blast_ = _blast;
    }

    /**
     * @notice Allows this contract to receive the gas token.
     */
    // solhint-disable-next-line no-empty-blocks
    receive() external payable virtual {}
}
