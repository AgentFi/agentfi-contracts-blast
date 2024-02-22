// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IBlastable
 * @author AgentFi
 * @notice An abstract contract that configures the connection to Blast during deployment
 *
 * This primarily involves collecting ETH yield and gas rewards. Control is delegated to a governor.
 */
interface IBlastable {
  
    /**
     * @notice Returns the address of the Blast contract.
     * @return blast_ The adress of the Blast contract.
     */
    function blast() external view returns (address blast_);
}
