// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IBlastable
 * @author AgentFi
 * @notice An abstract contract that configures the connection to Blast during deployment
 *
 * This involves collecting ETH yield, gas rewards, and Blast Points. ETH yield is earned by this contract automatically, while gas rewards and Blast Points are delegated to dedicated collectors.
 */
interface IBlastable {

    /**
     * @notice Returns the address of the Blast contract.
     * @return blast_ The adress of the Blast contract.
     */
    function blast() external view returns (address blast_);

    /**
     * @notice Returns the address of the BlastPoints contract.
     * @return blastPoints_ The adress of the BlastPoints contract.
     */
    function blastPoints() external view returns (address blastPoints_);
}
