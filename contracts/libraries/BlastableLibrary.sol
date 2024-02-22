// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Errors } from "./Errors.sol";


/**
 * @title BlastableLibrary
 * @author AgentFi
 * @notice A library that helps contracts interact with Blast.
 */
library BlastableLibrary {

    /***************************************
    HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Parses a revert reason that should contain the numeric quote.
     * @param reason The error to parse.
     * @return amount The returned amount.
     */
    function parseRevertReasonForAmount(bytes memory reason) internal pure returns (uint256 amount) {
        // revert if reason is not of expected format
        if(reason.length != 36) {
            // look for revert reason and bubble it up if present
            if(reason.length > 0) {
                // the easiest way to bubble the revert reason is using memory via assembly
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    let reason_size := mload(reason)
                    revert(add(32, reason), reason_size)
                }
            } else {
                revert Errors.UnknownError();
            }
        }
        // parse reason, return amount
        // solhint-disable-next-line no-inline-assembly
        assembly {
            reason := add(reason, 0x04)
        }
        amount = abi.decode(reason, (uint256));
    }
}
