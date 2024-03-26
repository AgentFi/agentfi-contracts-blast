// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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
 * @title DexBalancerModuleB
 * @author AgentFi
 * @notice A module used in the dex balancer strategy.
 *
 * Designed for use on Blast Mainnet only.
 */
contract DexBalancerModuleB is Blastable {

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

    // blasterswap

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
     * @notice Constructs the DexBalancerModuleB contract.
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

    function moduleB_depositBalance() external {
        console.log("we in here! moduleB_depositBalance");
        _depositBalance();
    }

    function moduleB_withdrawBalance() external {
        console.log("we in here! moduleB_withdrawBalance");
        _withdrawBalance();
    }

    function moduleB_withdrawBalanceTo(address receiver) external {
        console.log("we in here! moduleB_withdrawBalanceTo");
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

        if(wethAmount == 0 && usdbAmount == 0) return;
        //if(wethAmount == 0 || usdbAmount == 0) return;
        if(wethAmount > 0 && usdbAmount > 0) {
            _depositThruster(wethAmount, usdbAmount);
            _depositRingProtocol(wethAmount, usdbAmount);
            _depositBlasterswap(wethAmount, usdbAmount);
        }

        wethAmount = IERC20(_weth).balanceOf(address(this));
        usdbAmount = IERC20(_usdb).balanceOf(address(this));

        //if(wethAmount == 0 && usdbAmount == 0) return;
        if(wethAmount > 0) _depositOrbitLendingWETH(wethAmount);
        if(usdbAmount > 0) _depositOrbitLendingUSDB(usdbAmount);
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

    }

    /**
     * @notice Deposits WETH into Orbiter Lending.
     */
    function _depositOrbitLendingWETH(uint256 wethAmount) internal {

    }

    /**
     * @notice Deposits USDB into Orbiter Lending.
     */
    function _depositOrbitLendingUSDB(uint256 usdbAmount) internal {

    }

    /***************************************
    WITHDRAW FUNCTIONS
    ***************************************/

    function _withdrawBalance() internal {
        _withdrawThruster();
        _withdrawRingProtocol();
        _withdrawBlasterswap();
        _withdrawOrbitLendingWETH();
        _withdrawOrbitLendingUSDB();
    }

    function _withdrawThruster() internal {

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
            //if(IERC20(_ringLpToken).allowance(address(this), _ringSwapV2Router) < balance) IERC20(_ringLpToken).approve(_ringSwapV2Router, type(uint256).max);
            _checkApproval(_ringLpToken, _ringSwapV2Router, balance);
            console.log("in _withdrawRingProtocol() 7");
            IRingSwapV2Router(_ringSwapV2Router).removeLiquidity(_ringFwWeth, _ringFwUsdb, balance, 0, 0, address(this), type(uint256).max);
        }
    }

    function _withdrawBlasterswap() internal {

    }

    function _withdrawOrbitLendingWETH() internal {

    }

    function _withdrawOrbitLendingUSDB() internal {

    }

    function _checkApproval(address token, address recipient, uint256 minAmount) internal {
        if(IERC20(token).allowance(address(this), recipient) < minAmount) IERC20(token).approve(recipient, type(uint256).max);
    }

}
