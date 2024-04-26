// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { Calls } from "./../libraries/Calls.sol";
import { PoolAddress } from "./../libraries/PoolAddress.sol";
import { TickMath } from "./../libraries/TickMath.sol";
import { INonfungiblePositionManager } from "./../interfaces/external/Thruster/INonfungiblePositionManager.sol";
import { ISwapRouter } from "./../interfaces/external/Thruster/ISwapRouter.sol";
import { IThrusterPool as IV3Pool } from "./../interfaces/external/Thruster/IThrusterPool.sol";

// ! Need to be careful of signature collisions

/**
 * @title ConcentratedLiquidityModuleC
 * @author AgentFi
 * @notice A module used in the Concentrated liquidity strategy.
 * @dev Designed for use on Blast Mainnet only.
 *
 */
contract ConcentratedLiquidityModuleC is Blastable {
    /***************************************
    State
    ***************************************/
    bytes32 private constant CONCENTRATED_LIQUIDITY_MODULEC_STORAGE_POSITION =
        keccak256("agentfi.storage.concentratedliquiditymodulec");

    struct ConcentratedLiquidityModuleCStorage {
        address manager;
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
    function manager() public view returns (address manager_) {
        manager_ = concentratedLiquidityModuleCStorage().manager;
    }

    /// @notice TokenId of NFT position (if exists)
    function tokenId() public view returns (uint256 tokenId_) {
        tokenId_ = concentratedLiquidityModuleCStorage().tokenId;
    }

    /// @notice Derive the pool address
    // TODO:- Save pool, use factory to get address
    function getPool(
        address factory_,
        address token0_,
        address token1_,
        uint24 fee_
    ) internal pure returns (IV3Pool pool_) {
        pool_ = IV3Pool(PoolAddress.computeAddress(factory_, PoolAddress.getPoolKey(token0_, token1_, fee_)));
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
        require(state.tokenId != 0, "No existing position to view");
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
    function moduleC_mint(
        INonfungiblePositionManager.MintParams memory params
    ) public payable returns (uint256 tokenId_, uint128 liquidity, uint256 amount0, uint256 amount1) {
        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();

        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);

        _setApproval(params.token0, state.manager, params.amount0Desired);
        _setApproval(params.token1, state.manager, params.amount1Desired);

        (tokenId_, liquidity, amount0, amount1) = manager_.mint(params);
    }

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

        require(state.tokenId != 0, "No existing position to increase");

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

    struct DecreaseLiquidityParams {
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }
    function moduleC_decreaseLiquidity(
        DecreaseLiquidityParams memory params
    ) public returns (uint256 amount0, uint256 amount1) {
        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();
        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);
        require(state.tokenId != 0, "No existing position to increase");

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

    struct CollectParams {
        uint128 amount0Max;
        uint128 amount1Max;
    }
    function moduleC_collect(CollectParams memory params) public returns (uint256 amount0, uint256 amount1) {
        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();
        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);
        require(state.tokenId != 0, "No existing position exists");

        (amount0, amount1) = manager_.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: state.tokenId,
                recipient: address(this),
                amount0Max: params.amount0Max,
                amount1Max: params.amount1Max
            })
        );
    }

    function moduleC_burn() public {
        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();
        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);
        require(state.tokenId != 0, "No existing position exists");

        manager_.burn(state.tokenId);
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
        _setApproval(params.tokenIn, router, params.amountItn);

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

    /***************************************
    AGENT HIGH LEVEL FUNCTIONS
    ***************************************/

    struct MintBalanceParams {
        address manager;
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
    }

    /// @notice Mints new position with all assets in this contract
    function moduleC_mintBalance(MintBalanceParams memory params) public payable virtual {
        require(tokenId() == 0, "Cannot deposit with existing position");
        _mintBalance(params);
    }

    /// @notice Withdrawals principal and fee, and burns position, returning the funds to this contract
    function moduleC_withdrawBalance() external payable {
        _withdrawBalance();

        // Reset State
        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();
        state.tokenId = 0;
        state.manager = address(0);
    }

    /// @notice Sends token balance to a specified receiver.
    function moduleC_sendBalanceTo(address receiver, address[] memory tokens) public virtual {
        for (uint256 i = 0; i < tokens.length; ++i) {
            address token = tokens[i];
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) {
                SafeERC20.safeTransfer(IERC20(token), receiver, balance);
            }
        }
    }

    /// @notice Sends funds to receiver after withdrawaling position
    function moduleC_withdrawBalanceTo(address receiver) external payable {
        (, , address token0, address token1, , , , , , , , ) = position();
        address[] memory tokens = new address[](2);
        tokens[0] = token0;
        tokens[1] = token1;

        _withdrawBalance();
        moduleC_sendBalanceTo(receiver, tokens);
    }

    struct RebalanceParams {
        address router; // Address of router contract
        uint24 fee; // Fee pool to use
        uint24 slippage; // Slippage to tolerate
        int24 tickLower;
        int24 tickUpper;
    }

    // TODO:- restrict who can call this
    /// @notice Withdrawals, swaps and creates a new position at the new range
    function moduleC_rebalance(RebalanceParams memory params) external {
        (, , address token0, address token1, uint24 fee, , , , , , , ) = position();
        address _manager = concentratedLiquidityModuleCStorage().manager;

        _withdrawBalance();
        _balanceTokens(params, token0, token1, fee);

        _mintBalance(
            MintBalanceParams({
                manager: _manager,
                token0: token0,
                token1: token1,
                fee: fee,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper
            })
        );
    }

    /// @notice Deposit all assets in contract to existing position (does not change range)
    function moduleC_increaseLiquidityWithBalance()
        public
        virtual
        returns (uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        (, , address token0, address token1, , , , , , , , ) = position();

        (liquidity, amount0, amount1) = moduleC_increaseLiquidity(
            IncreaseLiquidityParams({
                amount0Desired: IERC20(token0).balanceOf(address(this)),
                amount1Desired: IERC20(token1).balanceOf(address(this)),
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );
    }

    /// @notice Perform partial withdrawal, keeping funds in the this contract
    function moduleC_decreaseLiquidityToSelf(uint128 liquidity_) public {
        require(tokenId() != 0, "No existing position to decrease");
        _decreaseLiquidityAndCollect(liquidity_);
    }

    /// @notice Perform partial withdrawal, sending funds to the receiver
    function moduleC_decreaseLiquidityTo(uint128 liquidity_, address receiver) external {
        moduleC_decreaseLiquidityToSelf(liquidity_);

        (, , address token0, address token1, , , , , , , , ) = position();
        address[] memory tokens = new address[](2);
        tokens[0] = token0;
        tokens[1] = token1;
        moduleC_sendBalanceTo(receiver, tokens);
    }

    /// @notice Collect tokens owned in position, keeping funds in the this contract
    function moduleC_collectToSelf() public {
        moduleC_collect(CollectParams({ amount0Max: type(uint128).max, amount1Max: type(uint128).max }));
    }

    /// @notice Collect tokens owned in position, sending funds to the receiver
    function moduleC_collectTo(address receiver) external virtual {
        _decreaseLiquidityAndCollect(0);

        (, , address token0, address token1, , , , , , , , ) = position();
        address[] memory tokens = new address[](2);
        tokens[0] = token0;
        tokens[1] = token1;
        moduleC_sendBalanceTo(receiver, tokens);
    }

    /***************************************
    INTERNAL FUNCTIONS
    ***************************************/

    /**
     * @notice Mints position with all of tokens in the contract
     */
    function _mintBalance(
        MintBalanceParams memory params
    ) internal returns (uint256 tokenId_, uint128 liquidity, uint256 amount0, uint256 amount1) {
        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();
        state.manager = params.manager;

        (tokenId_, liquidity, amount0, amount1) = moduleC_mint(
            INonfungiblePositionManager.MintParams({
                token0: params.token0,
                token1: params.token1,
                fee: params.fee,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                amount0Desired: IERC20(params.token0).balanceOf(address(this)),
                amount1Desired: IERC20(params.token1).balanceOf(address(this)),
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            })
        );

        state.tokenId = tokenId_;
    }

    /// @notice Collects tokens owed to a position
    function _decreaseLiquidityAndCollect(uint128 liquidity) internal {
        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();

        if (liquidity > 0) {
            moduleC_decreaseLiquidity(
                DecreaseLiquidityParams({
                    liquidity: liquidity,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp
                })
            );
        }

        moduleC_collect(CollectParams({ amount0Max: type(uint128).max, amount1Max: type(uint128).max }));
    }

    /// @notice Withdrawal everything and burn position
    function _withdrawBalance() internal {
        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();

        (, , , , , , , uint128 liquidity, , , , ) = position();
        _decreaseLiquidityAndCollect(liquidity);
        INonfungiblePositionManager(state.manager).burn(state.tokenId);
    }

    /**
     * @notice Rebalances tokens in contract to optimal ratio for depositing into position
     * @dev Not exact as it does not consider price impact of the swap
     */
    function _balanceTokens(RebalanceParams memory params, address token0, address token1, uint24 fee) internal {
        require(params.tickLower < params.tickUpper, "Invalid tick range");
        ConcentratedLiquidityModuleCStorage storage state = concentratedLiquidityModuleCStorage();

        uint160 pa = TickMath.getSqrtRatioAtTick(params.tickLower);
        uint160 pb = TickMath.getSqrtRatioAtTick(params.tickUpper);

        INonfungiblePositionManager manager_ = INonfungiblePositionManager(state.manager);
        IV3Pool pool_ = getPool(manager_.factory(), token0, token1, fee);
        (uint160 p, , , , , , ) = pool_.slot0();

        uint256 amount0 = IERC20(token0).balanceOf(address(this));
        uint256 amount1 = IERC20(token1).balanceOf(address(this));

        if (pb <= p && amount0 > 0) {
            _performSwap(params, token0, token1, amount0);
        } else if (pa >= p && amount1 > 0) {
            _performSwap(params, token1, token0, amount1);
        } else {
            uint256 ratio = ((((uint256(p) * uint256(pb)) / uint256(pb - p)) * uint256(p - pa)) * 10 ** 18) / 2 ** 192;

            if ((amount0 * ratio) / 10 ** 18 > amount1) {
                uint256 amountIn = (amount0 - ((amount1 * 10 ** 18) / ratio)) / 2;
                _performSwap(params, token0, token1, amountIn);
            } else {
                uint256 amountIn = (amount1 - ((amount0 * ratio) / 10 ** 18)) / 2;
                _performSwap(params, token1, token0, amountIn);
            }
        }
    }

    /// @notice Perform a swap of tokens
    function _performSwap(RebalanceParams memory params, address tokenIn, address tokenOut, uint256 amountIn) internal {
        ISwapRouter swapRouter = ISwapRouter(params.router);
        // TODO:- better take in price off chain
        IV3Pool pool_ = getPool(swapRouter.factory(), tokenIn, tokenOut, params.fee);

        // Set a slippage
        (uint160 sqrtPriceX96, , , , , , ) = pool_.slot0();

        uint256 amountOutMinimum;
        if (tokenIn < tokenOut) {
            amountOutMinimum = Math.mulDiv(amountIn, uint256(sqrtPriceX96) ** 2, 2 ** 192);
        } else {
            amountOutMinimum = Math.mulDiv(amountIn, 2 ** 192, uint256(sqrtPriceX96) ** 2);
        }

        amountOutMinimum = Math.mulDiv(amountOutMinimum, 1_000_000 - params.slippage, 1_000_000);

        // Perform Swap
        moduleC_exactInputSingle(
            params.router,
            ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: params.fee,
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            })
        );
    }

    /***************************************
    UTIL FUNCTIONS
    ***************************************/

    function _setApproval(address token, address spender, uint256 value) internal {
        SafeERC20.safeIncreaseAllowance(IERC20(token), spender, value);
    }
}
