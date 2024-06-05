// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IConcentratedLiquidityModuleC
 * @author AgentFi
 * @notice A module used in the Concentrated liquidity strategy.
 * @dev Designed for use on Blast Mainnet only
 */
interface IConcentratedLiquidityModuleC {

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    function moduleName() external pure returns (string memory name_);

    function strategyType() external pure returns (string memory type_);

    /// @notice Address for the NonfungiblePositionManager
    function manager() external view returns (address manager_);

    function pool() external view returns (address pool_);

    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );

    /// @notice TokenId of NFT position (if exists)
    function tokenId() external view returns (uint256 tokenId_);

    /***************************************
    Wrapper functions around NonfungiblePositionManager
    ***************************************/
    /**
     * @notice Get the underlying pool position
     * @dev reverts if no position exists
     */
    function position()
        external
        view
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        );

    struct MintParams {
        address manager;
        address pool;
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }
    /// @notice Creates a new position wrapped in a NFT
    /// @dev Call this when the pool does exist and is initialized. Note that if the pool is created but not initialized
    /// a method does not exist, i.e. the pool is assumed to be initialized.
    /// @param params The params necessary to mint a position, encoded as `MintParams` in calldata
    /// @return tokenId_ The ID of the token that represents the minted position
    /// @return liquidity The amount of liquidity for this position
    /// @return amount0 The amount of token0
    /// @return amount1 The amount of token1
    function moduleC_mint(
        MintParams memory params
    ) external payable returns (uint256 tokenId_, uint128 liquidity, uint256 amount0, uint256 amount1);

    // As INonfungiblePositionManager.IncreaseLiquiditParams, but without tokenId
    struct IncreaseLiquidityParams {
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    /// @notice Increases the amount of liquidity in a position, with tokens paid by the `msg.sender`
    /// amount0Desired The desired amount of token0 to be spent,
    /// amount1Desired The desired amount of token1 to be spent,
    /// amount0Min The minimum amount of token0 to spend, which serves as a slippage check,
    /// amount1Min The minimum amount of token1 to spend, which serves as a slippage check,
    /// deadline The time by which the transaction must be included to effect the change
    /// @return liquidity The new liquidity amount as a result of the increase
    /// @return amount0 The amount of token0 to acheive resulting liquidity
    /// @return amount1 The amount of token1 to acheive resulting liquidity
    function moduleC_increaseLiquidity(
        IncreaseLiquidityParams memory params
    ) external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1);

    // As INonfungiblePositionManager.DecreaseLiquiditParams, but without tokenId
    struct DecreaseLiquidityParams {
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    function moduleC_decreaseLiquidity(
        DecreaseLiquidityParams memory params
    ) external payable returns (uint256 amount0, uint256 amount1);

    // As INonfungiblePositionManager.CollectParams, but without tokenId and recipient
    struct CollectParams {
        uint128 amount0Max;
        uint128 amount1Max;
    }

    function moduleC_collect(
        CollectParams memory params
    ) external payable returns (uint256 amount0, uint256 amount1);

    function moduleC_burn() external payable;

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    /// @notice Swaps `amountIn` of one token for as much as possible of another token
    /// @param params The parameters necessary for the swap, encoded as `ExactInputSingleParams` in calldata
    /// @return amountOut The amount of the received token
    function moduleC_exactInputSingle(
        address router,
        ExactInputSingleParams memory params
    ) external payable returns (uint256 amountOut);

    struct ExactInputSingle02Params {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    /// @notice Swaps `amountIn` of one token for as much as possible of another token
    /// @param params The parameters necessary for the swap, encoded as `ExactInputSingleParams` in calldata
    /// @return amountOut The amount of the received token
    function moduleC_exactInputSingle02(
        address router,
        ExactInputSingle02Params memory params
    ) external payable returns (uint256 amountOut);

    /***************************************
    AGENT HIGH LEVEL FUNCTIONS
    ***************************************/
    /// @notice Sends token balance to a specified receiver.
    function moduleC_sendBalanceTo(address receiver) external payable;

    struct MintBalanceParams {
        address manager;
        address pool;
        uint24 slippageLiquidity;
        int24 tickLower;
        int24 tickUpper;
        uint160 sqrtPriceX96;
    }

    /// @notice Mints new position with all assets in this contract
    function moduleC_mintWithBalance(
        MintBalanceParams memory params
    ) external payable returns (uint256, uint128, uint256, uint256);

    struct MintBalanceAndRefundParams {
        address manager;
        address pool;
        uint24 slippageLiquidity;
        int24 tickLower;
        int24 tickUpper;
        uint160 sqrtPriceX96;
        address receiver;
    }

    /// @notice Mints new position with all assets in this contract
    function moduleC_mintWithBalanceAndRefundTo(
        MintBalanceAndRefundParams memory params
    ) external payable returns (uint256 tokenId_, uint128 liquidity, uint256 amount0, uint256 amount1);

    /// @notice Deposit all assets in contract to existing position (does not change range)
    function moduleC_increaseLiquidityWithBalance(
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1);

    function moduleC_increaseLiquidityWithBalanceAndRefundTo(
        address receiver,
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1);

    /// @notice Collect tokens owned in position, keeping funds in the this contract
    function moduleC_collectToSelf() external payable returns (uint256, uint256);

    /// @notice Perform partial withdrawal, keeping funds in the this contract
    function moduleC_decreaseLiquidityWithSlippage(
        uint128 liquidity,
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) external payable returns (uint256, uint256);

    function moduleC_partialWithdrawalToSelf(
        uint128 liquidity,
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) external payable returns (uint256, uint256);

    /// @notice Withdrawals principal and fee, and burns position, returning the funds to this contract
    function moduleC_fullWithdrawToSelf(
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) external payable returns (uint256 amount0, uint256 amount1);

    /// @notice Collect tokens owned in position, sending funds to the receiver
    function moduleC_collectTo(address receiver) external payable;

    /// @notice Perform partial withdrawal, sending funds to the receiver
    function moduleC_partialWithdrawTo(
        address receiver,
        uint128 liquidity,
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) external payable;

    /// @notice Sends funds to receiver after withdrawaling position
    function moduleC_fullWithdrawTo(address receiver, uint160 sqrtPriceX96, uint24 slippageLiquidity) external payable;

    struct RebalanceParams {
        address router; // Address of router contract
        uint24 fee; // Fee pool to use
        uint24 slippageSwap; // slippageSwap to tolerate
        uint24 slippageLiquidity; // slippageSwap to tolerate
        int24 tickLower;
        int24 tickUpper;
        uint160 sqrtPriceX96;
    }

    /// @notice Withdrawals, swaps and creates a new position at the new range
    function moduleC_rebalance(RebalanceParams memory params) external payable;

    /// @notice Withdrawals, swaps and creates a new position at the new range
    function moduleC_rebalance02(RebalanceParams memory params) external payable;

    /***************************************
    INTERNAL FUNCTIONS
    ***************************************/


    /// @notice Perform a swap of tokens
    struct PerformSwapParams {
        address router;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint160 sqrtPriceX96;
        uint24 slippageSwap;
        uint24 fee;
    }
}
