// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Multicall } from "./Multicall.sol";
import { IBlast } from "./../interfaces/external/Blast/IBlast.sol";
import { IGasCollector } from "./../interfaces/utils/IGasCollector.sol";
import { Blastable } from "./Blastable.sol";
import { Ownable2Step } from "./../utils/Ownable2Step.sol";
import { Calls } from "./../libraries/Calls.sol";


/**
 * @title GasCollector
 * @author AgentFi
 * @notice The GasCollector collects the gas rewards in bulk from a list of contracts.
 */
contract GasCollector is Blastable, Ownable2Step, Multicall, IGasCollector {

    address[] internal _contractList;
    address internal _gasReceiver;

    /**
     * @notice Constructs the GasCollector contract.
     * @param owner_ The contract owner.
     * @param blast_ The address of the blast gas reward contract.
     * @param blastPoints_ The address of the blast points contract.
     * @param pointsOperator_ The address of the blast points operator.
     */
    constructor(
        address owner_,
        address blast_,
        address blastPoints_,
        address pointsOperator_
    ) Blastable(blast_, address(0), blastPoints_, pointsOperator_) {
        _transferOwnership(owner_);
    }

    /**
     * @notice Gets the list of contracts to collect blast gas rewards from.
     * @return contractList_ The list of contract addresses.
     * @return gasReceiver_ The receiver of gas rewards.
     */
    function getContractList() external view override returns (address[] memory contractList_, address gasReceiver_) {
        contractList_ = _contractList;
        gasReceiver_ = _gasReceiver;
    }

    /**
     * @notice Claims max gas from a list of contracts.
     * Can be called by anyone.
     * @return amountClaimed The amount claimed.
     */
    function claimGas() external payable override returns (uint256 amountClaimed) {
        uint256 len = _contractList.length;
        address rec = _gasReceiver;
        IBlast b = IBlast(blast());
        for(uint256 i = 0; i < len; ++i) {
            amountClaimed += b.claimMaxGas(_contractList[i], rec);
        }
    }

    /**
     * @notice Calls the Blast contract multiple times with arbitrary data.
     * Can only be called by the contract owner.
     * @param calldatas The list of datas to pass to the Blast contract.
     * @return results The results of each calls.
     */
    function callBlastMulti(bytes[] calldata calldatas) external payable override onlyOwner returns (bytes[] memory results) {
        address b = blast();
        results = new bytes[](calldatas.length);
        for(uint256 i = 0; i < calldatas.length; ++i) {
            results[i] = Calls.functionCall(b, calldatas[i]);
        }
    }

    /**
     * @notice Sets the contract list and receiver.
     * Can only be called by the contract owner.
     * @param contractList_ The list of contracts.
     * @param receiver_ The receiver.
     */
    function setClaimContractList(address[] calldata contractList_, address receiver_) external payable override onlyOwner {
        _contractList = contractList_;
        _gasReceiver = receiver_;
        emit ClaimContractListSet(contractList_, receiver_);
    }
}
