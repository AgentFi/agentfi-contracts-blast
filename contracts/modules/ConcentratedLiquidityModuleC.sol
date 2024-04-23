// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { Calls } from "./../libraries/Calls.sol";
import { PoolAddress } from "./../libraries/PoolAddress.sol";
import { TickMath } from "./../libraries/TickMath.sol";
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
// ! Need to be careful of signature collisions

// TODO:- Add doc strings
// TODO:- Sort functions
contract ConcentratedLiquidityModuleC is Blastable {
    // details about the Thruster position
    struct PositionStruct {
        // the nonce for permits
        uint96 nonce;
        // the address that is approved for spending this token
        address operator;
        address token0;
        address token1;
        uint24 fee;
        // the tick range of the position
        int24 tickLower;
        int24 tickUpper;
        // the liquidity of the position
        uint128 liquidity;
        // the fee growth of the aggregate position as of the last action on the individual position
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
        // how many uncollected tokens are owed to the position, as of the last computation
        uint128 tokensOwed0;
        uint128 tokensOwed1;
    }
    /***************************************
    CONSTANTS
    ***************************************/
    address _thrusterRouter = 0x337827814155ECBf24D20231fCA4444F530C0555;
    // TODO:- to move this to a diamond pattern storage (this doesn't work because its proxied)

    // Config
    address _thrusterManager;
    address _token0;
    address _token1;
    uint24 _fee;

    // State
    uint256 _tokenId = 0;
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

    function token0() external view returns (address) {
        return _token0;
    }
    function token1() external view returns (address) {
        return _token1;
    }

    function thrusterManager() external view returns (address thrusterManager_) {
        thrusterManager_ = _thrusterManager;
    }

    function tokenId() external view returns (uint256 tokenId_) {
        tokenId_ = _tokenId;
    }

    function pool() public view returns (address pool_) {
        INonfungiblePositionManager thruster = INonfungiblePositionManager(_thrusterManager);
        PoolAddress.PoolKey memory key = PoolAddress.getPoolKey(_token0, _token1, _fee);
        pool_ = PoolAddress.computeAddress(thruster.factory(), key);
    }

    function position() public view returns (PositionStruct memory position_) {
        require(_tokenId != 0, "No existing position to view");
        INonfungiblePositionManager thruster = INonfungiblePositionManager(_thrusterManager);

        (
            uint96 nonce_,
            address operator_,
            address token0_,
            address token1_,
            uint24 fee_,
            int24 tickLower_,
            int24 tickUpper_,
            uint128 liquidity_,
            uint256 feeGrowthInside0LastX128_,
            uint256 feeGrowthInside1LastX128_,
            uint128 tokensOwed0_,
            uint128 tokensOwed1_
        ) = thruster.positions(_tokenId);

        position_ = PositionStruct(
            nonce_,
            operator_,
            token0_,
            token1_,
            fee_,
            tickLower_,
            tickUpper_,
            liquidity_,
            feeGrowthInside0LastX128_,
            feeGrowthInside1LastX128_,
            tokensOwed0_,
            tokensOwed1_
        );
    }

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    struct MintBalanceParams {
        address manager;
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
    }

    function moduleC_depositBalance(MintBalanceParams memory params) public payable virtual {
        require(_tokenId == 0, "Cannot deposit with existing position");
        _mintBalance(params);
    }

    // TODO:- restrict who can call this
    function moduleC_rebalance(int24 tickLower, int24 tickUpper) external {
        PositionStruct memory pos = position();
        _withdrawBalance();
        _balanceTokens(tickLower, tickUpper);
        MintBalanceParams memory params = MintBalanceParams({
            manager: _thrusterManager,
            token0: pos.token0,
            token1: pos.token1,
            fee: pos.fee,
            tickLower: tickLower,
            tickUpper: tickUpper
        });
        _mintBalance(params);
    }

    function moduleC_withdrawBalance() external payable {
        // ? Why do internal functions
        _withdrawBalance();
        // Reset State
        _tokenId = 0;
        _token0 = address(0);
        _token1 = address(0);
        _thrusterManager = address(0);
        _fee = 0;
    }

    function moduleC_increaseLiquidity() public virtual {
        require(_tokenId != 0, "No existing position to increase");
        INonfungiblePositionManager thruster = INonfungiblePositionManager(_thrusterManager);

        uint256 amount0 = IERC20(_token0).balanceOf(address(this));
        uint256 amount1 = IERC20(_token1).balanceOf(address(this));

        _checkApproval(_token0, _thrusterManager, amount0);
        _checkApproval(_token1, _thrusterManager, amount1);

        thruster.increaseLiquidity(
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: _tokenId,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );
    }

    function moduleC_decreaseLiquidity(uint128 liquidity_) public {
        require(_tokenId != 0, "No existing position to decrease");
        INonfungiblePositionManager thruster = INonfungiblePositionManager(_thrusterManager);
        // Let position manager handle to large withdrawal

        thruster.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: _tokenId,
                liquidity: liquidity_,
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
    }

    function moduleC_decreaseLiquidityTo(uint128 liquidity_, address receiver) external {
        moduleC_decreaseLiquidity(liquidity_);
        _sendBalanceTo(receiver);
    }

    function moduleC_withdrawBalanceTo(address receiver) external payable {
        _withdrawBalance();
        _sendBalanceTo(receiver);
    }

    function _sendBalanceTo(address receiver) internal virtual {
        uint256 balance = IERC20(_token0).balanceOf(address(this));
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
    function _mintBalance(
        MintBalanceParams memory params
    ) internal returns (uint256 tokenId_, uint128 liquidity, uint256 amount0, uint256 amount1) {
        require(params.tickLower < params.tickUpper, "Invalid tick range");

        uint256 amount0Desired = IERC20(params.token0).balanceOf(address(this));
        uint256 amount1Desired = IERC20(params.token1).balanceOf(address(this));

        INonfungiblePositionManager thruster = INonfungiblePositionManager(params.manager);

        _checkApproval(params.token0, params.manager, amount0Desired);
        _checkApproval(params.token1, params.manager, amount1Desired);

        (tokenId_, liquidity, amount0, amount1) = thruster.mint(
            INonfungiblePositionManager.MintParams({
                token0: params.token0,
                token1: params.token1,
                fee: params.fee,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            })
        );

        // Set State
        _token0 = params.token0;
        _token1 = params.token1;
        _thrusterManager = params.manager;
        _fee = params.fee;
        _tokenId = tokenId_;
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
        // _tokenId = 0;
    }

    function _balanceTokens(int24 tickLower, int24 tickUpper) internal {
        require(tickLower < tickUpper, "Invalid tick range");
        IThrusterPool pool_ = IThrusterPool(pool());
        uint160 pa = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 pb = TickMath.getSqrtRatioAtTick(tickUpper);
        (uint160 p, , , , , , ) = pool_.slot0();

        uint256 amount0 = IERC20(_token0).balanceOf(address(this));
        uint256 amount1 = IERC20(_token1).balanceOf(address(this));

        if (pb <= p && amount0 > 0) {
            _performSwap(_token0, _token1, amount0);
        } else if (pa >= p && amount1 > 0) {
            _performSwap(_token1, _token0, amount1);
        } else {
            uint256 ratio = ((((uint256(p) * uint256(pb)) / uint256(pb - p)) * uint256(p - pa)) * 10 ** 18) / 2 ** 192;

            if ((amount0 * ratio) / 10 ** 18 > amount1) {
                uint256 amountIn = (amount0 - ((amount1 * 10 ** 18) / ratio)) / 2;
                _performSwap(_token0, _token1, amountIn);
            } else {
                uint256 amountIn = (amount1 - ((amount0 * ratio) / 10 ** 18)) / 2;
                _performSwap(_token1, _token0, amountIn);
            }
        }
    }

    function _performSwap(address tokenIn, address tokenOut, uint256 amountInput) internal {
        //TODO:- Add slippage
        ISwapRouter swapRouter = ISwapRouter(_thrusterRouter);

        // Get allowance
        _checkApproval(tokenIn, _thrusterRouter, amountInput);

        // Perform Swap
        swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: _fee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountInput,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
    }

    //? I think this should approve the same amount - no need to expose leftover tba balance to the protocols
    function _checkApproval(address token, address recipient, uint256 minAmount) internal {
        if (IERC20(token).allowance(address(this), recipient) < minAmount)
            IERC20(token).approve(recipient, type(uint256).max);
    }
}
