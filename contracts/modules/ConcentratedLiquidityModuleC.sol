// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { Calls } from "./../libraries/Calls.sol";
import { INonfungiblePositionManager } from "./../interfaces/external/Thruster/INonfungiblePositionManager.sol";
import { ISwapRouter } from "./../interfaces/external/Thruster/ISwapRouter.sol";

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

    // thruster
    address internal constant _thrusterManager = 0x434575EaEa081b735C985FA9bf63CD7b87e227F9;
    address internal constant _thrusterRouter = 0x337827814155ECBf24D20231fCA4444F530C0555;

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
        _swap();
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

    function _swap() internal {
        ISwapRouter router = ISwapRouter(_thrusterRouter);

        // TODO:- Take in amount and token to swap, and slippage (either with amount minim or bps)
        uint256 amount = IERC20(_token0).balanceOf(address(this)) / 2;
        _checkApproval(_token0, _thrusterRouter, amount);

        router.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: _token0,
                tokenOut: _token1,
                fee: 3000,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0 // TODO:- Check why we don't need to set this
            })
        );
    }

    //? I think this should approve the same amount - no need to expose leftover tba balance to the protocols
    function _checkApproval(address token, address recipient, uint256 minAmount) internal {
        if (IERC20(token).allowance(address(this), recipient) < minAmount)
            IERC20(token).approve(recipient, type(uint256).max);
    }
}
