// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IThrusterRouter } from "./../interfaces/external/Thruster/IThrusterRouter.sol";
import { IHyperlockStaking } from "./../interfaces/external/Hyperlock/IHyperlockStaking.sol";
import { IRingSwapV2Router } from "./../interfaces/external/RingProtocol/IRingSwapV2Router.sol";
import { IFixedStakingRewards } from "./../interfaces/external/RingProtocol/IFixedStakingRewards.sol";
import { IBlasterswapV2Router02 } from "./../interfaces/external/Blaster/IBlasterswapV2Router02.sol";


/**
 * @title DexBalancerModuleA
 * @author AgentFi
 * @notice A module used in the dex balancer strategy.
 *
 * Designed for use on Blast Mainnet only.
 */
contract DexBalancerModuleA is Blastable {

    /***************************************
    CONSTANTS
    ***************************************/

    // tokens

    address internal constant _weth                = 0x4300000000000000000000000000000000000004;
    address internal constant _usdb                = 0x4300000000000000000000000000000000000003;

    // thruster

    address internal constant _thrusterRouter100   = 0x44889b52b71E60De6ed7dE82E2939fcc52fB2B4E; // 1% fee
    address internal constant _thrusterRouter030   = 0x98994a9A7a2570367554589189dC9772241650f6; // 0.3% fee
    address internal constant _thrusterLpToken     = 0x12c69BFA3fb3CbA75a1DEFA6e976B87E233fc7df;

    // hyperlock

    address internal constant _hyperlockStaking    = 0xC3EcaDB7a5faB07c72af6BcFbD588b7818c4a40e;

    // ring protocol

    //address internal constant _ringToken     = ;
    address internal constant _ringSwapV2Router     = 0x7001F706ACB6440d17cBFaD63Fa50a22D51696fF;
    address internal constant _ringFwWeth           = 0x66714DB8F3397c767d0A602458B5b4E3C0FE7dd1;
    address internal constant _ringFwUsdb           = 0x866f2C06B83Df2ed7Ca9C2D044940E7CD55a06d6;
    address internal constant _ringLpToken          = 0x9BE8a40C9cf00fe33fd84EAeDaA5C4fe3f04CbC3;
    address internal constant _ringFwLpToken        = 0xA3F8128166E54d49A65ec2ba12b45965E4FA87C9;
    address internal constant _ringStakingRewards   = 0xEff87A51f5Abd015F1AFCD5737BBab450eA15A24;
    uint256 internal constant _ringStakingIndex     = 3;

    // blasterswap

    address internal constant _blasterswapRouter    = 0xc972FaE6b524E8A6e0af21875675bF58a3133e60;
    address internal constant _blasterswapLpToken   = 0x3b5d3f610Cc3505f4701E9FB7D0F0C93b7713adD;

    /***************************************
    CONSTRUCTOR
    ***************************************/

    /**
     * @notice Constructs the DexBalancerModuleA contract.
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

    function weth() external view returns (address weth_) { weth_ = _weth; }
    function usdb() external view returns (address usdb_) { usdb_ = _usdb; }

    function thrusterRouter100() external view returns (address thrusterRouter100_) { thrusterRouter100_ = _thrusterRouter100; }
    function thrusterRouter030() external view returns (address thrusterRouter030_) { thrusterRouter030_ = _thrusterRouter030; }
    function thrusterLpToken() external view returns (address thrusterLpToken_) { thrusterLpToken_ = _thrusterLpToken; }
    function hyperlockStaking() external view returns (address hyperlockStaking_) { hyperlockStaking_ = _hyperlockStaking; }

    function ringSwapV2Router() external view returns (address ringSwapV2Router_) { ringSwapV2Router_ = _ringSwapV2Router; }
    function ringFwWeth() external view returns (address ringFwWeth_) { ringFwWeth_ = _ringFwWeth; }
    function ringFwUsdb() external view returns (address ringFwUsdb_) { ringFwUsdb_ = _ringFwUsdb; }
    function ringLpToken() external view returns (address ringLpToken_) { ringLpToken_ = _ringLpToken; }
    function ringFwLpToken() external view returns (address ringFwLpToken_) { ringFwLpToken_ = _ringFwLpToken; }
    function ringStakingRewards() external view returns (address ringStakingRewards_) { ringStakingRewards_ = _ringStakingRewards; }
    function ringStakingIndex() external view returns (uint256 ringStakingIndex_) { ringStakingIndex_ = _ringStakingIndex; }

    function blasterswapRouter() external view returns (address blasterswapRouter_) { blasterswapRouter_ = _blasterswapRouter; }
    function blasterswapLpToken() external view returns (address blasterswapLpToken_) { blasterswapLpToken_ = _blasterswapLpToken; }

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    function moduleA_depositBalance() external {
        _depositBalance();
    }

    function moduleA_withdrawBalance() external {
        _withdrawBalance();
    }

    function moduleA_withdrawBalanceTo(address receiver) external {
        _withdrawBalance();
        uint256 balance = address(this).balance;
        if(balance > 0) Calls.sendValue(receiver, balance);
        balance = IERC20(_weth).balanceOf(address(this));
        if(balance > 0) SafeERC20.safeTransfer(IERC20(_weth), receiver, balance);
        balance = IERC20(_usdb).balanceOf(address(this));
        if(balance > 0) SafeERC20.safeTransfer(IERC20(_usdb), receiver, balance);
    }

    /***************************************
    DEPOSIT FUNCTIONS
    ***************************************/

    /**
     * @notice Deposits this contracts balance into the dexes.
     */
    function _depositBalance() internal {
        {
        uint256 ethAmount = address(this).balance;
        if(ethAmount > 0) Calls.sendValue(_weth, ethAmount);
        }
        uint256 wethAmount = IERC20(_weth).balanceOf(address(this)) / 3;
        uint256 usdbAmount = IERC20(_usdb).balanceOf(address(this)) / 3;
        if(wethAmount > 0 && usdbAmount > 0) {
            _depositThruster(wethAmount, usdbAmount);
            _depositRingProtocol(wethAmount, usdbAmount);
            _depositBlasterswap(wethAmount, usdbAmount);
        }
    }

    /**
     * @notice Deposits tokens into Thruster.
     */
    function _depositThruster(uint256 wethAmount, uint256 usdbAmount) internal {
        // approve weth and usdb to router
        _checkApproval(_weth, _thrusterRouter030, wethAmount);
        _checkApproval(_usdb, _thrusterRouter030, usdbAmount);
        // add liquidity
        IThrusterRouter router = IThrusterRouter(_thrusterRouter030);
        router.addLiquidity(_weth, _usdb, wethAmount, usdbAmount, 0, 0, address(this), type(uint256).max);
        // stake lp token on hyperlock
        uint256 liquidity = IERC20(_thrusterLpToken).balanceOf(address(this));
        if(liquidity == 0) return;
        _checkApproval(_thrusterLpToken, _hyperlockStaking, liquidity);
        IHyperlockStaking(_hyperlockStaking).stake(_thrusterLpToken, liquidity, 0);
    }

    /**
     * @notice Deposits tokens into Ring Protocol.
     * Deposits the tokens into the liquidity pool and stakes the LP token.
     * Will attempt to deposit this TBA's entire balance of each token.
     */
    function _depositRingProtocol(uint256 wethAmount, uint256 usdbAmount) internal {
        // approve weth and usdb to router
        _checkApproval(_weth, _ringSwapV2Router, wethAmount);
        _checkApproval(_usdb, _ringSwapV2Router, usdbAmount);
        // add liquidity
        IRingSwapV2Router router = IRingSwapV2Router(_ringSwapV2Router);
        router.addLiquidity(_weth, _usdb, wethAmount, usdbAmount, 0, 0, address(this), type(uint256).max);
        // stake lp token
        uint256 liquidity = IERC20(_ringLpToken).balanceOf(address(this));
        if(liquidity == 0) return;
        _checkApproval(_ringLpToken, _ringStakingRewards, liquidity);
        IFixedStakingRewards(_ringStakingRewards).stake(_ringStakingIndex, liquidity);
    }

    /**
     * @notice Deposits tokens into Blasterswap.
     */
    function _depositBlasterswap(uint256 wethAmount, uint256 usdbAmount) internal {
        // approve weth and usdb to router
        _checkApproval(_weth, _blasterswapRouter, wethAmount);
        _checkApproval(_usdb, _blasterswapRouter, usdbAmount);
        // add liquidity
        IBlasterswapV2Router02 router = IBlasterswapV2Router02(_blasterswapRouter);
        router.addLiquidity(_weth, _usdb, wethAmount, usdbAmount, 0, 0, address(this), type(uint256).max);
    }

    /***************************************
    WITHDRAW FUNCTIONS
    ***************************************/

    function _withdrawBalance() internal {
        _withdrawThruster();
        _withdrawRingProtocol();
        _withdrawBlasterswap();
    }

    function _withdrawThruster() internal {
        // withdraw from hyperlock
        uint256 balance = IHyperlockStaking(_hyperlockStaking).staked(address(this), _thrusterLpToken);
        if(balance > 0) {
            IHyperlockStaking(_hyperlockStaking).unstake(_thrusterLpToken, balance);
        }
        // withdraw from thruster pool
        balance = IERC20(_thrusterLpToken).balanceOf(address(this));
        if(balance > 0) {
            _checkApproval(_thrusterLpToken, _thrusterRouter030, balance);
            IThrusterRouter(_thrusterRouter030).removeLiquidity(_weth, _usdb, balance, 0, 0, address(this), type(uint256).max);
        }
    }

    function _withdrawRingProtocol() internal {
        // unstake lp token
        uint256 balance = IFixedStakingRewards(_ringStakingRewards).balanceOf(_ringStakingIndex, address(this));
        if(balance > 0) {
            IFixedStakingRewards(_ringStakingRewards).withdraw(_ringStakingIndex, balance);
        }
        // claim rewards
        /* // none available
        balance = IFixedStakingRewards(_ringStakingRewards).earned(_ringStakingIndex, address(this));
        if(balance > 0) {
            IFixedStakingRewards(_ringStakingRewards).getReward(_ringStakingIndex);
        }
        */
        // withdraw from pool
        balance = IERC20(_ringLpToken).balanceOf(address(this));
        if(balance > 0) {
            _checkApproval(_ringLpToken, _ringSwapV2Router, balance);
            IRingSwapV2Router(_ringSwapV2Router).removeLiquidity(_ringFwWeth, _ringFwUsdb, balance, 0, 0, address(this), type(uint256).max);
        }
    }

    function _withdrawBlasterswap() internal {
      // withdraw from pool
      uint256 balance = IERC20(_blasterswapLpToken).balanceOf(address(this));
      if(balance > 0) {
          _checkApproval(_blasterswapLpToken, _blasterswapRouter, balance);
          IBlasterswapV2Router02(_blasterswapRouter).removeLiquidity(_weth, _usdb, balance, 0, 0, address(this), type(uint256).max);
      }
    }

    function _checkApproval(address token, address recipient, uint256 minAmount) internal {
        if(IERC20(token).allowance(address(this), recipient) < minAmount) IERC20(token).approve(recipient, type(uint256).max);
    }
}
