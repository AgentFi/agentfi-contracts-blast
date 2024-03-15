// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { BlastooorAgentAccount } from "./BlastooorAgentAccount.sol";
import { IBlastooorAgentAccountRingProtocolD } from "./../interfaces/accounts/IBlastooorAgentAccountRingProtocolD.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IUniversalRouter } from "./../interfaces/external/RingProtocol/IUniversalRouter.sol";
import { IFewRouter } from "./../interfaces/external/RingProtocol/IFewRouter.sol";
import { IFixedStakingRewards } from "./../interfaces/external/RingProtocol/IFixedStakingRewards.sol";


/**
 * @title BlastooorAgentAccountRingProtocolD
 * @author AgentFi
 * @notice An account type used by agents. Integrates with Ring Protocol.
 */
contract BlastooorAgentAccountRingProtocolD is BlastooorAgentAccount, IBlastooorAgentAccountRingProtocolD {

    /***************************************
    CONSTANTS
    ***************************************/

    address internal constant universalRouter = 0x334e3F7f5A9740627fA47Fa9Aa51cE0ccbD765cF;
    address internal constant fewRouter       = 0x02F1e7A518e3E286C8E305E39cA7D4f25e0a44Aa;
    address internal constant stakingRewards  = 0x366Ac78214aFE145Ca35d4A6513F4eD9e8909Fe8;
    address internal constant weth            = 0x4200000000000000000000000000000000000023;

    address public tokenA;
    address public tokenB;
    address public fwtokenA;
    address public fwtokenB;
    address public lptoken;
    uint256 public stakingRewardsIndex;

    /// @dev Used for identifying cases when this contract's balance of a token is to be used as an input
    /// This value is equivalent to 1<<255, i.e. a singular 1 in the most significant bit.
    uint256 internal constant CONTRACT_BALANCE = 0x8000000000000000000000000000000000000000000000000000000000000000;


    /***************************************
    CONSTRUCTOR
    ***************************************/

    /**
     * @notice Constructs the BlastooorAgentAccount contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param governor_ The address of the gas governor.
     * @param blastPoints_ The address of the blast points contract.
     * @param pointsOperator_ The address of the blast points operator.
     * @param entryPoint_ The ERC-4337 EntryPoint address.
     * @param multicallForwarder The MulticallForwarder address.
     * @param erc6551Registry The ERC-6551 Registry address.
     * @param _guardian The AccountGuardian address.
     */
    constructor(
        address blast_,
        address governor_,
        address blastPoints_,
        address pointsOperator_,
        address entryPoint_,
        address multicallForwarder,
        address erc6551Registry,
        address _guardian
    ) BlastooorAgentAccount(blast_, governor_, blastPoints_, pointsOperator_, entryPoint_, multicallForwarder, erc6551Registry, _guardian) {}

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    function initialize(
        address tokenA_,
        address tokenB_,
        address fwtokenA_,
        address fwtokenB_,
        address lptoken_,
        uint256 stakingRewardsIndex_
    ) external payable {
        _beforeExecuteStrategy();
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
        _depositRingProtocolStrategyD();
    }

    /**
     * @notice Deposits tokens into Ring Protocol.
     * Can only be called by a valid executor or role owner for this TBA.
     */
    function depositRingProtocolStrategyD() external payable {
        _beforeExecuteStrategy();
        _depositRingProtocolStrategyD();
    }

    /**
     * @notice Withdraws tokens from Ring Protoocol.
     * Can only be called by a valid executor or role owner for this TBA.
     */
    function withdrawRingProtocolStrategyD() external payable {
        _beforeExecuteStrategy();
        _withdrawRingProtocolStrategyD();
    }

    /**
     * @notice Deposits tokens into Ring Protocol.
     * Deposits the tokens into the liquidity pool and stakes the LP token.
     * Will attempt to deposit this TBA's entire balance of each token.
     */
    function _depositRingProtocolStrategyD() internal {
        // optionally wrap weth
        address tknA = tokenA;
        address tknB = tokenB;
        {
        address weth_ = weth;
        if(tknA == weth_ || tknB == weth_) {
            uint256 ethAmount = address(this).balance;
            if(ethAmount > 0) Calls.sendValue(weth_, ethAmount);
        }
        }
        // get amounts
        uint256 tokenAAmount = IERC20(tknA).balanceOf(address(this));
        uint256 tokenBAmount = IERC20(tknB).balanceOf(address(this));
        if(tokenAAmount == 0 && tokenBAmount == 0) return; // exit if zero deposit

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
    }

    function _withdrawRingProtocolStrategyD() internal {
          // unstake lp token
          IFixedStakingRewards staking = IFixedStakingRewards(stakingRewards);
          uint256 index = stakingRewardsIndex;
          uint256 balance = staking.balanceOf(index, address(this));
          if(balance > 0) {
              staking.withdraw(index, balance);
          }
          // claim rewards
          balance = staking.earned(index, address(this));
          if(balance > 0) {
              staking.getReward(index);
          }
          // withdraw from pool
          address lptkn = lptoken;
          balance = IERC20(lptkn).balanceOf(address(this));
          if(balance > 0) {
              IFewRouter(fewRouter).removeLiquidity(fwtokenA, fwtokenB, balance, 0, 0, address(this), type(uint256).max);
          }
    }

    function _beforeExecuteStrategy() internal {
        _verifySenderIsValidExecutorOrHasRole(STRATEGY_MANAGER_ROLE);
        _verifyIsUnlocked();
        _updateState();
    }
}
