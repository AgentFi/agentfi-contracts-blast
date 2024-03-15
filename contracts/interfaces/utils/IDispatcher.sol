// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IDispatcher
 * @author AgentFi
 * @notice Dispatches function calls to multiple other contracts.
 *
 * Like an access controlled variant of Multicall3. Also allows for storing calldata for lower L1 data fee.
 */
interface IDispatcher {

    event OperatorSet(address indexed account, bool isOperator);
    event CalldataStored(uint256 indexed calldataID);

    struct Call {
        address target;
        bytes callData;
    }

    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct Call3Value {
        address target;
        bool allowFailure;
        uint256 value;
        bytes callData;
    }

    struct Call4 {
        bool allowFailure;
        uint256 calldataID;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    /***************************************
    AGGREGATE FUNCTIONS
    ***************************************/

    /// @notice Backwards-compatible call aggregation with Multicall
    /// @param calls An array of Call structs
    /// @return blockNumber The block number where the calls were executed
    /// @return returnData An array of bytes containing the responses
    function aggregate(Call[] calldata calls) external payable returns (uint256 blockNumber, bytes[] memory returnData);

    /// @notice Backwards-compatible with Multicall2
    /// @notice Aggregate calls without requiring success
    /// @param requireSuccess If true, require all calls to succeed
    /// @param calls An array of Call structs
    /// @return returnData An array of Result structs
    function tryAggregate(bool requireSuccess, Call[] calldata calls) external payable returns (Result[] memory returnData);

    /// @notice Backwards-compatible with Multicall2
    /// @notice Aggregate calls and allow failures using tryAggregate
    /// @param calls An array of Call structs
    /// @return blockNumber The block number where the calls were executed
    /// @return blockHash The hash of the block where the calls were executed
    /// @return returnData An array of Result structs
    function tryBlockAndAggregate(bool requireSuccess, Call[] calldata calls) external payable returns (uint256 blockNumber, bytes32 blockHash, Result[] memory returnData);

    /// @notice Backwards-compatible with Multicall2
    /// @notice Aggregate calls and allow failures using tryAggregate
    /// @param calls An array of Call structs
    /// @return blockNumber The block number where the calls were executed
    /// @return blockHash The hash of the block where the calls were executed
    /// @return returnData An array of Result structs
    function blockAndAggregate(Call[] calldata calls) external payable returns (uint256 blockNumber, bytes32 blockHash, Result[] memory returnData);

    /// @notice Aggregate calls, ensuring each returns success if required
    /// @param calls An array of Call3 structs
    /// @return returnData An array of Result structs
    function aggregate3(Call3[] calldata calls) external payable returns (Result[] memory returnData);

    /// @notice Aggregate calls with a msg value
    /// @notice Reverts if msg.value is less than the sum of the call values
    /// @param calls An array of Call3Value structs
    /// @return returnData An array of Result structs
    function aggregate3Value(Call3Value[] calldata calls) external payable returns (Result[] memory returnData);

    /***************************************
    AGGREGATE AND STORE FUNCTIONS
    ***************************************/

    /// @notice Backwards-compatible call aggregation with Multicall
    /// @param calls An array of Call structs
    /// @return blockNumber The block number where the calls were executed
    /// @return returnData An array of bytes containing the responses
    function aggregateAndStore(Call[] calldata calls) external payable returns (uint256 blockNumber, bytes[] memory returnData, uint256[] memory calldataIDs);

    /// @notice Aggregate calls, ensuring each returns success if required
    /// @param calls An array of Call3 structs
    /// @return returnData An array of Result structs
    function aggregate3AndStore(Call3[] calldata calls) external payable returns (Result[] memory returnData, uint256[] memory calldataIDs);

    /// @notice Aggregate calls with a msg value
    /// @notice Reverts if msg.value is less than the sum of the call values
    /// @param calls An array of Call3Value structs
    /// @return returnData An array of Result structs
    function aggregate3ValueAndStore(Call3Value[] calldata calls) external payable returns (Result[] memory returnData, uint256[] memory calldataIDs);

    /***************************************
    AGGREGATE FROM STORAGE FUNCTIONS
    ***************************************/

    /**
     * @notice Calls a target using previously stored calldata.
     * @param target The target to call.
     * @param calldataID The ID of the calldata to send.
     * @param returnData The results.
     */
    function aggregateFromStorage1(address target, uint256 calldataID) external payable returns (bytes memory returnData);

    /**
     * @notice Calls a target using previously stored calldata.
     * @param target The target to call.
     * @param calldataIDs The list of IDs of the calldatas to send.
     * @param returnData An array of results.
     */
    function aggregateFromStorage2(address target, uint256[] calldata calldataIDs) external payable returns (bytes[] memory returnData);

    /**
     * @notice Calls a target using previously stored calldata.
     * @param target The target to call.
     * @param calls The list of calls to send.
     * @param returnData An array of results.
     */
    function aggregateFromStorage3(address target, Call4[] calldata calls) external payable returns (Result[] memory returnData);

    /**
     * @notice Calls multiple targets using previously stored calldata.
     * @param targets The targets to call.
     * @param calldataID The ID of the calldata to send.
     * @param returnData An array of results.
     */
    function aggregateFromStorage4(address[] calldata targets, uint256 calldataID) external payable returns (bytes[] memory returnData);

    /**
     * @notice Calls multiple targets using previously stored calldata.
     * @param targets The targets to call.
     * @param calldataIDs The list of IDs of the calldatas to send.
     * @param returnData An array of results.
     */
    function aggregateFromStorage5(address[] calldata targets, uint256[] calldata calldataIDs) external payable returns (bytes[] memory returnData);

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns true if the account is an operator.
     * @param account The account to query.
     * @return isAuthorized True if is an operator, false otherwise.
     */
    function isOperator(address account) external view returns (bool isAuthorized);

    /**
     * @notice Returns the number of calldatas that were stored.
     * @return len The count.
     */
    function storedCalldatasLength() external view returns (uint256 len);

    /**
     * @notice Returns a stored calldata.
     * @param calldataID The ID of the calldata.
     * @return data The calldata stored at that index.
     */
    function storedCalldatas(uint256 calldataID) external view returns (bytes memory data);

    /***************************************
    OWNER FUNCTIONS
    ***************************************/

    struct SetOperatorParam {
        address account;
        bool isAuthorized;
    }

    /**
     * @notice Sets the status of a list of operators.
     * Can only be called by the contract owner.
     * @param params The list to set.
     */
    function setOperators(SetOperatorParam[] calldata params) external payable;
}
