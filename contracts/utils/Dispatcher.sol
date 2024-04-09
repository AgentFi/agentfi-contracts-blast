// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
// code borrowed from Multicall3 https://etherscan.io/address/0xca1167915584462449ee5b4ea51c37fe81ecdccd

import { Blastable } from "./Blastable.sol";
import { Errors } from "./../libraries/Errors.sol";
import { Ownable2Step } from "./Ownable2Step.sol";
import { Multicall } from "./Multicall.sol";
import { IDispatcher } from "./../interfaces/utils/IDispatcher.sol";


/**
 * @title Dispatcher
 * @author AgentFi
 * @notice Dispatches function calls to multiple other contracts.
 *
 * Like an access controlled variant of Multicall3. Also allows for storing calldata for lower L1 data fee.
 */
contract Dispatcher is Blastable, Ownable2Step, Multicall, IDispatcher {

    /***************************************
    STATE VARIABLES
    ***************************************/

    mapping(address => bool) internal _isOperator;

    uint256 internal _storedCalldatasLength;
    mapping(uint256 => bytes) internal _storedCalldatas;

    /***************************************
    CONSTRUCTOR
    ***************************************/

    /**
     * @notice Constructs the BalanceFetcher contract.
     * @param owner_ The owner of the contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param gasCollector_ The address of the gas collector.
     * @param blastPoints_ The address of the blast points contract.
     * @param pointsOperator_ The address of the blast points operator.
     */
    constructor(
        address owner_,
        address blast_,
        address gasCollector_,
        address blastPoints_,
        address pointsOperator_
    ) Blastable(blast_, gasCollector_, blastPoints_, pointsOperator_) {
        _transferOwnership(owner_);
    }

    /***************************************
    AGGREGATE FUNCTIONS
    ***************************************/

    /// @notice Backwards-compatible call aggregation with Multicall
    /// @param calls An array of Call structs
    /// @return blockNumber The block number where the calls were executed
    /// @return returnData An array of bytes containing the responses
    function aggregate(Call[] calldata calls) external payable override returns (uint256 blockNumber, bytes[] memory returnData) {
        _validateSenderIsOperator();
        blockNumber = block.number;
        uint256 length = calls.length;
        returnData = new bytes[](length);
        Call calldata call;
        for (uint256 i = 0; i < length; ++i) {
            bool success;
            call = calls[i];
            (success, returnData[i]) = call.target.call(call.callData);
            if(!success) revert Errors.CallFailed();
        }
    }

    /// @notice Backwards-compatible with Multicall2
    /// @notice Aggregate calls without requiring success
    /// @param requireSuccess If true, require all calls to succeed
    /// @param calls An array of Call structs
    /// @return returnData An array of Result structs
    function tryAggregate(bool requireSuccess, Call[] calldata calls) public payable override returns (Result[] memory returnData) {
        _validateSenderIsOperator();
        uint256 length = calls.length;
        returnData = new Result[](length);
        Call calldata call;
        for (uint256 i = 0; i < length; ++i) {
            Result memory result = returnData[i];
            call = calls[i];
            (result.success, result.returnData) = call.target.call(call.callData);
            if(requireSuccess && !result.success) revert Errors.CallFailed();
        }
    }

    /// @notice Backwards-compatible with Multicall2
    /// @notice Aggregate calls and allow failures using tryAggregate
    /// @param calls An array of Call structs
    /// @return blockNumber The block number where the calls were executed
    /// @return blockHash The hash of the block where the calls were executed
    /// @return returnData An array of Result structs
    function tryBlockAndAggregate(bool requireSuccess, Call[] calldata calls) public payable override returns (uint256 blockNumber, bytes32 blockHash, Result[] memory returnData) {
        _validateSenderIsOperator();
        blockNumber = block.number;
        blockHash = blockhash(block.number);
        returnData = tryAggregate(requireSuccess, calls);
    }

    /// @notice Backwards-compatible with Multicall2
    /// @notice Aggregate calls and allow failures using tryAggregate
    /// @param calls An array of Call structs
    /// @return blockNumber The block number where the calls were executed
    /// @return blockHash The hash of the block where the calls were executed
    /// @return returnData An array of Result structs
    function blockAndAggregate(Call[] calldata calls) external payable override returns (uint256 blockNumber, bytes32 blockHash, Result[] memory returnData) {
        _validateSenderIsOperator();
        (blockNumber, blockHash, returnData) = tryBlockAndAggregate(true, calls);
    }

    /// @notice Aggregate calls, ensuring each returns success if required
    /// @param calls An array of Call3 structs
    /// @return returnData An array of Result structs
    function aggregate3(Call3[] calldata calls) external payable override returns (Result[] memory returnData) {
        _validateSenderIsOperator();
        uint256 length = calls.length;
        returnData = new Result[](length);
        Call3 calldata calli;
        for (uint256 i = 0; i < length; ++i) {
            Result memory result = returnData[i];
            calli = calls[i];
            (result.success, result.returnData) = calli.target.call(calli.callData);
            if(!calli.allowFailure && !result.success) revert Errors.CallFailed();
        }
    }

    /// @notice Aggregate calls with a msg value
    /// @notice Reverts if msg.value is less than the sum of the call values
    /// @param calls An array of Call3Value structs
    /// @return returnData An array of Result structs
    function aggregate3Value(Call3Value[] calldata calls) external payable override returns (Result[] memory returnData) {
        _validateSenderIsOperator();
        uint256 valAccumulator;
        uint256 length = calls.length;
        returnData = new Result[](length);
        Call3Value calldata calli;
        for (uint256 i = 0; i < length; ++i) {
            Result memory result = returnData[i];
            calli = calls[i];
            uint256 val = calli.value;
            // Humanity will be a Type V Kardashev Civilization before this overflows - andreas
            // ~ 10^25 Wei in existence << ~ 10^76 size uint fits in a uint256
            unchecked { valAccumulator += val; }
            (result.success, result.returnData) = calli.target.call{value: val}(calli.callData);
            if(!calli.allowFailure && !result.success) revert Errors.CallFailed();
        }
        // Finally, make sure the msg.value = SUM(call[0...i].value)
        if(msg.value != valAccumulator) revert Errors.ValueMismatch();
    }

    /***************************************
    AGGREGATE AND STORE FUNCTIONS
    ***************************************/

    /// @notice Backwards-compatible call aggregation with Multicall
    /// @param calls An array of Call structs
    /// @return blockNumber The block number where the calls were executed
    /// @return returnData An array of bytes containing the responses
    function aggregateAndStore(Call[] calldata calls) external payable override returns (uint256 blockNumber, bytes[] memory returnData, uint256[] memory calldataIDs) {
        _validateSenderIsOperator();
        blockNumber = block.number;
        uint256 length = calls.length;
        returnData = new bytes[](length);
        calldataIDs = new uint256[](length);
        Call calldata call;
        for (uint256 i = 0; i < length; ++i) {
            bool success;
            call = calls[i];
            (success, returnData[i]) = call.target.call(call.callData);
            if(!success) revert Errors.CallFailed();
            calldataIDs[i] = _storeCalldata(call.callData);
        }
    }

    /// @notice Aggregate calls, ensuring each returns success if required
    /// @param calls An array of Call3 structs
    /// @return returnData An array of Result structs
    function aggregate3AndStore(Call3[] calldata calls) external payable override returns (Result[] memory returnData, uint256[] memory calldataIDs) {
        _validateSenderIsOperator();
        uint256 length = calls.length;
        returnData = new Result[](length);
        calldataIDs = new uint256[](length);
        Call3 calldata calli;
        for (uint256 i = 0; i < length; ++i) {
            Result memory result = returnData[i];
            calli = calls[i];
            (result.success, result.returnData) = calli.target.call(calli.callData);
            if(!calli.allowFailure && !result.success) revert Errors.CallFailed();
            calldataIDs[i] = _storeCalldata(calli.callData);
        }
    }

    /// @notice Aggregate calls with a msg value
    /// @notice Reverts if msg.value is less than the sum of the call values
    /// @param calls An array of Call3Value structs
    /// @return returnData An array of Result structs
    function aggregate3ValueAndStore(Call3Value[] calldata calls) external payable override returns (Result[] memory returnData, uint256[] memory calldataIDs) {
        _validateSenderIsOperator();
        uint256 valAccumulator;
        uint256 length = calls.length;
        returnData = new Result[](length);
        calldataIDs = new uint256[](length);
        Call3Value calldata calli;
        for (uint256 i = 0; i < length; ++i) {
            Result memory result = returnData[i];
            calli = calls[i];
            uint256 val = calli.value;
            // Humanity will be a Type V Kardashev Civilization before this overflows - andreas
            // ~ 10^25 Wei in existence << ~ 10^76 size uint fits in a uint256
            unchecked { valAccumulator += val; }
            (result.success, result.returnData) = calli.target.call{value: val}(calli.callData);
            if(!calli.allowFailure && !result.success) revert Errors.CallFailed();
            calldataIDs[i] = _storeCalldata(calli.callData);
        }
        // Finally, make sure the msg.value = SUM(call[0...i].value)
        if(msg.value != valAccumulator) revert Errors.ValueMismatch();
    }

    /***************************************
    AGGREGATE FROM STORAGE FUNCTIONS
    ***************************************/

    /**
     * @notice Calls a target using previously stored calldata.
     * @param target The target to call.
     * @param calldataID The ID of the calldata to send.
     * @param returnData The results.
     */
    function aggregateFromStorage1(address target, uint256 calldataID) external payable override returns (bytes memory returnData) {
        _validateSenderIsOperator();
        bytes memory data = _getStoredCalldata(calldataID);
        bool success;
        (success, returnData) = target.call(data);
        if(!success) revert Errors.CallFailed();

    }

    /**
     * @notice Calls a target using previously stored calldata.
     * @param target The target to call.
     * @param calldataIDs The list of IDs of the calldatas to send.
     * @param returnData An array of results.
     */
    function aggregateFromStorage2(address target, uint256[] calldata calldataIDs) external payable override returns (bytes[] memory returnData) {
        _validateSenderIsOperator();
        uint256 length = calldataIDs.length;
        returnData = new bytes[](length);
        for (uint256 i = 0; i < length; ++i) {
            bytes memory data = _getStoredCalldata(calldataIDs[i]);
            bool success;
            (success, returnData[i]) = target.call(data);
            if(!success) revert Errors.CallFailed();
        }
    }

    /**
     * @notice Calls a target using previously stored calldata.
     * @param target The target to call.
     * @param calls The list of calls to send.
     * @param returnData An array of results.
     */
    function aggregateFromStorage3(address target, Call4[] calldata calls) external payable override returns (Result[] memory returnData) {
        _validateSenderIsOperator();
        uint256 length = calls.length;
        returnData = new Result[](length);
        Call4 calldata calli;
        for (uint256 i = 0; i < length; ++i) {
            Result memory result = returnData[i];
            calli = calls[i];
            bytes memory data = _getStoredCalldata(calli.calldataID);
            (result.success, result.returnData) = target.call(data);
            if(!calli.allowFailure && !result.success) revert Errors.CallFailed();
        }
    }

    /**
     * @notice Calls multiple targets using previously stored calldata.
     * @param targets The targets to call.
     * @param calldataID The ID of the calldata to send.
     * @param returnData An array of results.
     */
    function aggregateFromStorage4(address[] calldata targets, uint256 calldataID) external payable override returns (bytes[] memory returnData) {
        _validateSenderIsOperator();
        uint256 lengthJ = targets.length;
        returnData = new bytes[](lengthJ);
        bytes memory data = _getStoredCalldata(calldataID);
        for (uint256 j = 0; j < lengthJ; ++j) {
            bool success;
            (success, returnData[j]) = targets[j].call(data);
            if(!success) revert Errors.CallFailed();
        }
    }

    /**
     * @notice Calls multiple targets using previously stored calldata.
     * @param targets The targets to call.
     * @param calldataIDs The list of IDs of the calldatas to send.
     * @param returnData An array of results.
     */
    function aggregateFromStorage5(address[] calldata targets, uint256[] calldata calldataIDs) external payable override returns (bytes[] memory returnData) {
        _validateSenderIsOperator();
        uint256 length = calldataIDs.length;
        uint256 lengthJ = targets.length;
        returnData = new bytes[](length*lengthJ);
        uint256 resultIndex = 0;
        for (uint256 i = 0; i < length; ++i) {
            bytes memory data = _getStoredCalldata(calldataIDs[i]);
            for (uint256 j = 0; j < lengthJ; ++j) {
                bool success;
                (success, returnData[resultIndex]) = targets[j].call(data);
                if(!success) revert Errors.CallFailed();
                ++resultIndex;
            }
        }
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns true if the account is an operator.
     * @param account The account to query.
     * @return isAuthorized True if is an operator, false otherwise.
     */
    function isOperator(address account) external view returns (bool isAuthorized) {
        isAuthorized = _isOperator[account];
    }

    /**
     * @notice Returns the number of calldatas that were stored.
     * @return len The count.
     */
    function storedCalldatasLength() external view returns (uint256 len) {
        len = _storedCalldatasLength;
    }

    /**
     * @notice Returns a stored calldata.
     * @param calldataID The ID of the calldata.
     * @return data The calldata stored at that index.
     */
    function storedCalldatas(uint256 calldataID) external view returns (bytes memory data) {
        data = _getStoredCalldata(calldataID);
    }

    /***************************************
    OWNER FUNCTIONS
    ***************************************/

    /**
     * @notice Sets the status of a list of operators.
     * Can only be called by the contract owner.
     * @param params The list to set.
     */
    function setOperators(SetOperatorParam[] calldata params) external payable override onlyOwner {
        for(uint256 i = 0; i < params.length; ++i) {
            _isOperator[params[i].account] = params[i].isAuthorized;
            emit OperatorSet(params[i].account, params[i].isAuthorized);
        }
    }

    /***************************************
    HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Reverts if `msg.sender` is not an operator.
     */
    function _validateSenderIsOperator() internal view {
        if(!_isOperator[msg.sender]) revert Errors.NotOperator();
    }

    /**
     * @notice Stores calldata.
     * @param data The calldata to store.
     * @return calldataID The index it was stored at.
     */
    function _storeCalldata(bytes calldata data) internal returns (uint256 calldataID) {
        calldataID = ++_storedCalldatasLength;
        _storedCalldatas[calldataID] = data;
        emit CalldataStored(calldataID);
    }

    /**
     * @notice Retrieves calldata.
     * @param calldataID The index to retrieve from.
     * @return data The data that was stored.
     */
    function _getStoredCalldata(uint256 calldataID) internal view returns (bytes memory data) {
        if(calldataID == 0 || calldataID > _storedCalldatasLength) revert Errors.OutOfRange();
        data = _storedCalldatas[calldataID];
    }
}
