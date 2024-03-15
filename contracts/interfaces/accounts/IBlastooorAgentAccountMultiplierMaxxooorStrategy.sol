// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IBlastooorAgentAccountMultiplierMaxxooorStrategy
 * @author AgentFi
 * @notice An account type used by Multiplier Maxxooor strategy agents.
*/
interface IBlastooorAgentAccountMultiplierMaxxooorStrategy {

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    struct ExecuteByDispatcherParam {
        address to;
        bytes data;
    }

    struct ExecutePayableByDispatcherParam {
        address to;
        uint256 value;
        bytes data;
    }

    /**
     * @notice Executes an external call from this account.
     * Can only be called by an authorized executor or dispatcher.
     */
    function executeByDispatcher(ExecuteByDispatcherParam calldata params) external payable returns (bytes memory result);

    /**
     * @notice Executes an external call from this account.
     * Can only be called by an authorized executor or dispatcher.
     */
    function executePayableByDispatcher(ExecutePayableByDispatcherParam calldata params) external payable returns (bytes memory result);

    /**
     * @notice Executes a batch of external calls from this account.
     * Can only be called by an authorized executor or dispatcher.
     */
    function executeBatchByDispatcher(ExecuteByDispatcherParam[] calldata params) external payable returns (bytes[] memory results);

    /**
     * @notice Executes a batch of external calls from this account.
     * Can only be called by an authorized executor or dispatcher.
     */
    function executePayableBatchByDispatcher(ExecutePayableByDispatcherParam[] calldata params) external payable returns (bytes[] memory results);
}
