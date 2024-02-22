// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IGasCollector
 * @author AgentFi
 * @notice The GasCollector collects the gas rewards in bulk from a list of contracts.
 */
interface IGasCollector {

    event ClaimContractListSet(address[] contractList_, address receiver);

    /**
     * @notice Gets the list of contracts to collect blast gas rewards from.
     * @return contractList_ The list of contract addresses.
     * @return gasReceiver_ The receiver of gas rewards.
     */
    function getContractList() external view returns (address[] memory contractList_, address gasReceiver_);

    /**
     * @notice Claims max gas from a list of contracts.
     * Can be called by anyone.
     * @return amountClaimed The amount claimed.
     */
    function claimGas() external payable returns (uint256 amountClaimed);

    /**
     * @notice Calls the Blast contract multiple times with arbitrary data.
     * Can only be called by the contract owner.
     * @param calldatas The list of datas to pass to the Blast contract.
     * @return results The results of each calls.
     */
    function callBlastMulti(bytes[] calldata calldatas) external payable returns (bytes[] memory results);

    /**
     * @notice Sets the contract list and receiver.
     * Can only be called by the contract owner.
     * @param contractList_ The list of contracts.
     * @param receiver_ The receiver.
     */
    function setClaimContractList(address[] calldata contractList_, address receiver_) external payable;
}
