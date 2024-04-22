// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { Calls } from "./../libraries/Calls.sol";
import { INonfungiblePositionManager } from "./../interfaces/external/Thruster/INonfungiblePositionManager.sol";
import { ISwapRouter } from "./../interfaces/external/Thruster/ISwapRouter.sol";
import { IThrusterPool } from "./../interfaces/external/Thruster/IThrusterPool.sol";

/**
 * @title ConcentratedLiquidityModuleC
 * @author AgentFi
 * @notice A module used in the Concentrated liquidity strategy.
 *
 * Designed for use on Blast Mainnet only.
 */
// ?? How do we handle multiple nft positions? We can assume one, but if we get sent one?
// ! Need to be careful of signature collisions

/*

 Deposit (mints with 100% from tba wallet -> needs to take in pa, pb)
 Increase liquidity
 Withdrawal
 Decrease liquidity
 Rebalance (withdrawal + swap + deposit)
*/
contract ConcentratedLiquidityModuleC is Blastable {
    /***************************************
    CONSTANTS
    ***************************************/

    // tokens

    address internal constant _token0 = 0x4300000000000000000000000000000000000003;
    address internal constant _token1 = 0x4300000000000000000000000000000000000004;
    uint256 private constant sqrt2 = 0x16a09e667f3bcc908b2fb1366ea93704;

    // thruster
    address internal constant _thrusterManager = 0x434575EaEa081b735C985FA9bf63CD7b87e227F9;
    address internal constant _thrusterRouter = 0x337827814155ECBf24D20231fCA4444F530C0555;
    address internal constant _thrusterPool = 0xf00DA13d2960Cf113edCef6e3f30D92E52906537;

    // Config
    // TODO:- to move this to a diamond pattern storage (this doesn't work because its proxied)
    uint256 _tokenId = 0;
    uint24 fee = 3000;

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

    function token0() external pure returns (address) {
        return _token0;
    }
    function token1() external pure returns (address) {
        return _token1;
    }

    function thrusterManager() external pure returns (address thrusterManager_) {
        thrusterManager_ = _thrusterManager;
    }

    function tokenId() external view returns (uint256 tokenId_) {
        tokenId_ = _tokenId;
    }

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    function moduleC_depositBalance(int24 tickLower, int24 tickUpper) external payable {
        _depositBalance(tickLower, tickUpper);
    }

    function moduleC_withdrawBalance() external payable {
        _withdrawBalance();
    }

    function moduleC_rebalance(int24 tickLower, int24 tickUpper) external {
        _withdrawBalance();
        _balanceTokens(tickLower, tickUpper);
        _depositBalance(tickLower, tickUpper);
    }

    function moduleC_withdrawBalanceTo(address receiver) external payable {
        // TODO:- unwrap WETH to ETH before sending back (if is weth)
        _withdrawBalance();
        uint256 balance = address(this).balance;
        if (balance > 0) Calls.sendValue(receiver, balance);

        balance = IERC20(_token0).balanceOf(address(this));
        if (balance > 0) SafeERC20.safeTransfer(IERC20(_token0), receiver, balance);

        balance = IERC20(_token1).balanceOf(address(this));
        if (balance > 0) SafeERC20.safeTransfer(IERC20(_token1), receiver, balance);
    }

    /***************************************
    DEPOSIT FUNCTIONS
    ***************************************/

    /**
     * @notice Deposits this contracts balance into the dexes.
     */
    function _depositBalance(
        int24 tickLower,
        int24 tickUpper
    ) internal returns (uint256 tokenId_, uint128 liquidity, uint256 amount0, uint256 amount1) {
        require(_tokenId == 0, "Cannot deposit with existing position");

        {
            uint256 ethAmount = address(this).balance;
            if (ethAmount > 0) Calls.sendValue(_token1, ethAmount);
        }
        uint256 token0Amount = IERC20(_token0).balanceOf(address(this));
        uint256 token1Amount = IERC20(_token1).balanceOf(address(this));

        INonfungiblePositionManager thruster = INonfungiblePositionManager(_thrusterManager);

        _checkApproval(_token0, _thrusterManager, token0Amount);
        _checkApproval(_token1, _thrusterManager, token1Amount);

        (tokenId_, liquidity, amount0, amount1) = thruster.mint(
            INonfungiblePositionManager.MintParams({
                token0: _token0,
                token1: _token1,
                fee: fee,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: token0Amount,
                amount1Desired: token1Amount,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            })
        );
        _tokenId = tokenId_;
        // ?? Should we send back any leftover assets
    }

    /***************************************
    WITHDRAW FUNCTIONS
    ***************************************/

    function _withdrawBalance() internal {
        INonfungiblePositionManager thruster = INonfungiblePositionManager(_thrusterManager);

        (, , , , , , , uint128 liquidity, , , , ) = thruster.positions(_tokenId);

        thruster.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: _tokenId,
                liquidity: liquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );

        thruster.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: _tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        thruster.burn(_tokenId);
        _tokenId = 0;
    }

    function _balanceTokens(int24 tickLower, int24 tickUpper) internal {
        IThrusterPool pool = IThrusterPool(_thrusterPool);
        uint160 pa = getSqrtRatioAtTick(tickLower);
        uint160 pb = getSqrtRatioAtTick(tickUpper);
        (uint160 p, , , , , , ) = pool.slot0();

        uint256 ratio = ((((uint256(p) * uint256(pb)) / uint256(pb - p)) * uint256(p - pa)) * 10 ** 18) / 2 ** 192;

        uint256 token0Balance = IERC20(_token0).balanceOf(address(this));
        uint256 token1Balance = IERC20(_token1).balanceOf(address(this));

        if ((token0Balance * ratio) / 10 ** 18 > token1Balance) {
            uint256 amountIn = (token0Balance - ((token1Balance * 10 ** 18) / ratio)) / 2;
            _performSwap(_token0, _token1, amountIn);
        } else {
            uint256 amountIn = (token1Balance - ((token0Balance * ratio) / 10 ** 18)) / 2;
            _performSwap(_token1, _token0, amountIn);
        }
    }

    function _performSwap(address tokenIn, address tokenOut, uint256 amountInput) internal {
        ISwapRouter swapRouter = ISwapRouter(_thrusterRouter);
        IThrusterPool pool = IThrusterPool(_thrusterPool);

        // Get allowance
        _checkApproval(tokenIn, _thrusterRouter, amountInput);

        // Perform Swap
        swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: pool.fee(),
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountInput,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0 // TODO:- Check why we don't need to set this
            })
        );
    }

    function reCentreTicks(int24 _range) internal view returns (int24 tickLower, int24 tickUpper) {
        // TODO:- We want to maintain range on price1 - so need to do some conversion
        IThrusterPool pool = IThrusterPool(_thrusterPool);
        int24 spacing = pool.tickSpacing();
        (, int24 tick, , , , , ) = pool.slot0();
        tick = (tick / spacing) * spacing;

        // Calculate new tickLower and tickUpper
        tickLower = tick - spacing * _range;
        tickUpper = tick + spacing * _range;
    }

    //? I think this should approve the same amount - no need to expose leftover tba balance to the protocols
    function _checkApproval(address token, address recipient, uint256 minAmount) internal {
        if (IERC20(token).allowance(address(this), recipient) < minAmount)
            IERC20(token).approve(recipient, type(uint256).max);
    }

    /// TODO:- Move to seperate library/contract
    /// Copied from https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/TickMath.sol#L23
    /// @notice Calculates sqrt(1.0001^tick) * 2^96
    /// @dev Throws if |tick| > max tick
    /// @param tick The input tick for the above formula
    /// @return sqrtPriceX96 A Fixed point Q64.96 number representing the sqrt of the ratio of the two assets (token1/token0)
    /// at the given tick
    function getSqrtRatioAtTick(int24 tick) internal pure returns (uint160 sqrtPriceX96) {
        uint256 absTick = tick < 0 ? uint256(-int256(tick)) : uint256(int256(tick));
        require(absTick <= 887272, "T");

        uint256 ratio = absTick & 0x1 != 0 ? 0xfffcb933bd6fad37aa2d162d1a594001 : 0x100000000000000000000000000000000;
        if (absTick & 0x2 != 0) ratio = (ratio * 0xfff97272373d413259a46990580e213a) >> 128;
        if (absTick & 0x4 != 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdcc) >> 128;
        if (absTick & 0x8 != 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0) >> 128;
        if (absTick & 0x10 != 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644) >> 128;
        if (absTick & 0x20 != 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0) >> 128;
        if (absTick & 0x40 != 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861) >> 128;
        if (absTick & 0x80 != 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053) >> 128;
        if (absTick & 0x100 != 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4) >> 128;
        if (absTick & 0x200 != 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54) >> 128;
        if (absTick & 0x400 != 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3) >> 128;
        if (absTick & 0x800 != 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9) >> 128;
        if (absTick & 0x1000 != 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825) >> 128;
        if (absTick & 0x2000 != 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5) >> 128;
        if (absTick & 0x4000 != 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7) >> 128;
        if (absTick & 0x8000 != 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6) >> 128;
        if (absTick & 0x10000 != 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9) >> 128;
        if (absTick & 0x20000 != 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604) >> 128;
        if (absTick & 0x40000 != 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98) >> 128;
        if (absTick & 0x80000 != 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2) >> 128;

        if (tick > 0) ratio = type(uint256).max / ratio;

        // this divides by 1<<32 rounding up to go from a Q128.128 to a Q128.96.
        // we then downcast because we know the result always fits within 160 bits due to our tick input constraint
        // we round up in the division so getTickAtSqrtRatio of the output price is always consistent
        sqrtPriceX96 = uint160((ratio >> 32) + (ratio % (1 << 32) == 0 ? 0 : 1));
    }
}
