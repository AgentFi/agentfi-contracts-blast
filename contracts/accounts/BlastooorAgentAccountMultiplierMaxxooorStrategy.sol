// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { BlastooorGenesisAgentAccount } from "./BlastooorGenesisAgentAccount.sol";
import { IBlastooorAgentAccountMultiplierMaxxooorStrategy } from "./../interfaces/accounts/IBlastooorAgentAccountMultiplierMaxxooorStrategy.sol";
import { LibExecutor } from "./../lib/LibExecutor.sol";


/**
 * @title BlastooorAgentAccountMultiplierMaxxooorStrategy
 * @author AgentFi
 * @notice An account type used by Multiplier Maxxooor strategy agents.
 */
contract BlastooorAgentAccountMultiplierMaxxooorStrategy is BlastooorGenesisAgentAccount, IBlastooorAgentAccountMultiplierMaxxooorStrategy {

    /***************************************
    STATE VARIABLES
    ***************************************/

    /// @notice The role for dispatchers.
    bytes32 public constant DISPATCHER_ROLE = keccak256("DISPATCHER_ROLE");

    /***************************************
    CONSTRUCTOR
    ***************************************/

    /**
     * @notice Constructs the BlastooorAgentAccountMultiplierMaxxooorStrategy contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param gasCollector_ The address of the gas collector.
     * @param blastPoints_ The address of the blast points contract.
     * @param pointsOperator_ The address of the blast points operator.
     * @param entryPoint_ The ERC-4337 EntryPoint address.
     * @param multicallForwarder The MulticallForwarder address.
     * @param erc6551Registry The ERC-6551 Registry address.
     * @param _guardian The AccountGuardian address.
     */
    constructor(
        address blast_,
        address gasCollector_,
        address blastPoints_,
        address pointsOperator_,
        address entryPoint_,
        address multicallForwarder,
        address erc6551Registry,
        address _guardian
    ) BlastooorGenesisAgentAccount(blast_, gasCollector_, blastPoints_, pointsOperator_, entryPoint_, multicallForwarder, erc6551Registry, _guardian) {}

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Executes an external call from this account.
     * Can only be called by an authorized executor or dispatcher.
     */
    function executeByDispatcher(ExecuteByDispatcherParam calldata params) external payable virtual override returns (bytes memory result) {
        _dispatcherPrecheck();
        result = LibExecutor._execute(params.to, 0, params.data, 0);
    }

    /**
     * @notice Executes an external call from this account.
     * Can only be called by an authorized executor or dispatcher.
     */
    function executePayableByDispatcher(ExecutePayableByDispatcherParam calldata params) external payable virtual override returns (bytes memory result) {
        _dispatcherPrecheck();
        result = LibExecutor._execute(params.to, params.value, params.data, 0);
    }

    /**
     * @notice Executes a batch of external calls from this account.
     * Can only be called by an authorized executor or dispatcher.
     */
    function executeBatchByDispatcher(ExecuteByDispatcherParam[] calldata params) external payable virtual override returns (bytes[] memory results) {
        _dispatcherPrecheck();
        results = new bytes[](params.length);
        for(uint256 i = 0; i < params.length; ++i) {
            results[i] = LibExecutor._execute(params[i].to, 0, params[i].data, 0);
        }
    }

    /**
     * @notice Executes a batch of external calls from this account.
     * Can only be called by an authorized executor or dispatcher.
     */
    function executePayableBatchByDispatcher(ExecutePayableByDispatcherParam[] calldata params) external payable virtual override returns (bytes[] memory results) {
        _dispatcherPrecheck();
        results = new bytes[](params.length);
        for(uint256 i = 0; i < params.length; ++i) {
            results[i] = LibExecutor._execute(params[i].to, params[i].value, params[i].data, 0);
        }
    }

    /***************************************
    HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Precheck for all execute by dispatcher calls.
     */
    function _dispatcherPrecheck() internal {
        _verifySenderIsValidExecutorOrHasRole(DISPATCHER_ROLE);
        _verifyIsUnlocked();
        _updateState();
        _beforeExecute();
    }
}
