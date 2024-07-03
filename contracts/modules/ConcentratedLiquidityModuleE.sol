// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { INonfungiblePositionManager } from "./../interfaces/external/Algebra/INonfungiblePositionManager.sol";
import { ISwapRouter } from "./../interfaces/external/Algebra/ISwapRouter.sol";
import { IAlgebraPool } from "./../interfaces/external/Algebra/IAlgebraPool.sol";
import { IFarmingCenter } from "./../interfaces/external/Algebra/IFarmingCenter.sol";
import { IAlgebraEternalFarming } from "./../interfaces/external/Algebra/IAlgebraEternalFarming.sol";
import { IConcentratedLiquidityModuleE } from "./../interfaces/modules/IConcentratedLiquidityModuleE.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { LiquidityAmounts } from "./../libraries/LiquidityAmounts.sol";
import { TickMath } from "./../libraries/TickMath.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { IWETH } from "./../interfaces/external/tokens/IWETH.sol";


/**
 * @title ConcentratedLiquidityModuleE
 * @author AgentFi
 * @notice A module used in the Concentrated liquidity strategy. This version integrates with Alebgra
 *
 */
contract ConcentratedLiquidityModuleE is Blastable, IConcentratedLiquidityModuleE {
    uint24 internal constant SLIPPAGE_SCALE = 1_000_000; // 100%
    address public immutable override weth;
    address public immutable override farmingCenter;
    address public immutable override eternalFarming;

    address internal constant blade = 0xD1FedD031b92f50a50c05E2C45aF1aDb4CEa82f4;

    /***************************************
    State
    ***************************************/
    bytes32 private constant CONCENTRATED_LIQUIDITY_MODULEE_STORAGE_POSITION =
        keccak256("agentfi.storage.concentratedliquiditymodulee");

    struct ConcentratedLiquidityModuleEStorage {
        address manager;
        address pool;
        uint256 tokenId;

        address rewardToken;
        address bonusRewardToken;
        uint256 nonce;
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
     * @param weth_ The address of wrapped ether.
     * @param farmingCenter_ The address of the Algebra FarmingCenter.
     * @param eternalFarming_ The address of the AlgebraEternalFarming.
     */
    constructor(
        address blast_,
        address gasCollector_,
        address blastPoints_,
        address pointsOperator_,
        address weth_,
        address farmingCenter_,
        address eternalFarming_
    ) Blastable(blast_, gasCollector_, blastPoints_, pointsOperator_) {
        weth = weth_;
        farmingCenter = farmingCenter_;
        eternalFarming = eternalFarming_;
    }

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
        uint256 tokenId_ = state.tokenId;
        if (tokenId_ == 0) revert Errors.NoPositionFound();
        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);
        return manager_.positions(tokenId_);
    }

    function moduleE_wrap() public payable override {
        if(weth == address(0)) return;
        uint256 balance = address(this).balance;
        if (balance > 0) {
            Calls.sendValue(weth, balance);
        }
    }

    function moduleE_unwrap() public payable override {
        if(weth == address(0)) return;
        uint256 balance = IERC20(weth).balanceOf(address(this));
        if (balance > 0) {
            IWETH(weth).withdraw(balance);
        }
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
        if (params.tickLower >= params.tickUpper) revert Errors.InvalidTickParam();
        ConcentratedLiquidityModuleEStorage storage state = concentratedLiquidityModuleEStorage();
        if (state.tokenId != 0) revert Errors.PositionAlreadyExists();

        state.manager = params.manager;
        state.pool = params.pool;

        _checkApproval(params.token0, state.manager, params.amount0Desired);
        _checkApproval(params.token1, state.manager, params.amount1Desired);

        (tokenId_, liquidity, amount0, amount1) = INonfungiblePositionManager(params.manager).mint(
            INonfungiblePositionManager.MintParams({
                token0: params.token0,
                token1: params.token1,
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

    function moduleE_decreaseLiquidity(
        DecreaseLiquidityParams memory params
    ) public payable virtual override returns (uint256 amount0, uint256 amount1) {
        ConcentratedLiquidityModuleEStorage storage state = concentratedLiquidityModuleEStorage();
        uint256 tokenId_ = state.tokenId;
        if (tokenId_ == 0) revert Errors.NoPositionFound();
        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);

        (amount0, amount1) = manager_.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId_,
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
        uint256 tokenId_ = state.tokenId;
        if (tokenId_ == 0) revert Errors.NoPositionFound();
        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);

        (amount0, amount1) = manager_.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId_,
                recipient: address(this),
                amount0Max: params.amount0Max,
                amount1Max: params.amount1Max
            })
        );
    }

    function moduleE_burn() public payable virtual override {
        ConcentratedLiquidityModuleEStorage storage state = concentratedLiquidityModuleEStorage();
        uint256 tokenId_ = state.tokenId;
        if (tokenId_ == 0) revert Errors.NoPositionFound();

        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);
        manager_.burn(tokenId_);
        state.tokenId = 0;
        state.rewardToken = address(0);
        state.bonusRewardToken = address(0);
        state.nonce = 0;
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
        _checkApproval(params.tokenIn, router, params.amountIn);

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

    /// @notice Withdrawals, swaps and creates a new position at the new range
    function moduleE_rebalance(RebalanceParams memory params) external payable override {
        // copy farm params
        ConcentratedLiquidityModuleEStorage storage state = concentratedLiquidityModuleEStorage();
        FarmParams memory farmParams = FarmParams({
            rewardToken: state.rewardToken,
            bonusRewardToken: state.bonusRewardToken,
            nonce: state.nonce
        });
        // exit farming, collect rewards
        moduleE_exitFarming(address(this));
        // withdraw from pool
        moduleE_fullWithdrawToSelf(params.sqrtPriceX96, params.slippageLiquidity);
        moduleE_wrap();
        // swap to new range
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
                sqrtPriceX96: params.sqrtPriceX96
            })
        );
        // mint new position
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
        // re enter farming
        moduleE_enterFarming(farmParams);
    }

    /// @notice Enters a farm
    function moduleE_enterFarming(FarmParams memory params) public payable override {
        // setup and checks
        ConcentratedLiquidityModuleEStorage storage state = concentratedLiquidityModuleEStorage();
        uint256 tokenId_ = state.tokenId;
        if (tokenId_ == 0) revert Errors.NoPositionFound();
        // early exit if variables are not set
        if(farmingCenter == address(0) || eternalFarming == address(0) || params.rewardToken == address(0)) return;
        // approve position
        INonfungiblePositionManager(state.manager).approveForFarming(tokenId_, true, farmingCenter);
        // enter to farming
        IFarmingCenter(farmingCenter).enterFarming(
            IFarmingCenter.IncentiveKey({
                rewardToken: params.rewardToken,
                bonusRewardToken: params.bonusRewardToken,
                pool: state.pool,
                nonce: params.nonce
            }),
            tokenId_
        );
        // store farming params
        state.rewardToken = params.rewardToken;
        state.bonusRewardToken = params.bonusRewardToken;
        state.nonce = params.nonce;
    }

    /// @notice Exits the current farm. Collects any rewards from the previous farm if any
    function moduleE_exitFarming(address receiver) public payable override {
        // setup and checks
        ConcentratedLiquidityModuleEStorage storage state = concentratedLiquidityModuleEStorage();
        uint256 tokenId_ = state.tokenId;
        if (tokenId_ == 0) revert Errors.NoPositionFound();
        // early exit if variables are not set
        if(farmingCenter == address(0) || eternalFarming == address(0)) return;
        // claim rewards
        moduleE_claimRewardsTo(receiver);
        // exit farm
        address rewardToken = state.rewardToken;
        if(rewardToken != address(0)) {
            IFarmingCenter(farmingCenter).exitFarming(
                IFarmingCenter.IncentiveKey({
                    rewardToken: rewardToken,
                    bonusRewardToken: state.bonusRewardToken,
                    pool: state.pool,
                    nonce: state.nonce
                }),
                tokenId_
            );
        }
        // reset farming params
        state.rewardToken = address(0);
        state.bonusRewardToken = address(0);
        state.nonce = 0;
    }

    /// @notice Returns the amount of rewards claimable by the agent
    /// @dev This should be a view function, but it cant because of the TBA. Use staticcall
    function moduleE_getRewardInfo() external payable override returns (
        address rewardToken,
        address bonusRewardToken,
        uint256 nonce,
        uint256 reward,
        uint256 bonusReward
    ) {
        // setup and checks
        ConcentratedLiquidityModuleEStorage storage state = concentratedLiquidityModuleEStorage();
        uint256 tokenId_ = state.tokenId;
        rewardToken = state.rewardToken;
        bonusRewardToken = state.bonusRewardToken;
        nonce = state.nonce;
        // early exit if variables are not set
        if(farmingCenter == address(0) || eternalFarming == address(0) || rewardToken == address(0) || tokenId_ == 0) {
            return (rewardToken, bonusRewardToken, nonce, 0, 0);
        }
        // fetch from eternal farming
        (reward, bonusReward) = IAlgebraEternalFarming(eternalFarming).getRewardInfo(
            IAlgebraEternalFarming.IncentiveKey({
                rewardToken: rewardToken,
                bonusRewardToken: bonusRewardToken,
                pool: state.pool,
                nonce: nonce
            }),
            tokenId_
        );
    }

    /// @notice Claims the farming rewards
    function moduleE_claimRewardsTo(address receiver) public payable override {
        // setup and checks
        ConcentratedLiquidityModuleEStorage storage state = concentratedLiquidityModuleEStorage();
        uint256 tokenId_ = state.tokenId;
        address rewardToken = state.rewardToken;
        address bonusRewardToken = state.bonusRewardToken;
        // early exit if variables are not set
        if(farmingCenter == address(0) || eternalFarming == address(0) || rewardToken == address(0) || tokenId_ == 0) {
            return;
        }
        // collect rewards
        (uint256 reward, uint256 bonusReward) = IFarmingCenter(farmingCenter).collectRewards(
            IFarmingCenter.IncentiveKey({
                rewardToken: rewardToken,
                bonusRewardToken: bonusRewardToken,
                pool: state.pool,
                nonce: state.nonce
            }),
            tokenId_
        );
        // claim rewards
        if(reward > 0) {
            IFarmingCenter(farmingCenter).claimReward(rewardToken, receiver, 0);
        }
        if(bonusReward > 0) {
            IFarmingCenter(farmingCenter).claimReward(bonusRewardToken, receiver, 0);
        }
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
                // return weth as eth
                if(token == weth) {
                    IWETH(weth).withdraw(balance);
                    balance = address(this).balance;
                    Calls.sendValue(receiver, balance);
                }
                // return ERC20
                else {
                    SafeERC20.safeTransfer(IERC20(token), receiver, balance);
                }
            }
        }

        uint256 bladeBalance = IERC20(blade).balanceOf(address(this));
        if(bladeBalance > 0) SafeERC20.safeTransfer(IERC20(blade), receiver, bladeBalance);
    }

    /// @notice Mints new position with all assets in this contract
    function moduleE_mintWithBalance(
        MintBalanceParams memory params
    ) public payable virtual override returns (uint256, uint128, uint256, uint256) {
        if (params.slippageLiquidity > SLIPPAGE_SCALE) revert Errors.InvalidSlippageParam();
        moduleE_wrap();

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
        moduleE_wrap();

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
        moduleE_claimRewardsTo(receiver);
        moduleE_partialWithdrawalToSelf(liquidity, sqrtPriceX96, slippageLiquidity);
        moduleE_sendBalanceTo(receiver);
    }

    /// @notice Sends funds to receiver after withdrawaling position
    function moduleE_fullWithdrawTo(address receiver, uint160 sqrtPriceX96, uint24 slippageLiquidity) external payable override {
        moduleE_claimRewardsTo(receiver);
        moduleE_fullWithdrawToSelf(sqrtPriceX96, slippageLiquidity);
        moduleE_sendBalanceTo(receiver);
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

        IAlgebraPool pool_ = IAlgebraPool(pool());
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

    function _performSwap(PerformSwapParams memory params) internal {
        if (params.amountIn == 0) {
            return;
        }

        uint256 amountOutMinimum;
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
