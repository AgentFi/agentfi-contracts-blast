// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

error InvalidOperation();
error ContractCreationFailed();
error NotAuthorized();
error InvalidInput();
error ExceedsMaxLockTime();
error AccountLocked();
error InvalidAccountProof();
error InvalidGuardian();
error InvalidImplementation();
error AlreadyInitialized();
error InvalidEntryPoint();
error InvalidMulticallForwarder();
error InvalidERC6551Registry();

// call errors
/// @notice Thrown when a low level call reverts without a reason.
error CallFailed();
/// @notice Thrown when a low level delegatecall reverts without a reason.
error DelegateCallFailed();
/// @notice Thrown when using an address with no code.
error NotAContract();

// tba creation errors
/// @notice Thrown when attempting to create a agent from an account that is not whitelisted.
error FactoryNotWhitelisted();
/// @notice Thrown when call a contract that has been paused.
error ContractPaused();

// nft errors
/// @notice Thrown when querying an erc721 token that does not exist.
error TokenDoesNotExist();
/// @notice Thrown when transferring a bot nft to the bot account.
error OwnershipCycle();
