// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Blastable } from "./../utils/Blastable.sol";
//import { BlastooorGenesisAgentAccount } from "./BlastooorGenesisAgentAccount.sol";
//import { IBlastooorAgentAccountRingProtocolD } from "./../interfaces/accounts/IBlastooorAgentAccountRingProtocolD.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
//import { IUniversalRouter } from "./../interfaces/external/RingProtocol/IUniversalRouter.sol";
//import { IFewRouter } from "./../interfaces/external/RingProtocol/IFewRouter.sol";
import { IRingSwapV2Router } from "./../interfaces/external/RingProtocol/IRingSwapV2Router.sol";
import { IFixedStakingRewards } from "./../interfaces/external/RingProtocol/IFixedStakingRewards.sol";
import "hardhat/console.sol";

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

    address internal constant _weth              = 0x4300000000000000000000000000000000000004;
    address internal constant _usdb              = 0x4300000000000000000000000000000000000003;

    // thruster

    address internal constant _thrusterRouter    = 0x44889b52b71E60De6ed7dE82E2939fcc52fB2B4E;


    // ring protocol

    //address internal constant _ringToken     = ;
    address internal constant _ringSwapV2Router   = 0x7001F706ACB6440d17cBFaD63Fa50a22D51696fF;
    address internal constant _ringFwWeth         = 0x66714DB8F3397c767d0A602458B5b4E3C0FE7dd1;
    address internal constant _ringFwUsdb         = 0x866f2C06B83Df2ed7Ca9C2D044940E7CD55a06d6;
    address internal constant _ringLpToken        = 0x9BE8a40C9cf00fe33fd84EAeDaA5C4fe3f04CbC3;
    address internal constant _ringFwLpToken      = 0xA3F8128166E54d49A65ec2ba12b45965E4FA87C9;
    address internal constant _ringStakingRewards = 0xEff87A51f5Abd015F1AFCD5737BBab450eA15A24;
    uint256 internal constant _ringStakingIndex   = 3;

    /*
    address internal constant _universalRouter = 0x334e3F7f5A9740627fA47Fa9Aa51cE0ccbD765cF;
    address internal constant _fewRouter       = 0x02F1e7A518e3E286C8E305E39cA7D4f25e0a44Aa;
    address internal constant _stakingRewards  = 0x366Ac78214aFE145Ca35d4A6513F4eD9e8909Fe8;


    address internal constant _tokenA                     = 0x4200000000000000000000000000000000000023;
    address internal constant _tokenB                     = 0x4200000000000000000000000000000000000022;
    address internal constant _fwtokenA                   = 0x798dE0520497E28E8eBfF0DF1d791c2E942eA881;
    address internal constant _fwtokenB                   = 0xa7870cf9143084ED04f4C2311f48CB24a2b4A097;
    address internal constant _lptoken                    = 0x024Dd95113137f04E715B2fC8F637FBe678e9512;
    uint256 internal constant _stakingRewardsIndex        = 2;
    */
    // thruster no longer supports testnet

    // other

    uint256 internal constant _wethRebalanceThreshold = 100_000_000_000_000; // 1/10_000 of 1 WETH
    uint256 internal constant _usdbRebalanceThreshold = 100_000_000_000_000_000; // 1/10 of 1 USDB

    /// @dev Used for identifying cases when this contract's balance of a token is to be used as an input
    /// This value is equivalent to 1<<255, i.e. a singular 1 in the most significant bit.
    uint256 internal constant CONTRACT_BALANCE = 0x8000000000000000000000000000000000000000000000000000000000000000;

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
    function ringSwapV2Router() external view returns (address ringSwapV2Router_) { ringSwapV2Router_ = _ringSwapV2Router; }
    function ringFwWeth() external view returns (address ringFwWeth_) { ringFwWeth_ = _ringFwWeth; }
    function ringFwUsdb() external view returns (address ringFwUsdb_) { ringFwUsdb_ = _ringFwUsdb; }
    function ringLpToken() external view returns (address ringLpToken_) { ringLpToken_ = _ringLpToken; }
    function ringFwLpToken() external view returns (address ringFwLpToken_) { ringFwLpToken_ = _ringFwLpToken; }
    function ringStakingRewards() external view returns (address ringStakingRewards_) { ringStakingRewards_ = _ringStakingRewards; }
    function ringStakingIndex() external view returns (uint256 ringStakingIndex_) { ringStakingIndex_ = _ringStakingIndex; }
    //function xxx() external view returns (address xxx_) { xxx_ = _xxx; }
    //function xxx() external view returns (address xxx_) { xxx_ = _xxx; }

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    function moduleA_depositBalanceWithoutRebalance() external {
        console.log("we in here! moduleA_depositBalanceWithoutRebalance");

        {
        uint256 ethAmount = address(this).balance;
        if(ethAmount > 0) Calls.sendValue(_weth, ethAmount);
        }
        uint256 wethAmount = IERC20(_weth).balanceOf(address(this)) / 3;
        uint256 usdbAmount = IERC20(_usdb).balanceOf(address(this)) / 3;

        if(wethAmount == 0 || usdbAmount == 0) return;

        _depositThruster(wethAmount, usdbAmount);
        _depositRingProtocol(wethAmount, usdbAmount);
        _depositOther(wethAmount, usdbAmount);
    }

    function moduleA_depositBalanceWithRebalance() external {
        console.log("we in here! moduleA_depositBalanceWithRebalance");

        {
        uint256 ethAmount = address(this).balance;
        if(ethAmount > 0) Calls.sendValue(_weth, ethAmount);
        }
        uint256 wethAmount = IERC20(_weth).balanceOf(address(this)) / 3;
        uint256 usdbAmount = IERC20(_usdb).balanceOf(address(this)) / 3;

        if(wethAmount == 0 && usdbAmount == 0) return;

        //_depositThruster(wethAmount, usdbAmount);
        _depositRingProtocolWithRebalance(wethAmount, usdbAmount);
        //_depositOther(wethAmount, usdbAmount);
    }

    function moduleA_withdrawBalance() external {
        console.log("we in here! moduleA_withdrawBalance");
        _withdrawRingProtocol();
    }

    function moduleA_withdrawBalanceTo(address receiver) external {
        console.log("we in here! moduleA_withdrawBalanceTo");
        _withdrawRingProtocol();
    }

    /**
     * @notice Deposits tokens into Thruster.
     */
    function _depositThruster(uint256 wethAmount, uint256 usdbAmount) internal {

    }

    /**
     * @notice Deposits tokens into Ring Protocol.
     * Deposits the tokens into the liquidity pool and stakes the LP token.
     * Will attempt to deposit this TBA's entire balance of each token.
     */
    function _depositRingProtocol(uint256 wethAmount, uint256 usdbAmount) internal {
        // approve weth and usdb to router
        if(IERC20(_weth).allowance(address(this), _ringSwapV2Router) < wethAmount) IERC20(_weth).approve(_ringSwapV2Router, type(uint256).max);
        if(IERC20(_usdb).allowance(address(this), _ringSwapV2Router) < usdbAmount) IERC20(_usdb).approve(_ringSwapV2Router, type(uint256).max);
        // add liquidity
        IRingSwapV2Router router = IRingSwapV2Router(_ringSwapV2Router);
        router.addLiquidity(_weth, _usdb, wethAmount, usdbAmount, 0, 0, address(this), type(uint256).max);
        //(uint256 wethUsed, uint256 usdbUsed, ) = router.addLiquidity(_weth, _usdb, wethAmount, usdbAmount, 0, 0, address(this), type(uint256).max);

        // stake lp token
        uint256 liquidity = IERC20(_ringLpToken).balanceOf(address(this));
        if(liquidity == 0) return;
        if(IERC20(_ringLpToken).allowance(address(this), _ringStakingRewards) < liquidity) IERC20(_ringLpToken).approve(_ringStakingRewards, type(uint256).max);
        IFixedStakingRewards(_ringStakingRewards).stake(_ringStakingIndex, liquidity);
    }

    /**
     * @notice Deposits tokens into Ring Protocol.
     * Deposits the tokens into the liquidity pool and stakes the LP token.
     * Will attempt to deposit this TBA's entire balance of each token.
     */
    function _depositRingProtocolWithRebalance(uint256 wethAmount, uint256 usdbAmount) internal {
        console.log("in _depositRingProtocolWithRebalance()");
        // approve weth and usdb to router
        if(IERC20(_weth).allowance(address(this), _ringSwapV2Router) < wethAmount) IERC20(_weth).approve(_ringSwapV2Router, type(uint256).max);
        if(IERC20(_usdb).allowance(address(this), _ringSwapV2Router) < usdbAmount) IERC20(_usdb).approve(_ringSwapV2Router, type(uint256).max);
        // add liquidity
        IRingSwapV2Router router = IRingSwapV2Router(_ringSwapV2Router);
        //router.addLiquidity(_weth, _usdb, wethAmount, usdbAmount, 0, 0, address(this), type(uint256).max);
        uint256 wethUsed;
        uint256 usdbUsed;
        console.log("here 1.", wethAmount, usdbAmount);
        if(wethAmount > 0 && usdbAmount > 0) {
            console.log("adding liquidity 1");
            (wethUsed, usdbUsed, ) = router.addLiquidity(_weth, _usdb, wethAmount, usdbAmount, 0, 0, address(this), type(uint256).max);
        }
        console.log("here 2.", wethUsed, usdbUsed);
        // check rebalance
        wethAmount -= wethUsed;
        usdbAmount -= usdbUsed;
        console.log("here 3.", wethAmount, usdbAmount);
        if(wethAmount > 0) {
            console.log("here 4");
            if(wethAmount >= _wethRebalanceThreshold) {
                console.log("here 5");
                address[] memory path = new address[](2);
                path[0] = _weth;
                path[1] = _usdb;
                (uint256[] memory amounts) = router.swapExactTokensForTokens(wethAmount/2, 0, path, address(this), type(uint256).max);
                wethAmount -= amounts[0];
                usdbAmount += amounts[1];
                console.log("here 6.", amounts[0], amounts[1]);
                console.log("here 7.", wethAmount, usdbAmount);
            }
        } else if(usdbAmount > 0) {
            if(usdbAmount >= _usdbRebalanceThreshold) {

            }
        }

        console.log("here 21.", wethAmount, usdbAmount);
        if(wethAmount > 0 && usdbAmount > 0) {
            console.log("adding liquidity 2");
            (wethUsed, usdbUsed, ) = router.addLiquidity(_weth, _usdb, wethAmount, usdbAmount, 0, 0, address(this), type(uint256).max);
        }

        // stake lp token
        uint256 liquidity = IERC20(_ringLpToken).balanceOf(address(this));
        console.log("here 22.", liquidity);
        if(liquidity == 0) return;
        if(IERC20(_ringLpToken).allowance(address(this), _ringStakingRewards) < liquidity) IERC20(_ringLpToken).approve(_ringStakingRewards, type(uint256).max);
        IFixedStakingRewards(_ringStakingRewards).stake(_ringStakingIndex, liquidity);
        /*
        // deposit
        IFewRouter frouter = IFewRouter(fewRouter);
        if(tokenAAmount > 0 && tokenBAmount > 0) {
            frouter.addLiquidity(tknA, tknB, tokenAAmount, tokenBAmount, 0, 0, address(this), type(uint256).max);
            // get leftovers
            tokenAAmount = IERC20(tknA).balanceOf(address(this));
            tokenBAmount = IERC20(tknB).balanceOf(address(this));
        }

        // if more
        if(tokenAAmount > 0 || tokenBAmount > 0) {
            // if excess tokenA, swap half for tokenB
            if(tokenAAmount > 0) {
                address[] memory path = new address[](2);
                path[0] = fwtokenA;
                path[1] = fwtokenB;
                frouter.swapExactTokensForTokens(tokenAAmount/2, 0, path, address(this), type(uint256).max);
            }
            // if excess tokenB, swap half for tokenA
            else if(tokenBAmount > 0) {
                address[] memory path = new address[](2);
                path[0] = fwtokenB;
                path[1] = fwtokenA;
                frouter.swapExactTokensForTokens(tokenBAmount/2, 0, path, address(this), type(uint256).max);
            }
            // deposit
            tokenAAmount = IERC20(tknA).balanceOf(address(this));
            tokenBAmount = IERC20(tknB).balanceOf(address(this));
            frouter.addLiquidity(tknA, tknB, tokenAAmount, tokenBAmount, 0, 0, address(this), type(uint256).max);
        }

        // stake lp token
        address lptkn = lptoken;
        address staking = stakingRewards;
        uint256 liquidity = IERC20(lptkn).balanceOf(address(this));
        IERC20(lptkn).approve(staking, type(uint256).max);
        IFixedStakingRewards(staking).stake(stakingRewardsIndex, liquidity);
        */
    }

    /**
     * @notice Deposits tokens into Other.
     */
    function _depositOther(uint256 wethAmount, uint256 usdbAmount) internal {

    }

    function _withdrawRingProtocol() internal {
        console.log("in _withdrawRingProtocol() 1");
        // unstake lp token
        //IFixedStakingRewards staking = IFixedStakingRewards(stakingRewards);
        //IFixedStakingRewards(_ringStakingRewards).stake(_ringStakingIndex, liquidity);
        //  uint256 index = stakingRewardsIndex;
        uint256 balance = IFixedStakingRewards(_ringStakingRewards).balanceOf(_ringStakingIndex, address(this));
        console.log("in _withdrawRingProtocol() 2");
        if(balance > 0) {
            console.log("in _withdrawRingProtocol() 3");
            IFixedStakingRewards(_ringStakingRewards).withdraw(_ringStakingIndex, balance);
        }
        console.log("in _withdrawRingProtocol() 4");
        // claim rewards
        /* // none available
        balance = IFixedStakingRewards(_ringStakingRewards).earned(_ringStakingIndex, address(this));
        if(balance > 0) {
            IFixedStakingRewards(_ringStakingRewards).getReward(_ringStakingIndex);
        }
        */
        // withdraw from pool
        balance = IERC20(_ringLpToken).balanceOf(address(this));
        console.log("in _withdrawRingProtocol() 5");
        if(balance > 0) {
            console.log("in _withdrawRingProtocol() 6");
            if(IERC20(_ringLpToken).allowance(address(this), _ringSwapV2Router) < balance) IERC20(_ringLpToken).approve(_ringSwapV2Router, type(uint256).max);
            console.log("in _withdrawRingProtocol() 7");
            IRingSwapV2Router(_ringSwapV2Router).removeLiquidity(_ringFwWeth, _ringFwUsdb, balance, 0, 0, address(this), type(uint256).max);
        }
        console.log("in _withdrawRingProtocol() 8");
/*
Remove Liquidity E T H (address, uint256, uint256, uint256, address, uint256)
Parameters:

[
  {
    "type": "address"
  },
  {
    "type": "uint256"
  },
  {
    "type": "uint256"
  },
  {
    "type": "uint256"
  },
  {
    "type": "address"
  },
  {
    "type": "uint256"
  }
]

Hex data: 196 bytes

0x02751cec000000000000000000000000866f2c06b83df2ed7ca9c2d044940e7cd55a06d6000000000000000000000000000000000000000000000000000eadf7c130c93c0000000000000000000000000000000000000000000000000335cb8372bf41f400000000000000000000000000000000000000000000000000003f4023fce93a0000000000000000000000007da01a06a2582193c2867e22fe62f7f649f7b9e20000000000000000000000000000000000000000000000000000000065ffefab

0x02751cec
000000000000000000000000866f2c06b83df2ed7ca9c2d044940e7cd55a06d6
000000000000000000000000000000000000000000000000000eadf7c130c93c
0000000000000000000000000000000000000000000000000335cb8372bf41f4
00000000000000000000000000000000000000000000000000003f4023fce93a
0000000000000000000000007da01a06a2582193c2867e22fe62f7f649f7b9e2
0000000000000000000000000000000000000000000000000000000065ffefab
*/

    }

    /*
    function initialize(
        address tokenA_,
        address tokenB_,
        address fwtokenA_,
        address fwtokenB_,
        address lptoken_,
        uint256 stakingRewardsIndex_
    ) external payable {
        //_beforeExecuteStrategy();
        if(tokenA != address(0)) revert Errors.AlreadyInitialized();
        tokenA = tokenA_;
        tokenB = tokenB_;
        fwtokenA = fwtokenA_;
        fwtokenB = fwtokenB_;
        lptoken = lptoken_;
        stakingRewardsIndex = stakingRewardsIndex_;
        address frouter = fewRouter;
        IERC20(tokenA_).approve(frouter, type(uint256).max);
        IERC20(tokenB_).approve(frouter, type(uint256).max);
        IERC20(lptoken_).approve(frouter, type(uint256).max);
        //_depositRingProtocolStrategyD();
    }
    */
    /*
    function tokenA() external view returns (address token) {
        token = _tokenA;
    }

    function tokenB() external view returns (address token) {
        token = _tokenB;
    }

    function fwtokenA() external view returns (address token) {
        token = _fwtokenA;
    }

    function fwtokenB() external view returns (address token) {
        token = _fwtokenB;
    }

    function lptoken() external view returns (address token) {
        token = _lptoken;
    }

    function stakingRewardsIndex() external view returns (uint256 index) {
        index = _stakingRewardsIndex;
    }
    */

}
