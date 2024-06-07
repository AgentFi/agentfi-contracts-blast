// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IOErc20Delegator } from "./../external/Orbit/IOErc20Delegator.sol";
import { IOrbitSpaceStationV4 } from "./../external/Orbit/IOrbitSpaceStationV4.sol";
import { IWrapMintV2 } from "./../external/Duo/IWrapMintV2.sol";

/**
 * @title ILoopooorModuleD
 * @author AgentFi
 * @notice Interface for the LoopooorModuleD contract.
 */
interface ILoopooorModuleD {
    /***************************************
    ENUMS
    ***************************************/

    enum MODE {
        DIRECT, // Direct 
        FIXED_RATE, // Mint Fixed Rate
        VARIABLE_RATE // Mint Variable Rate
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the name of the module.
     * @return name_ The name of the module.
     */
    function moduleName() external pure returns (string memory name_);

    /**
     * @notice Returns the type of the strategy.
     * @return type_ The type of the strategy.
     */
    function strategyType() external pure returns (string memory type_);

    /**
     * @notice Returns the Ethereum address.
     * @return The Ethereum address.
     */
    function eth() external pure returns (address);

    /**
     * @notice Returns the Wrapped Ethereum address.
     * @return The Wrapped Ethereum address.
     */
    function weth() external pure returns (address);

    /**
     * @notice Returns the current mode of the contract.
     * @return The current mode of the contract.
     */
    function mode() external view returns (MODE);

    /**
     * @notice Returns the address of the rate contract.
     * @return The address of the rate contract.
     */
    function rateContract() external view returns (address);

    /**
     * @notice Returns the address of the underlying asset.
     * @return The address of the underlying asset.
     */
    function underlying() external view returns (address);

    /**
     * @notice Returns the address of the WrapMint contract.
     * @return The address of the WrapMint contract.
     */
    function wrapMint() external view returns (address);

    /**
     * @notice Returns the oToken contract.
     * @return The oToken contract.
     */
    function oToken() external view returns (IOErc20Delegator);

    /**
     * @notice Returns the Orbit comptroller contract.
     * @return The Orbit comptroller contract.
     */
    function comptroller() external view returns (IOrbitSpaceStationV4);

    /**
     * @notice Returns the supply balance of the contract.
     * @return supply_ The supply balance of the contract.
     */
    function supplyBalance() external view returns (uint256 supply_);

    /**
     * @notice Returns the borrow balance of the contract.
     * @return borrow_ The borrow balance of the contract.
     */
    function borrowBalance() external view returns (uint256 borrow_);

    /**
     * @notice Returns the address of the Duo asset.
     * @return The address of the Duo asset.
     */
    function duoAsset() external view returns (IERC20);

    /**
     * @notice Returns orbit, both in tba and unclaimed in the contract.
     * @dev Should be a view function, but requires on state change and revert
     */
    function quoteClaim() external returns (uint256 balance_);
    /***************************************
    LOW LEVEL DUO MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Mints a fixed rate position using the WrapMint contract.
     * @param wrapMint The address of the wrap contract.
     * @param exchange The address of the exchange contract.
     * @param token The address of the token to be used.
     * @param amountIn The amount of tokens to be deposited.
     * @param amountOutMin The minimum amount of tokens to be received.
     * @param minLockedYield The minimum locked yield.
     * @param data Additional data for the WrapMint contract.
     * @return fixedRateContract_ The address of the fixed rate contract.
     * @return amountOut The amount of tokens received.
     * @return lockedYield The locked yield.
     */
    function moduleD_mintFixedRate(
        address wrapMint,
        address exchange,
        address token,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 minLockedYield,
        bytes memory data
    ) external payable returns (address fixedRateContract_, uint256 amountOut, uint256 lockedYield);

    /**
     * @notice Mints a fixed rate position using the WrapMint contract with Ether.
     * @param wrapMint The address of the wrap contract.
     * @param exchange The address of the exchange contract.
     * @param amountIn The amount of Ether to be deposited.
     * @param amountOutMin The minimum amount of tokens to be received.
     * @param minLockedYield The minimum locked yield.
     * @param data Additional data for the WrapMint contract.
     * @return fixedRateContract_ The address of the fixed rate contract.
     * @return amountOut The amount of tokens received.
     * @return lockedYield The locked yield.
     */
    function moduleD_mintFixedRateEth(
        address wrapMint,
        address exchange,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 minLockedYield,
        bytes calldata data
    ) external payable returns (address fixedRateContract_, uint256 amountOut, uint256 lockedYield);

    /**
     * @notice Mints a variable rate position using the WrapMint contract.
     * @param wrapMint The address of the wrap contract.
     * @param exchange The address of the exchange contract.
     * @param token The address of the token to be used.
     * @param amountIn The amount of tokens to be deposited.
     * @param amountOutMin The minimum amount of tokens to be received.
     * @param data Additional data for the WrapMint contract.
     * @return variableRateContract_ The address of the variable rate contract.
     * @return amountOut The amount of tokens received.
     */
    function moduleD_mintVariableRate(
        address wrapMint,
        address exchange,
        address token,
        uint256 amountIn,
        uint256 amountOutMin,
        bytes memory data
    ) external payable returns (address variableRateContract_, uint256 amountOut);

    /**
     * @notice Mints a variable rate position using the WrapMint contract with Ether.
     * @param wrapMint The address of the wrap contract.
     * @param exchange The address of the exchange contract.
     * @param amountIn The amount of Ether to be deposited.
     * @param amountOutMin The minimum amount of tokens to be received.
     * @param data Additional data for the WrapMint contract.
     * @return variableRateContract_ The address of the variable rate contract.
     * @return amountOut The amount of tokens received.
     */
    function moduleD_mintVariableRateEth(
        address wrapMint,
        address exchange,
        uint256 amountIn,
        uint256 amountOutMin,
        bytes memory data
    ) external payable returns (address variableRateContract_, uint256 amountOut);

    /**
     * @notice Burns a variable rate position using the WrapMint contract.
     * @param wrapMint The address of the wrap contract.
     * @param variableRate The address of the variable rate contract.
     * @param amount The amount of tokens to be burned.
     * @param minYield The minimum yield to be received.
     * @return yieldToUnlock The amount of yield to be unlocked.
     * @return yieldToRelease The amount of yield to be released.
     */
    function moduleD_burnVariableRate(
        address wrapMint,
        address variableRate,
        uint256 amount,
        uint256 minYield
    ) external payable returns (uint256 yieldToUnlock, uint256 yieldToRelease);

    /**
     * @notice Burns a fixed rate position using the WrapMint contract.
     * @param wrapMint The address of the wrap contract.
     * @param fixedRate The address of the fixed rate contract.
     * @param amount The amount of tokens to be burned.
     * @return yieldToUnlock The amount of yield to be unlocked.
     * @return yieldToRelease The amount of yield to be released.
     */
    function moduleD_burnFixedRate(address wrapMint, address fixedRate, uint256 amount)
        external
        payable
        returns (uint256 yieldToUnlock, uint256 yieldToRelease);

    /***************************************
    LOW LEVEL ORBITER MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Borrows tokens from the Orbit protocol.
     * @param oToken The address of the oToken contract.
     * @param borrowAmount The amount of tokens to be borrowed.
     * @return The amount of tokens borrowed.
     */
    function moduleD_borrow(address oToken, uint256 borrowAmount) external payable returns (uint256);

    /**
     * @notice Mints tokens in the Orbit protocol.
     * @param oToken The address of the oToken contract.
     * @param mintAmount The amount of tokens to be minted.
     * @return The amount of tokens minted.
     */
    function moduleD_mint(address oToken, uint256 mintAmount) external payable returns (uint256);

    /**
     * @notice Repays a borrow in the Orbit protocol.
     * @param oToken The address of the oToken contract.
     * @param repayAmount The amount of tokens to be repaid.
     * @return The amount of tokens repaid.
     */
    function moduleD_repayBorrow(address oToken, uint256 repayAmount) external payable returns (uint256);

    /**
     * @notice Redeems tokens from the Orbit protocol.
     * @param oToken The address of the oToken contract.
     * @param redeemTokens The amount of tokens to be redeemed.
     * @return The amount of tokens redeemed.
     */
    function moduleD_redeem(address oToken, uint256 redeemTokens) external payable returns (uint256);

    /**
     * @notice Enters the specified markets in the Orbit protocol.
     * @param comptroller The address of the comptroller contract.
     * @param oTokens The addresses of the oTokens to enter.
     * @return The error codes for each market entered.
     */
    function moduleD_enterMarkets(address comptroller, address[] memory oTokens) external payable returns (uint256[] memory);

    /***************************************
    HIGH LEVEL AGENT MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Deposits the balance into the Orbit protocol and mints a fixed or variable rate position.
     * @param wrapMint_ The address of the WrapMint contract.
     * @param oToken_ The address of the oToken contract.
     * @param underlying_ The address of the underlying asset.
     * @param mode_ The mode to be used (fixed or variable rate).
     * @param leverage The leverage to be used.
     */
    function moduleD_depositBalance(
        address wrapMint_,
        address oToken_,
        address underlying_,
        MODE mode_,
        uint256 leverage
    ) external payable;

    /**
     * @notice Withdraws the balance from the Orbit protocol and burns the fixed or variable rate position.
     */
    function moduleD_withdrawBalance() external payable;

    /**
     * @notice Withdraws the balance from the Orbit protocol and burns the fixed or variable rate position, then sends the balance to the specified receiver.
     * @param receiver The address to send the balance to.
     */
    function moduleD_withdrawBalanceTo(address receiver) external payable;

    /**
     * @notice Sends the balance of the specified token to the specified receiver.
     * @param receiver The address to send the balance to.
     * @param token The address of the token to be sent.
     */
    function moduleD_sendBalanceTo(address receiver, address token) external payable;
}
