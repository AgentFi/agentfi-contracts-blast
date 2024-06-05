// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { INonfungiblePositionManager } from "./../interfaces/external/Algebra/INonfungiblePositionManager.sol";
import { ISwapRouter } from "./../interfaces/external/Algebra/ISwapRouter.sol";
import { IAlgebraPool } from "./../interfaces/external/Algebra/IAlgebraPool.sol";
import { IConcentratedLiquidityModuleE } from "./../interfaces/modules/IConcentratedLiquidityModuleE.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { LiquidityAmounts } from "./../libraries/LiquidityAmounts.sol";
import { TickMath } from "./../libraries/TickMath.sol";
import { Blastable } from "./../utils/Blastable.sol";
import "hardhat/console.sol";
/**
 * @title ConcentratedLiquidityModuleE
 * @author AgentFi
 * @notice A module used in the Concentrated liquidity strategy. This version integrates with Alebgra
 *
 */
contract ConcentratedLiquidityModuleE is Blastable, IConcentratedLiquidityModuleE {
    uint24 internal constant SLIPPAGE_SCALE = 1_000_000; // 100%
    /***************************************
    State
    ***************************************/
    bytes32 private constant CONCENTRATED_LIQUIDITY_MODULEE_STORAGE_POSITION =
        keccak256("agentfi.storage.concentratedliquiditymodulee");

    struct ConcentratedLiquidityModuleEStorage {
        address manager;
        address pool;
        uint256 tokenId;
    }

    function concentratedLiquidityModuleEStorage()
        internal
        pure
        returns (ConcentratedLiquidityModuleEStorage storage s)
    {
        bytes32 position_ = CONCENTRATED_LIQUIDITY_MODULEE_STORAGE_POSITION;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            s.slot := position_
        }
    }

    /***************************************
    CONSTRUCTOR
    ***************************************/
    /**
     * @notice Constructs the ConcentratedLiquidityModuleE contract.
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
    function moduleName() external pure override returns (string memory name_) {
        name_ = "ConcentratedLiquidityModuleE";
    }

    function strategyType() external pure override returns (string memory type_) {
        type_ = "Concentrated Liquidity";
    }

    /// @notice Address for the NonfungiblePositionManager
    function manager() public view virtual override returns (address manager_) {
        manager_ = concentratedLiquidityModuleEStorage().manager;
    }

    function pool() public view override returns (address pool_) {
        pool_ = concentratedLiquidityModuleEStorage().pool;
    }

    /// @notice Safely get most important state values of Algebra Integral AMM
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
    ) {
        return IAlgebraPool(concentratedLiquidityModuleEStorage().pool).safelyGetStateOfAMM();
    }

    /// @notice TokenId of NFT position (if exists)
    function tokenId() public view override returns (uint256 tokenId_) {
        tokenId_ = concentratedLiquidityModuleEStorage().tokenId;
    }

    /// @notice The pool tick spacing
    function tickSpacing() external view override returns (int24 spacing) {
        spacing = IAlgebraPool(concentratedLiquidityModuleEStorage().pool).tickSpacing();
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
        override
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        )
    {
        ConcentratedLiquidityModuleEStorage storage state = concentratedLiquidityModuleEStorage();
        if (state.tokenId == 0) revert Errors.NoPositionFound();
        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);
        return manager_.positions(state.tokenId);
    }

    /// @notice Creates a new position wrapped in a NFT
    /// @dev Call this when the pool does exist and is initialized. Note that if the pool is created but not initialized
    /// a method does not exist, i.e. the pool is assumed to be initialized.
    /// @param params The params necessary to mint a position, encoded as `MintParams` in calldata
    /// @return tokenId_ The ID of the token that represents the minted position
    /// @return liquidity The amount of liquidity for this position
    /// @return amount0 The amount of token0
    /// @return amount1 The amount of token1
    function moduleE_mint(
        MintParams memory params
    ) public payable virtual override returns (uint256 tokenId_, uint128 liquidity, uint256 amount0, uint256 amount1) {
        console.log("in moduleE_mint() 1");
        if (params.tickLower >= params.tickUpper) revert Errors.InvalidTickParam();
        ConcentratedLiquidityModuleEStorage storage state = concentratedLiquidityModuleEStorage();
        if (state.tokenId != 0) revert Errors.PositionAlreadyExists();

        state.manager = params.manager;
        state.pool = params.pool;

        _setApproval(params.token0, state.manager, params.amount0Desired);
        _setApproval(params.token1, state.manager, params.amount1Desired);

        console.log("in moduleE_mint() 2");
        console.log(params.token0);
        console.log(params.token1);
        console.logInt(int256(params.tickLower));
        console.logInt(int256(params.tickUpper));
        console.log(params.amount0Desired);
        console.log(params.amount1Desired);
        console.log(params.amount0Min);
        console.log(params.amount1Min);
        console.log("in moduleE_mint() 3");
        (tokenId_, liquidity, amount0, amount1) = INonfungiblePositionManager(params.manager).mint(
            INonfungiblePositionManager.MintParams({
                token0: params.token0,
                token1: params.token1,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                amount0Desired: params.amount0Desired,
                amount1Desired: params.amount1Desired,
                //amount0Min: params.amount0Min,
                //amount1Min: params.amount1Min,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            })
        );
        console.log("in moduleE_mint() 4");

        // Update state with new token
        state.tokenId = tokenId_;
        console.log("in moduleE_mint() 5");
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
    function moduleE_increaseLiquidity(
        IncreaseLiquidityParams memory params
    ) public payable override returns (uint128 liquidity, uint256 amount0, uint256 amount1) {
        (, , address token0, address token1, , , , , , , ) = position();

        ConcentratedLiquidityModuleEStorage storage state = concentratedLiquidityModuleEStorage();
        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);

        if (state.tokenId == 0) revert Errors.NoPositionFound();

        _setApproval(token0, state.manager, params.amount0Desired);
        _setApproval(token1, state.manager, params.amount1Desired);

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

    function moduleE_decreaseLiquidity(
        DecreaseLiquidityParams memory params
    ) public payable virtual override returns (uint256 amount0, uint256 amount1) {
        ConcentratedLiquidityModuleEStorage storage state = concentratedLiquidityModuleEStorage();
        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);
        if (state.tokenId == 0) revert Errors.NoPositionFound();

        (amount0, amount1) = manager_.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: state.tokenId,
                liquidity: params.liquidity,
                amount0Min: params.amount0Min,
                amount1Min: params.amount1Min,
                deadline: params.deadline
            })
        );
    }

    function moduleE_collect(
        CollectParams memory params
    ) public payable virtual override returns (uint256 amount0, uint256 amount1) {
        ConcentratedLiquidityModuleEStorage storage state = concentratedLiquidityModuleEStorage();
        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);
        if (state.tokenId == 0) revert Errors.NoPositionFound();

        (amount0, amount1) = manager_.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: state.tokenId,
                recipient: address(this),
                amount0Max: params.amount0Max,
                amount1Max: params.amount1Max
            })
        );
    }

    function moduleE_burn() public payable virtual override {
        ConcentratedLiquidityModuleEStorage storage state = concentratedLiquidityModuleEStorage();
        if (state.tokenId == 0) revert Errors.NoPositionFound();

        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);
        manager_.burn(state.tokenId);
        state.tokenId = 0;
    }

    /// @notice Swaps `amountIn` of one token for as much as possible of another token
    /// @param params The parameters necessary for the swap, encoded as `ExactInputSingleParams` in calldata
    /// @return amountOut The amount of the received token
    function moduleE_exactInputSingle(
        address router,
        ExactInputSingleParams memory params
    ) public payable override returns (uint256 amountOut) {
        ISwapRouter swapRouter = ISwapRouter(router);

        // Set allowance
        _setApproval(params.tokenIn, router, params.amountIn);

        amountOut = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: params.tokenIn,
                tokenOut: params.tokenOut,
                recipient: address(this),
                deadline: params.deadline,
                amountIn: params.amountIn,
                amountOutMinimum: params.amountOutMinimum,
                limitSqrtPrice: params.limitSqrtPrice
            })
        );
    }

    /***************************************
    AGENT HIGH LEVEL FUNCTIONS
    ***************************************/
    /// @notice Sends token balance to a specified receiver.
    function moduleE_sendBalanceTo(address receiver) public payable virtual override {
        ConcentratedLiquidityModuleEStorage storage state = concentratedLiquidityModuleEStorage();

        IAlgebraPool pool_ = IAlgebraPool(state.pool);
        address[2] memory tokens = [pool_.token0(), pool_.token1()];

        for (uint256 i = 0; i < tokens.length; ++i) {
            address token = tokens[i];
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) {
                SafeERC20.safeTransfer(IERC20(token), receiver, balance);
            }
        }
    }

    /// @notice Mints new position with all assets in this contract
    function moduleE_mintWithBalance(
        MintBalanceParams memory params
    ) public payable virtual override returns (uint256, uint128, uint256, uint256) {
        if (params.slippageLiquidity > SLIPPAGE_SCALE) revert Errors.InvalidSlippageParam();

        IAlgebraPool pool_ = IAlgebraPool(params.pool);
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
            moduleE_mint(
                MintParams({
                    manager: params.manager,
                    pool: params.pool,
                    token0: pool_.token0(),
                    token1: pool_.token1(),
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

    /// @notice Mints new position with all assets in this contract
    function moduleE_mintWithBalanceAndRefundTo(
        MintBalanceAndRefundParams memory params
    ) external payable virtual override returns (uint256 tokenId_, uint128 liquidity, uint256 amount0, uint256 amount1) {
        (tokenId_, liquidity, amount0, amount1) = moduleE_mintWithBalance(
            MintBalanceParams({
                manager: params.manager,
                pool: params.pool,
                slippageLiquidity: params.slippageLiquidity,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                sqrtPriceX96: params.sqrtPriceX96
            })
        );

        moduleE_sendBalanceTo(params.receiver);
    }

    /// @notice Deposit all assets in contract to existing position (does not change range)
    function moduleE_increaseLiquidityWithBalance(
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) public payable virtual override returns (uint128 liquidity, uint256 amount0, uint256 amount1) {
        if (slippageLiquidity > SLIPPAGE_SCALE) revert Errors.InvalidSlippageParam();

        (, , , , int24 tickLower, int24 tickUpper, , , , , ) = position();
        (uint256 amount0Desired, uint256 amount1Desired) = _balance();
        (uint256 amount0Min, uint256 amount1Min) = _getMinAmountsForIncrease(
            amount0Desired,
            amount1Desired,
            tickLower,
            tickUpper,
            sqrtPriceX96,
            slippageLiquidity
        );
        (liquidity, amount0, amount1) = moduleE_increaseLiquidity(
            IncreaseLiquidityParams({
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                deadline: block.timestamp
            })
        );
    }

    function moduleE_increaseLiquidityWithBalanceAndRefundTo(
        address receiver,
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) external payable virtual override returns (uint128 liquidity, uint256 amount0, uint256 amount1) {
        (liquidity, amount0, amount1) = moduleE_increaseLiquidityWithBalance(sqrtPriceX96, slippageLiquidity);
        moduleE_sendBalanceTo(receiver);
    }

    /// @notice Collect tokens owned in position, keeping funds in the this contract
    function moduleE_collectToSelf() public payable override returns (uint256, uint256) {
        return moduleE_collect(CollectParams({ amount0Max: type(uint128).max, amount1Max: type(uint128).max }));
    }

    /// @notice Perform partial withdrawal, keeping funds in the this contract
    function moduleE_decreaseLiquidityWithSlippage(
        uint128 liquidity,
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) public payable override returns (uint256, uint256) {
        (, , , , int24 tickLower, int24 tickUpper, , , , , ) = position();
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
            moduleE_decreaseLiquidity(
                DecreaseLiquidityParams({
                    liquidity: liquidity,
                    amount0Min: amount0Min,
                    amount1Min: amount1Min,
                    deadline: block.timestamp
                })
            );
    }

    function moduleE_partialWithdrawalToSelf(
        uint128 liquidity,
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) public payable override returns (uint256, uint256) {
        moduleE_decreaseLiquidityWithSlippage(liquidity, sqrtPriceX96, slippageLiquidity);
        return moduleE_collectToSelf();
    }

    /// @notice Withdrawals principal and fee, and burns position, returning the funds to this contract
    function moduleE_fullWithdrawToSelf(
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) public payable override returns (uint256 amount0, uint256 amount1) {
        (, , , , , , uint128 liquidity, , , , ) = position();
        (amount0, amount1) = moduleE_partialWithdrawalToSelf(liquidity, sqrtPriceX96, slippageLiquidity);
        moduleE_burn();
    }

    /// @notice Collect tokens owned in position, sending funds to the receiver
    function moduleE_collectTo(address receiver) external payable virtual override {
        moduleE_collectToSelf();
        moduleE_sendBalanceTo(receiver);
    }

    /// @notice Perform partial withdrawal, sending funds to the receiver
    function moduleE_partialWithdrawTo(
        address receiver,
        uint128 liquidity,
        uint160 sqrtPriceX96,
        uint24 slippageLiquidity
    ) external payable override {
        moduleE_partialWithdrawalToSelf(liquidity, sqrtPriceX96, slippageLiquidity);
        moduleE_sendBalanceTo(receiver);
    }

    /// @notice Sends funds to receiver after withdrawaling position
    function moduleE_fullWithdrawTo(address receiver, uint160 sqrtPriceX96, uint24 slippageLiquidity) external payable override {
        moduleE_fullWithdrawToSelf(sqrtPriceX96, slippageLiquidity);
        moduleE_sendBalanceTo(receiver);
    }

    /// @notice Withdrawals, swaps and creates a new position at the new range
    function moduleE_rebalance(RebalanceParams memory params) external payable override {
        console.log("in moduleE_rebalance() 1");
        (, , , , int24 tickLower, int24 tickUpper, , , , , ) = position();
        console.log("Starting at ticks");
        console.logInt(int256(tickLower));
        console.logInt(int256(tickUpper));
        console.log("Rebalancing to ticks");
        console.logInt(int256(params.tickLower));
        console.logInt(int256(params.tickUpper));
        IAlgebraPool pool_ = IAlgebraPool(pool());
        (, int24 poolTick, , , , , ) = pool_.safelyGetStateOfAMM();
        console.log("Current pool tick");
        console.logInt(int256(poolTick));
        address token0 = pool_.token0();
        address token1 = pool_.token1();
        console.log("balances start:");
        console.log(IERC20(token0).balanceOf(address(this)));
        console.log(IERC20(token1).balanceOf(address(this)));
        moduleE_fullWithdrawToSelf(params.sqrtPriceX96, params.slippageLiquidity);
        console.log("in moduleE_rebalance() 2");
        console.log("balances after full withdraw to self:");
        console.log(IERC20(token0).balanceOf(address(this)));
        console.log(IERC20(token1).balanceOf(address(this)));

        (address tokenIn, address tokenOut, uint256 amountIn) = _getSwapForNewRange(
            params.sqrtPriceX96,
            params.tickLower,
            params.tickUpper
        );
        console.log("in moduleE_rebalance() 3");
        //console.log(tokenIn);
        //console.log(tokenOut);
        //console.log(amountIn);
        console.log("swap", amountIn, tokenIn==token0 ? "zero for one" : "one for zero");
        _performSwap(
            PerformSwapParams({
                router: params.router,
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                amountIn: amountIn,
                slippageSwap: params.slippageSwap,
                sqrtPriceX96: params.sqrtPriceX96
            })
        );
        console.log("in moduleE_rebalance() 4");
        console.log("balances after swap:");
        console.log(IERC20(token0).balanceOf(address(this)));
        console.log(IERC20(token1).balanceOf(address(this)));

        ConcentratedLiquidityModuleEStorage storage state = concentratedLiquidityModuleEStorage();
        moduleE_mintWithBalance(
            MintBalanceParams({
                manager: state.manager,
                pool: state.pool,
                slippageLiquidity: params.slippageLiquidity,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                sqrtPriceX96: params.sqrtPriceX96
            })
        );
        console.log("in moduleE_rebalance() 5");
        console.log("balances after deposit:");
        console.log(IERC20(token0).balanceOf(address(this)));
        console.log(IERC20(token1).balanceOf(address(this)));
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
        console.log("in _getSwapForNewRange() 1");
        console.logInt(int256(tickLower));
        console.logInt(int256(tickUpper));
        console.log(tickLower >= tickUpper);
        if (tickLower >= tickUpper) revert Errors.InvalidTickParam();

        IAlgebraPool pool_ = IAlgebraPool(pool());
        address token0 = pool_.token0();
        address token1 = pool_.token1();

        uint256 amount0 = IERC20(token0).balanceOf(address(this));
        uint256 amount1 = IERC20(token1).balanceOf(address(this));

        uint256 p = uint256(sqrtPriceX96);
        uint256 pa = uint256(TickMath.getSqrtRatioAtTick(tickLower));
        uint256 pb = uint256(TickMath.getSqrtRatioAtTick(tickUpper));
        console.log("in _getSwapForNewRange() 2");
        console.log(p);
        console.log(pa);
        console.log(pb);

        if (pb <= p) {
            console.log("in _getSwapForNewRange() branch A");
            return (token0, token1, amount0);
        } else if (pa >= p) {
            console.log("in _getSwapForNewRange() branch B");
            return (token1, token0, amount1);
        } else {
            uint256 SCALE = 10 ** 18; // Scale  to avoid zero values
            uint256 ratio = Math.mulDiv((p - pa), (p * pb), (pb - p));
            ratio = Math.mulDiv(ratio, SCALE, 2 ** 192);

            if (Math.mulDiv(amount0, ratio, 10 ** 18) > amount1) {
                console.log("in _getSwapForNewRange() branch C");
                uint256 amountIn = (amount0 - Math.mulDiv(amount1, SCALE, ratio)) / 2;
                return (token0, token1, amountIn);
            } else {
                console.log("in _getSwapForNewRange() branch D");
                uint256 amountIn = (amount1 - Math.mulDiv(amount0, ratio, SCALE)) / 2;
                return (token1, token0, amountIn);
            }
        }
    }

    function _performSwap(PerformSwapParams memory params) internal {
        console.log("in _performSwap() 1");
        if (params.amountIn == 0) {
            return;
        }
        console.log("in _performSwap() 2");


        uint256 amountOutMinimum;

        //sqrtPrice, slippageSwap, fee, router
        if (params.tokenIn < params.tokenOut) {
            amountOutMinimum = Math.mulDiv(params.amountIn, uint256(params.sqrtPriceX96) ** 2, 2 ** 192);
        } else {
            amountOutMinimum = Math.mulDiv(params.amountIn, 2 ** 192, uint256(params.sqrtPriceX96) ** 2);
        }

        amountOutMinimum = Math.mulDiv(amountOutMinimum, SLIPPAGE_SCALE - params.slippageSwap, SLIPPAGE_SCALE);

        // Perform Swap
        moduleE_exactInputSingle(
            params.router,
            ExactInputSingleParams({
                tokenIn: params.tokenIn,
                tokenOut: params.tokenOut,
                deadline: block.timestamp,
                amountIn: params.amountIn,
                amountOutMinimum: amountOutMinimum,
                limitSqrtPrice: 0
            })
        );
        console.log("in _performSwap() 3");
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
        (, , address token0, address token1, , , , , , , ) = position();
        amount0 = IERC20(token0).balanceOf(address(this));
        amount1 = IERC20(token1).balanceOf(address(this));
    }

    function _setApproval(address token, address spender, uint256 value) internal {
        SafeERC20.safeIncreaseAllowance(IERC20(token), spender, value);
    }
}
