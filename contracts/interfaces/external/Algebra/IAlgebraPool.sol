// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;


interface IAlgebraPool {
    /// @notice The first of the two tokens of the pool, sorted by address
    /// @return The token contract address
    function token0() external view returns (address);

    /// @notice The second of the two tokens of the pool, sorted by address
    /// @return The token contract address
    function token1() external view returns (address);

    /// @notice The current pool fee value
    /// @dev In case dynamic fee is enabled in the pool, this method will call the plugin to get the current fee.
    /// If the plugin implements complex fee logic, this method may return an incorrect value or revert.
    /// In this case, see the plugin implementation and related documentation.
    /// @dev **important security note: caller should check reentrancy lock to prevent read-only reentrancy**
    /// @return currentFee The current pool fee value in hundredths of a bip, i.e. 1e-6
    function fee() external view returns (uint16 currentFee);

    /// @notice The pool tick spacing
    /// @dev Ticks can only be used at multiples of this value, minimum of 1 and always positive
    /// e.g.: a tickSpacing of 3 means ticks can be initialized every 3rd tick, i.e., ..., -6, -3, 0, 3, 6, ...
    /// This value is an int24 to avoid casting even though it is always positive.
    /// @return The tick spacing
    function tickSpacing() external view returns (int24);

    /// @notice Safely get most important state values of Algebra Integral AMM
    /// @dev Several values exposed as a single method to save gas when accessed externally.
    /// **Important security note: this method checks reentrancy lock and should be preferred in most cases**.
    /// @return sqrtPrice The current price of the pool as a sqrt(dToken1/dToken0) Q64.96 value
    /// @return tick The current global tick of the pool. May not always be equal to SqrtTickMath.getTickAtSqrtRatio(price) if the price is on a tick boundary
    /// @return lastFee The current (last known) pool fee value in hundredths of a bip, i.e. 1e-6 (so '100' is '0.01%'). May be obsolete if using dynamic fee plugin
    /// @return pluginConfig The current plugin config as bitmap. Each bit is responsible for enabling/disabling the hooks, the last bit turns on/off dynamic fees logic
    /// @return activeLiquidity  The currently in-range liquidity available to the pool
    /// @return nextTick The next initialized tick after current global tick
    /// @return previousTick The previous initialized tick before (or at) current global tick
    function safelyGetStateOfAMM() external view returns (
        uint160 sqrtPrice,
        int24 tick,
        uint16 lastFee,
        uint8 pluginConfig,
        uint128 activeLiquidity,
        int24 nextTick,
        int24 previousTick
    );

    /// @notice The globalState structure in the pool stores many values but requires only one slot
    /// and is exposed as a single method to save gas when accessed externally.
    /// @dev **important security note: caller should check `unlocked` flag to prevent read-only reentrancy**
    /// @return price The current price of the pool as a sqrt(dToken1/dToken0) Q64.96 value
    /// @return tick The current tick of the pool, i.e. according to the last tick transition that was run
    /// This value may not always be equal to SqrtTickMath.getTickAtSqrtRatio(price) if the price is on a tick boundary
    /// @return lastFee The current (last known) pool fee value in hundredths of a bip, i.e. 1e-6 (so '100' is '0.01%'). May be obsolete if using dynamic fee plugin
    /// @return pluginConfig The current plugin config as bitmap. Each bit is responsible for enabling/disabling the hooks, the last bit turns on/off dynamic fees logic
    /// @return communityFee The community fee represented as a percent of all collected fee in thousandths, i.e. 1e-3 (so 100 is 10%)
    /// @return unlocked Reentrancy lock flag, true if the pool currently is unlocked, otherwise - false
    function globalState() external view returns (uint160 price, int24 tick, uint16 lastFee, uint8 pluginConfig, uint16 communityFee, bool unlocked);

    // ####  pool errors  ####

    /// @notice Emitted by the reentrancy guard
    error locked();

    /// @notice Emitted if arithmetic error occurred
    error arithmeticError();

    /// @notice Emitted if an attempt is made to initialize the pool twice
    error alreadyInitialized();

    /// @notice Emitted if an attempt is made to mint or swap in uninitialized pool
    error notInitialized();

    /// @notice Emitted if 0 is passed as amountRequired to swap function
    error zeroAmountRequired();

    /// @notice Emitted if invalid amount is passed as amountRequired to swap function
    error invalidAmountRequired();

    /// @notice Emitted if the pool received fewer tokens than it should have
    error insufficientInputAmount();

    /// @notice Emitted if there was an attempt to mint zero liquidity
    error zeroLiquidityDesired();
    /// @notice Emitted if actual amount of liquidity is zero (due to insufficient amount of tokens received)
    error zeroLiquidityActual();

    /// @notice Emitted if the pool received fewer tokens0 after flash than it should have
    error flashInsufficientPaid0();
    /// @notice Emitted if the pool received fewer tokens1 after flash than it should have
    error flashInsufficientPaid1();

    /// @notice Emitted if limitSqrtPrice param is incorrect
    error invalidLimitSqrtPrice();

    /// @notice Tick must be divisible by tickspacing
    error tickIsNotSpaced();

    /// @notice Emitted if a method is called that is accessible only to the factory owner or dedicated role
    error notAllowed();

    /// @notice Emitted if new tick spacing exceeds max allowed value
    error invalidNewTickSpacing();
    /// @notice Emitted if new community fee exceeds max allowed value
    error invalidNewCommunityFee();

    /// @notice Emitted if an attempt is made to manually change the fee value, but dynamic fee is enabled
    error dynamicFeeActive();
    /// @notice Emitted if an attempt is made by plugin to change the fee value, but dynamic fee is disabled
    error dynamicFeeDisabled();
    /// @notice Emitted if an attempt is made to change the plugin configuration, but the plugin is not connected
    error pluginIsNotConnected();
    /// @notice Emitted if a plugin returns invalid selector after hook call
    /// @param expectedSelector The expected selector
    error invalidHookResponse(bytes4 expectedSelector);

    // ####  LiquidityMath errors  ####

    /// @notice Emitted if liquidity underflows
    error liquiditySub();
    /// @notice Emitted if liquidity overflows
    error liquidityAdd();

    // ####  TickManagement errors  ####

    /// @notice Emitted if the topTick param not greater then the bottomTick param
    error topTickLowerOrEqBottomTick();
    /// @notice Emitted if the bottomTick param is lower than min allowed value
    error bottomTickLowerThanMIN();
    /// @notice Emitted if the topTick param is greater than max allowed value
    error topTickAboveMAX();
    /// @notice Emitted if the liquidity value associated with the tick exceeds MAX_LIQUIDITY_PER_TICK
    error liquidityOverflow();
    /// @notice Emitted if an attempt is made to interact with an uninitialized tick
    error tickIsNotInitialized();
    /// @notice Emitted if there is an attempt to insert a new tick into the list of ticks with incorrect indexes of the previous and next ticks
    error tickInvalidLinks();

    // ####  SafeTransfer errors  ####

    /// @notice Emitted if token transfer failed internally
    error transferFailed();

    // ####  TickMath errors  ####

    /// @notice Emitted if tick is greater than the maximum or less than the minimum allowed value
    error tickOutOfRange();
    /// @notice Emitted if price is greater than the maximum or less than the minimum allowed value
    error priceOutOfRange();

    /// @notice Emitted by the pool for any swaps between token0 and token1
    /// @param sender The address that initiated the swap call, and that received the callback
    /// @param recipient The address that received the output of the swap
    /// @param amount0 The delta of the token0 balance of the pool
    /// @param amount1 The delta of the token1 balance of the pool
    /// @param price The sqrt(price) of the pool after the swap, as a Q64.96
    /// @param liquidity The liquidity of the pool after the swap
    /// @param tick The log base 1.0001 of price of the pool after the swap
    event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 price, uint128 liquidity, int24 tick);
}
