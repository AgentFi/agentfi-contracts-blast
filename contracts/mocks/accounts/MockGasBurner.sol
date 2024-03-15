// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Multicall } from "./../../utils/Multicall.sol";
import { Blastable } from "./../../utils/Blastable.sol";
import { Ownable2Step } from "./../../utils/Ownable2Step.sol";
import { Errors } from "./../../libraries/Errors.sol";
import { BlastableLibrary } from "./../../libraries/BlastableLibrary.sol";


/**
 * @title MockGasBurner
 * @author AgentFi
 * @notice An account that burns gas and performs gas math. Only used to help calculate Blast gas rewards.
*/
contract MockGasBurner is Multicall, Blastable, Ownable2Step {

    uint256 public x;

    /**
     * @notice Constructs the MockGasBurner contract.
     * @param owner_ The owner of the contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param governor_ The address of the gas governor.
     * @param blastPoints_ The address of the blast points contract.
     * @param pointsOperator_ The address of the blast points operator.
     */
    constructor(
        address owner_,
        address blast_,
        address governor_,
        address blastPoints_,
        address pointsOperator_
    ) Blastable(blast_, governor_, blastPoints_, pointsOperator_) {
        _transferOwnership(owner_);
        x = 1;
    }

    /**
     * @notice Burns some gas.
     * @param numIters The number of iterations of the burn loop to run.
     */
    function burnGas(uint256 numIters) external {
        for(uint256 i = 0; i < numIters; ) {
            unchecked {
                ++i;
                x = (x * 2) + i;
            }
        }
    }

    function x1() external view returns (uint256 amount) {
        try MockGasBurner(payable(address(this))).x1WithRevert() {}
        catch (bytes memory reason) {
            amount = BlastableLibrary.parseRevertReasonForAmount(reason);
        }
    }

    function x1WithRevert() external pure {
        revert();
    }

    function x2() external view returns (uint256 amount) {
        try MockGasBurner(payable(address(this))).x2WithRevert() {}
        catch (bytes memory reason) {
            amount = BlastableLibrary.parseRevertReasonForAmount(reason);
        }
    }

    function x2WithRevert() external pure {
        revert Errors.AmountZero();
    }

    function x3() external view returns (uint256 amount) {
        try MockGasBurner(payable(address(this))).x3WithRevert() {}
        catch (bytes memory reason) {
            amount = BlastableLibrary.parseRevertReasonForAmount(reason);
        }
    }

    function x3WithRevert() external pure {
        revert("generic error");
    }

    function x4() external view returns (uint256 amount) {
        try MockGasBurner(payable(address(this))).x4WithRevert() {}
        catch (bytes memory reason) {
            amount = BlastableLibrary.parseRevertReasonForAmount(reason);
        }
    }

    function x4WithRevert() external pure {
        revert Errors.RevertForAmount(5);
    }
}
