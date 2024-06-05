// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { INonfungiblePositionManager } from "./../interfaces/external/Thruster/INonfungiblePositionManager.sol";
import { ISwapRouter } from "./../interfaces/external/Thruster/ISwapRouter.sol";
import { ISwapRouter02 } from "./../interfaces/external/Thruster/ISwapRouter02.sol";
import { IThrusterPool as IV3Pool } from "./../interfaces/external/Thruster/IThrusterPool.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { LiquidityAmounts } from "./../libraries/LiquidityAmounts.sol";
import { TickMath } from "./../libraries/TickMath.sol";
import { Blastable } from "./../utils/Blastable.sol";

/**
 * @title ConcentratedLiquidityModuleC
 * @author AgentFi
 * @notice A module used in the Concentrated liquidity strategy.
 * @dev Designed for use on Blast Mainnet only. Be careful of signature collisions
 *
 */
contract ConcentratedLiquidityModuleC is Blastable {
    uint24 internal constant SLIPPAGE_SCALE = 1_000_000; // 100%
    /***************************************
    State
    ***************************************/
    bytes32 private constant CONCENTRATED_LIQUIDITY_MODULEC_STORAGE_POSITION =
        keccak256("agentfi.storage.concentratedliquiditymodulec");

    struct ConcentratedLiquidityModuleCStorage {
        address manager;
        address pool;
        uint256 tokenId;
    }

    function concentratedLiquidityModuleCStorage()
        internal
        pure
        returns (ConcentratedLiquidityModuleCStorage storage s)
    {
        bytes32 position_ = CONCENTRATED_LIQUIDITY_MODULEC_STORAGE_POSITION;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            s.slot := position_
        }
    }

    /***************************************
    CONSTRUCTOR
    ***************************************/
    /**
     * @notice Constructs the ConcentratedLiquidityModuleC contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param gasCollector_ The address of the gas collector.
     * @param blastPoints_ The address of the blast points contract.
     * @param pointsOperator_ The address of the blast points operator.
     */
    constructor(
        address blast_,
        address gasCollector_,
        address blastPoints_,
        address pointsOperator_
    ) Blastable(blast_, gasCollector_, blastPoints_, pointsOperator_) {}

    /***************************************
    VIEW FUNCTIONS
    ***************************************/
    function moduleName() external pure returns (string memory name_) {
        name_ = "ConcentratedLiquidityModuleC";
    }

    function strategyType() external pure returns (string memory type_) {
        type_ = "Concentrated Liquidity";
    }

    /// @notice Address for the NonfungiblePositionManager
    function manager() public view virtual returns (address manager_) {
        manager_ = concentratedLiquidityModuleCStorage().manager;
    }

    function pool() public view returns (address pool_) {
        pool_ = concentratedLiquidityModuleCStorage().pool;
    }

    function slot0()
        public
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        )
    {
        return IV3Pool(concentratedLiquidityModuleCStorage().pool).slot0();
    }

    /// @notice TokenId of NFT position (if exists)
    function tokenId() public view returns (uint256 tokenId_) {
        tokenId_ = concentratedLiquidityModuleCStorage().tokenId;
    }

    /***************************************
    Wrapper functions around NonfungiblePositionManager
    ***************************************/
    /**
     * @notice Get the underlying pool position
     * @dev reverts if no position exists
     */
    function position()
        public
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
        )
    {
        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();
        uint256 tokenId = state.tokenId;
        if (tokenId == 0) revert Errors.NoPositionFound();
        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);
        return manager_.positions(tokenId);
    }

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
    ) public payable virtual returns (uint256 tokenId_, uint128 liquidity, uint256 amount0, uint256 amount1) {
        if (params.tickLower >= params.tickUpper) revert Errors.InvalidTickParam();
        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();
        if (state.tokenId != 0) revert Errors.PositionAlreadyExists();

        state.manager = params.manager;
        state.pool = params.pool;

        _checkApproval(params.token0, state.manager, params.amount0Desired);
        _checkApproval(params.token1, state.manager, params.amount1Desired);

        (tokenId_, liquidity, amount0, amount1) = INonfungiblePositionManager(params.manager).mint(
            INonfungiblePositionManager.MintParams({
                token0: params.token0,
                token1: params.token1,
                fee: params.fee,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                amount0Desired: params.amount0Desired,
                amount1Desired: params.amount1Desired,
                amount0Min: params.amount0Min,
                amount1Min: params.amount1Min,
                recipient: address(this),
                deadline: block.timestamp
            })
        );

        // Update state with new token
        state.tokenId = tokenId_;
    }

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
    ) public payable returns (uint128 liquidity, uint256 amount0, uint256 amount1) {
        (, , address token0, address token1, , , , , , , , ) = position();

        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();
        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);

        _checkApproval(token0, state.manager, params.amount0Desired);
        _checkApproval(token1, state.manager, params.amount1Desired);

        (liquidity, amount0, amount1) = manager_.increaseLiquidity(
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: state.tokenId,
                amount0Desired: params.amount0Desired,
                amount1Desired: params.amount1Desired,
                amount0Min: params.amount0Min,
                amount1Min: params.amount1Min,
                deadline: params.deadline
            })
        );
    }

    // As INonfungiblePositionManager.DecreaseLiquiditParams, but without tokenId
    struct DecreaseLiquidityParams {
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    function moduleC_decreaseLiquidity(
        DecreaseLiquidityParams memory params
    ) public payable virtual returns (uint256 amount0, uint256 amount1) {
        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();
        uint256 tokenId = state.tokenId;
        if (tokenId == 0) revert Errors.NoPositionFound();
        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);

        (amount0, amount1) = manager_.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: params.liquidity,
                amount0Min: params.amount0Min,
                amount1Min: params.amount1Min,
                deadline: params.deadline
            })
        );
    }

    // As INonfungiblePositionManager.CollectParams, but without tokenId and recipient
    struct CollectParams {
        uint128 amount0Max;
        uint128 amount1Max;
    }

    function moduleC_collect(
        CollectParams memory params
    ) public payable virtual returns (uint256 amount0, uint256 amount1) {
        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();
        uint256 tokenId = state.tokenId;
        if (tokenId == 0) revert Errors.NoPositionFound();
        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);

        (amount0, amount1) = manager_.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: params.amount0Max,
                amount1Max: params.amount1Max
            })
        );
    }

    function moduleC_burn() public payable virtual {
        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();
        uint256 tokenId = state.tokenId;
        if (tokenId == 0) revert Errors.NoPositionFound();

        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);
        manager_.burn(tokenId);
        state.tokenId = 0;
    }

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
    ) public payable returns (uint256 amountOut) {
        ISwapRouter swapRouter = ISwapRouter(router);

        // Set allowance
        _checkApproval(params.tokenIn, router, params.amountIn);

        amountOut = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: params.tokenIn,
                tokenOut: params.tokenOut,
                fee: params.fee,
                recipient: address(this),
                deadline: params.deadline,
                amountIn: params.amountIn,
                amountOutMinimum: params.amountOutMinimum,
                sqrtPriceLimitX96: params.sqrtPriceLimitX96
            })
        );
    }

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
    ) public payable returns (uint256 amountOut) {
        ISwapRouter02 swapRouter = ISwapRouter02(router);

        // Set allowance
        _checkApproval(params.tokenIn, router, params.amountIn);

        amountOut = swapRouter.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: params.tokenIn,
                tokenOut: params.tokenOut,
                fee: params.fee,
                recipient: address(this),
                amountIn: params.amountIn,
                amountOutMinimum: params.amountOutMinimum,
                sqrtPriceLimitX96: params.sqrtPriceLimitX96
            })
        );
    }

    /***************************************
    AGENT HIGH LEVEL FUNCTIONS
    ***************************************/
    /// @notice Sends token balance to a specified receiver.
    function moduleC_sendBalanceTo(address receiver) public payable virtual {
        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();

        IV3Pool pool_ = IV3Pool(state.pool);
        address[2] memory tokens = [pool_.token0(), pool_.token1()];

        for (uint256 i = 0; i < tokens.length; ++i) {
            address token = tokens[i];
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) {
                SafeERC20.safeTransfer(IERC20(token), receiver, balance);
            }
        }
    }

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
    ) public payable virtual returns (uint256, uint128, uint256, uint256) {
        if (params.slippageLiquidity > SLIPPAGE_SCALE) revert Errors.InvalidSlippageParam();

        IV3Pool pool_ = IV3Pool(params.pool);
        uint256 amount0Desired = IERC20(pool_.token0()).balanceOf(address(this));
        uint256 amount1Desired = IERC20(pool_.token1()).balanceOf(address(this));
        (uint256 amount0Min, uint256 amount1Min) = _getMinAmountsForIncrease(
            amount0Desired,
            amount1Desired,
            params.tickLower,
            params.tickUpper,
            params.sqrtPriceX96,
            params.slippageLiquidity
        );

        return
            moduleC_mint(
                MintParams({
                    manager: params.manager,
                    pool: params.pool,
                    token0: pool_.token0(),
                    token1: pool_.token1(),
                    fee: pool_.fee(),
                    tickLower: params.tickLower,
                    tickUpper: params.tickUpper,
                    amount0Desired: amount0Desired,
                    amount1Desired: amount1Desired,
                    amount0Min: amount0Min,
                    amount1Min: amount1Min,
                    deadline: block.timestamp
                })
            );
    }

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
    ) external payable virtual returns (uint256 tokenId_, uint128 liquidity, uint256 amount0, uint256 amount1) {
        (tokenId_, liquidity, amount0, amount1) = moduleC_mintWithBalance(
            MintBalanceParams({
                manager: params.manager,
                pool: params.pool,
                slippageLiquidity: params.slippageLiquidity,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                sqrtPriceX96: params.sqrtPriceX96
            })
        );

        moduleC_sendBalanceTo(params.receiver);
    }

    /// @notice Deposit all assets in contract to existing position (does not change range)
    function moduleC_increaseLiquidityWithBalance(
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) public payable virtual returns (uint128 liquidity, uint256 amount0, uint256 amount1) {
        if (slippageLiquidity > SLIPPAGE_SCALE) revert Errors.InvalidSlippageParam();

        (, , , , , int24 tickLower, int24 tickUpper, , , , , ) = position();
        (uint256 amount0Desired, uint256 amount1Desired) = _balance();
        (uint256 amount0Min, uint256 amount1Min) = _getMinAmountsForIncrease(
            amount0Desired,
            amount1Desired,
            tickLower,
            tickUpper,
            sqrtPriceX96,
            slippageLiquidity
        );
        (liquidity, amount0, amount1) = moduleC_increaseLiquidity(
            IncreaseLiquidityParams({
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                deadline: block.timestamp
            })
        );
    }

    function moduleC_increaseLiquidityWithBalanceAndRefundTo(
        address receiver,
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) external payable virtual returns (uint128 liquidity, uint256 amount0, uint256 amount1) {
        (liquidity, amount0, amount1) = moduleC_increaseLiquidityWithBalance(sqrtPriceX96, slippageLiquidity);
        moduleC_sendBalanceTo(receiver);
    }

    /// @notice Collect tokens owned in position, keeping funds in the this contract
    function moduleC_collectToSelf() public payable returns (uint256, uint256) {
        return moduleC_collect(CollectParams({ amount0Max: type(uint128).max, amount1Max: type(uint128).max }));
    }

    /// @notice Perform partial withdrawal, keeping funds in the this contract
    function moduleC_decreaseLiquidityWithSlippage(
        uint128 liquidity,
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) public payable returns (uint256, uint256) {
        (, , , , , int24 tickLower, int24 tickUpper, , , , , ) = position();
        // Get expected amounts, and apply a slippage
        (uint256 amount0Min, uint256 amount1Min) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96,
            TickMath.getSqrtRatioAtTick(tickLower),
            TickMath.getSqrtRatioAtTick(tickUpper),
            liquidity
        );
        amount0Min = Math.mulDiv(amount0Min, SLIPPAGE_SCALE - slippageLiquidity, SLIPPAGE_SCALE);
        amount1Min = Math.mulDiv(amount1Min, SLIPPAGE_SCALE - slippageLiquidity, SLIPPAGE_SCALE);

        return
            moduleC_decreaseLiquidity(
                DecreaseLiquidityParams({
                    liquidity: liquidity,
                    amount0Min: amount0Min,
                    amount1Min: amount1Min,
                    deadline: block.timestamp
                })
            );
    }

    function moduleC_partialWithdrawalToSelf(
        uint128 liquidity,
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) public payable returns (uint256, uint256) {
        moduleC_decreaseLiquidityWithSlippage(liquidity, sqrtPriceX96, slippageLiquidity);
        return moduleC_collectToSelf();
    }

    /// @notice Withdrawals principal and fee, and burns position, returning the funds to this contract
    function moduleC_fullWithdrawToSelf(
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) public payable returns (uint256 amount0, uint256 amount1) {
        (, , , , , , , uint128 liquidity, , , , ) = position();
        (amount0, amount1) = moduleC_partialWithdrawalToSelf(liquidity, sqrtPriceX96, slippageLiquidity);
        moduleC_burn();
    }

    /// @notice Collect tokens owned in position, sending funds to the receiver
    function moduleC_collectTo(address receiver) external payable virtual {
        moduleC_collectToSelf();
        moduleC_sendBalanceTo(receiver);
    }

    /// @notice Perform partial withdrawal, sending funds to the receiver
    function moduleC_partialWithdrawTo(
        address receiver,
        uint128 liquidity,
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) external payable {
        moduleC_partialWithdrawalToSelf(liquidity, sqrtPriceX96, slippageLiquidity);
        moduleC_sendBalanceTo(receiver);
    }

    /// @notice Sends funds to receiver after withdrawaling position
    function moduleC_fullWithdrawTo(address receiver, uint160 sqrtPriceX96, uint24 slippageLiquidity) external payable {
        moduleC_fullWithdrawToSelf(sqrtPriceX96, slippageLiquidity);
        moduleC_sendBalanceTo(receiver);
    }

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
    function moduleC_rebalance(RebalanceParams memory params) external payable {
        moduleC_fullWithdrawToSelf(params.sqrtPriceX96, params.slippageLiquidity);

        (address tokenIn, address tokenOut, uint256 amountIn) = _getSwapForNewRange(
            params.sqrtPriceX96,
            params.tickLower,
            params.tickUpper
        );
        _performSwap(
            PerformSwapParams({
                router: params.router,
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                amountIn: amountIn,
                slippageSwap: params.slippageSwap,
                fee: params.fee,
                sqrtPriceX96: params.sqrtPriceX96
            })
        );

        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();
        moduleC_mintWithBalance(
            MintBalanceParams({
                manager: state.manager,
                pool: state.pool,
                slippageLiquidity: params.slippageLiquidity,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                sqrtPriceX96: params.sqrtPriceX96
            })
        );
    }

    /// @notice Withdrawals, swaps and creates a new position at the new range
    function moduleC_rebalance02(RebalanceParams memory params) external payable {
        moduleC_fullWithdrawToSelf(params.sqrtPriceX96, params.slippageLiquidity);

        (address tokenIn, address tokenOut, uint256 amountIn) = _getSwapForNewRange(
            params.sqrtPriceX96,
            params.tickLower,
            params.tickUpper
        );
        _performSwap02(
            PerformSwapParams({
                router: params.router,
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                amountIn: amountIn,
                slippageSwap: params.slippageSwap,
                fee: params.fee,
                sqrtPriceX96: params.sqrtPriceX96
            })
        );

        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();
        moduleC_mintWithBalance(
            MintBalanceParams({
                manager: state.manager,
                pool: state.pool,
                slippageLiquidity: params.slippageLiquidity,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                sqrtPriceX96: params.sqrtPriceX96
            })
        );
    }

    /***************************************
    INTERNAL FUNCTIONS
    ***************************************/

    /**
     * @notice Rebalances tokens in contract to optimal ratio for depositing into position
     * @dev Not exact as it does not consider price impact of the swap
     */
    function _getSwapForNewRange(
        uint160 sqrtPriceX96,
        int24 tickLower,
        int24 tickUpper
    ) internal view returns (address, address, uint256) {
        if (tickLower >= tickUpper) revert Errors.InvalidTickParam();

        IV3Pool pool_ = IV3Pool(pool());
        address token0 = pool_.token0();
        address token1 = pool_.token1();

        uint256 amount0 = IERC20(token0).balanceOf(address(this));
        uint256 amount1 = IERC20(token1).balanceOf(address(this));

        uint256 p = uint256(sqrtPriceX96);
        uint256 pa = uint256(TickMath.getSqrtRatioAtTick(tickLower));
        uint256 pb = uint256(TickMath.getSqrtRatioAtTick(tickUpper));

        if (pb <= p) {
            return (token0, token1, amount0);
        } else if (pa >= p) {
            return (token1, token0, amount1);
        } else {
            uint256 SCALE = 10 ** 18; // Scale  to avoid zero values
            uint256 ratio = Math.mulDiv((p - pa), (p * pb), (pb - p));
            ratio = Math.mulDiv(ratio, SCALE, 2 ** 192);

            if (Math.mulDiv(amount0, ratio, 10 ** 18) > amount1) {
                uint256 amountIn = (amount0 - Math.mulDiv(amount1, SCALE, ratio)) / 2;
                return (token0, token1, amountIn);
            } else {
                uint256 amountIn = (amount1 - Math.mulDiv(amount0, ratio, SCALE)) / 2;
                return (token1, token0, amountIn);
            }
        }
    }

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

    function _performSwap(PerformSwapParams memory params) internal {
        if (params.amountIn == 0) {
            return;
        }

        uint256 amountOutMinimum;

        //sqrtPrice, slippageSwap, fee, router
        if (params.tokenIn < params.tokenOut) {
            amountOutMinimum = Math.mulDiv(params.amountIn, uint256(params.sqrtPriceX96) ** 2, 2 ** 192);
        } else {
            amountOutMinimum = Math.mulDiv(params.amountIn, 2 ** 192, uint256(params.sqrtPriceX96) ** 2);
        }

        amountOutMinimum = Math.mulDiv(amountOutMinimum, SLIPPAGE_SCALE - params.slippageSwap, SLIPPAGE_SCALE);

        // Perform Swap
        moduleC_exactInputSingle(
            params.router,
            ExactInputSingleParams({
                tokenIn: params.tokenIn,
                tokenOut: params.tokenOut,
                fee: params.fee,
                deadline: block.timestamp,
                amountIn: params.amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            })
        );
    }

    function _performSwap02(PerformSwapParams memory params) internal {
        if (params.amountIn == 0) {
            return;
        }

        uint256 amountOutMinimum;

        //sqrtPrice, slippageSwap, fee, router
        if (params.tokenIn < params.tokenOut) {
            amountOutMinimum = Math.mulDiv(params.amountIn, uint256(params.sqrtPriceX96) ** 2, 2 ** 192);
        } else {
            amountOutMinimum = Math.mulDiv(params.amountIn, 2 ** 192, uint256(params.sqrtPriceX96) ** 2);
        }

        amountOutMinimum = Math.mulDiv(amountOutMinimum, SLIPPAGE_SCALE - params.slippageSwap, SLIPPAGE_SCALE);

        // Perform Swap
        moduleC_exactInputSingle02(
            params.router,
            ExactInputSingle02Params({
                tokenIn: params.tokenIn,
                tokenOut: params.tokenOut,
                fee: params.fee,
                amountIn: params.amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            })
        );
    }

    /***************************************
    UTIL FUNCTIONS
    ***************************************/

    function _getMinAmountsForIncrease(
        uint256 amount0Desired,
        uint256 amount1Desired,
        int24 tickLower,
        int24 tickUpper,
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) internal pure returns (uint256 amount0Min, uint256 amount1Min) {
        // Calculate min amounts, by getting expecting liquidity, and apply slippage
        // to the amount need to achieve that liquidity
        uint160 pa = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 pb = TickMath.getSqrtRatioAtTick(tickUpper);

        uint128 expectedLiquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            pa,
            pb,
            amount0Desired,
            amount1Desired
        );

        (amount0Min, amount1Min) = LiquidityAmounts.getAmountsForLiquidity(sqrtPriceX96, pa, pb, expectedLiquidity);

        amount0Min = Math.mulDiv(amount0Min, SLIPPAGE_SCALE - slippageLiquidity, SLIPPAGE_SCALE);
        amount1Min = Math.mulDiv(amount1Min, SLIPPAGE_SCALE - slippageLiquidity, SLIPPAGE_SCALE);
    }

    /// @notice Get the balane in the two underlying tokens
    function _balance() internal view returns (uint256 amount0, uint256 amount1) {
        (, , address token0, address token1, , , , , , , , ) = position();
        amount0 = IERC20(token0).balanceOf(address(this));
        amount1 = IERC20(token1).balanceOf(address(this));
    }

    /**
     * @notice Checks the approval of an ERC20 token from this contract to another address.
     * @param token The token to check allowance.
     * @param recipient The address to give allowance to.
     * @param minAmount The minimum amount of the allowance.
     */
    function _checkApproval(address token, address recipient, uint256 minAmount) internal {
        // if current allowance is insufficient
        if(IERC20(token).allowance(address(this), recipient) < minAmount) {
            // set allowance to max
            SafeERC20.forceApprove(IERC20(token), recipient, type(uint256).max);
        }
    }
}
