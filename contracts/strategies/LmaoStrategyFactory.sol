// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Multicall } from "@openzeppelin/contracts/utils/Multicall.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { Calls } from "./../utils/Calls.sol";
import "./../utils/Errors.sol";
import { LmaoStrategyNft } from "./LmaoStrategyNft.sol";


/**
 * @title LmaoStrategyFactory
 * @author LMAO Labs
 * @notice A factory for LMAO strategys.
 *
 * Users can use [`createStrategy()`](#createstrategy) to create a new strategy. The strategy will be created based on settings stored in the factory by the contract owner. These settings can be viewed via [`getStrategyCreationSettings()`](#getstrategycreationsettings).
 */
contract LmaoStrategyFactory is Multicall, Ownable2Step {

    /***************************************
    EVENTS
    ***************************************/

    /// @notice Emitted when the strategy implementation is set.
    event StrategyImplementationSet(address indexed strategyImplementation);
    /// @notice Emitted when the strategy initialization code is set.
    event StrategyInitializationCodeSet(bytes strategyInitializationCode1, bytes strategyInitializationCode2);
    /// @notice Emitted when the pause state is set.
    event PauseSet(bool status);

    address internal _strategyNft;
    address internal _strategyImplementation;
    bytes internal _strategyInitializationCode1;
    bytes internal _strategyInitializationCode2;
    bool internal _isPaused;

    /**
     * @notice Constructs the factory contract.
     * @param owner_ The contract owner.
     * @param strategyNft The LmaoStrategys contract.
     * @param strategyImplementation The strategy implementation.
     * @param strategyInitializationCode1 The first part of the strategy initialization code.
     * @param strategyInitializationCode2 The second part of the strategy initialization code.
     */
    constructor(
        address owner_,
        address strategyNft,
        address strategyImplementation,
        bytes memory strategyInitializationCode1,
        bytes memory strategyInitializationCode2
    ) Ownable(owner_) {
        _strategyNft = strategyNft;
        _setStrategyImplementationAddress(strategyImplementation);
        _setStrategyInitializationCode(strategyInitializationCode1, strategyInitializationCode2);
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Gets the strategy creation settings.
     * @return strategyNft The LmaoStrategys contract.
     * @return strategyImplementation The strategy implementation.
     * @return strategyInitializationCode1 The first part of the strategy initialization code.
     * @return strategyInitializationCode2 The second part of the strategy initialization code.
     */
    function getStrategyCreationSettings() external view returns (
        address strategyNft,
        address strategyImplementation,
        bytes memory strategyInitializationCode1,
        bytes memory strategyInitializationCode2
    ) {
        strategyNft = _strategyNft;
        strategyImplementation = _strategyImplementation;
        strategyInitializationCode1 = _strategyInitializationCode1;
        strategyInitializationCode2 = _strategyInitializationCode2;
    }

    /**
     * @notice Returns true if creation of new strategys via this factory is paused.
     * @return isPaused_ True if creation is paused, false otherwise.
     */
    function isPaused() external view returns (bool isPaused_) {
        return _isPaused;
    }

    /***************************************
    CREATE STRATEGY FUNCTIONS
    ***************************************/

    /**
     * @notice Creates a new strategy.
     * The new strategy will be transferred to `msg.sender`.
     * @return strategyID The ID of the newly created strategy.
     * @return strategyAddress The address of the newly created strategy.
     */
    function createStrategy() external payable returns (uint256 strategyID, address strategyAddress) {
        LmaoStrategyNft strategyNft = LmaoStrategyNft(_strategyNft);
        (strategyID, strategyAddress) = _createStrategy(strategyNft);
        strategyNft.transferFrom(address(this), msg.sender, strategyID);
    }

    /**
     * @notice Creates a new strategy.
     * The new strategy will be transferred to `msg.sender`.
     * @param callData Extra data to pass to the strategy after it is created.
     * @return strategyID The ID of the newly created strategy.
     * @return strategyAddress The address of the newly created strategy.
     */
    function createStrategy(bytes calldata callData) external payable returns (uint256 strategyID, address strategyAddress) {
        LmaoStrategyNft strategyNft = LmaoStrategyNft(_strategyNft);
        (strategyID, strategyAddress) = _createStrategy(strategyNft);
        _callStrategy(strategyAddress, callData);
        strategyNft.transferFrom(address(this), msg.sender, strategyID);
    }

    /***************************************
    OWNER FUNCTIONS
    ***************************************/

    /**
     * @notice Sets the strategy implementation.
     * Can only be called by the contract owner.
     * @param strategyImplementation The address of the strategy implementation.
     */
    function setStrategyImplementationAddress(address strategyImplementation) external payable onlyOwner {
        _setStrategyImplementationAddress(strategyImplementation);
    }

    /**
     * @notice Sets the strategy initialization code.
     * Can only be called by the contract owner.
     * @param strategyInitializationCode1 The first part of the strategy initialization code.
     * @param strategyInitializationCode2 The second part of the strategy initialization code.
     */
    function setStrategyInitializationCode(bytes memory strategyInitializationCode1, bytes memory strategyInitializationCode2) external payable onlyOwner {
        _setStrategyInitializationCode(strategyInitializationCode1, strategyInitializationCode2);
    }

    /**
     * @notice Sets the pause state of the contract.
     * Allows or disallows creation of new strategys.
     * Can only be called by the contract owner.
     * @param status True to pause, false to unpause.
     */
    function setPaused(bool status) external payable onlyOwner {
        _isPaused = status;
        emit PauseSet(status);
    }

    /***************************************
    HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Creates a new strategy.
     * @param strategyNft The strategy nft contract.
     * @return strategyID The ID of the newly created strategy.
     * @return strategyAddress The address of the newly created strategy.
     */
    function _createStrategy(LmaoStrategyNft strategyNft) internal returns (uint256 strategyID, address strategyAddress) {
        if(_isPaused) revert ContractPaused();
        (strategyID, strategyAddress) = strategyNft.createStrategy(_strategyImplementation);
        _callStrategy(strategyAddress, _strategyInitializationCode1);
        _callStrategy(strategyAddress, _strategyInitializationCode2);
    }

    /**
     * @notice Calls a strategy.
     * @param strategyAddress The address of the strategy.
     * @param callData The data to pass to the strategy.
     */
    function _callStrategy(address strategyAddress, bytes memory callData) internal {
        if(callData.length == 0) return;
        Calls.functionCall(strategyAddress, callData);
    }

    /**
     * @notice Sets the strategy implementation.
     * @param strategyImplementation The address of the strategy implementation.
     */
    function _setStrategyImplementationAddress(address strategyImplementation) internal {
        uint256 contractSize;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            contractSize := extcodesize(strategyImplementation)
        }
        if(contractSize == 0) revert NotAContract();
        _strategyImplementation = strategyImplementation;
        emit StrategyImplementationSet(strategyImplementation);
    }

    /**
     * @notice Sets the strategy initialization code.
     * Can only be called by the contract owner.
     * @param strategyInitializationCode1 The first part of the strategy initialization code.
     * @param strategyInitializationCode2 The second part of the strategy initialization code.
     */
    function _setStrategyInitializationCode(bytes memory strategyInitializationCode1, bytes memory strategyInitializationCode2) internal {
        _strategyInitializationCode1 = strategyInitializationCode1;
        _strategyInitializationCode2 = strategyInitializationCode2;
        emit StrategyInitializationCodeSet(strategyInitializationCode1, strategyInitializationCode2);
    }
}
