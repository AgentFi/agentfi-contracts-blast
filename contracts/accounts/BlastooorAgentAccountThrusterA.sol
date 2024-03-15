// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { BlastooorAgentAccount } from "./BlastooorAgentAccount.sol";
//import { IBlastooorAgentAccountThrusterA } from "./../interfaces/accounts/IBlastooorAgentAccountThrusterA.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { ISwapRouter } from "./../interfaces/external/Thruster/ISwapRouter.sol";
import { INonfungiblePositionManager } from "./../interfaces/external/Thruster/INonfungiblePositionManager.sol";


/**
 * @title BlastooorAgentAccountThrusterA
 * @author AgentFi
 * @notice An account type used by agents. Integrates with Thruster.
 */
contract BlastooorAgentAccountThrusterA is BlastooorAgentAccount /*, IBlastooorAgentAccountThrusterA */{

    /***************************************
    CONSTANTS
    ***************************************/

    address internal constant swapRouter      = 0xE4690BD7A9cFc681A209443BCE31aB943F9a9459;
    address internal constant positionManager = 0x46Eb7Cff688ea0defCB75056ca209d7A2039fDa8;
    address internal constant factory         = 0xe05c310A68F0D3A30069A20cB6fAeD5612C70c88;
    address internal constant weth            = 0x4200000000000000000000000000000000000023;

    address public token0;
    address public token1;

    uint256 public tokenId;


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
        address tokenA,
        address tokenB
    ) external payable {
        _beforeExecuteStrategy();
        if(token0 != address(0)) revert Errors.AlreadyInitialized();
        if (tokenA > tokenB) (tokenA, tokenB) = (tokenB, tokenA);
        token0 = tokenA;
        token1 = tokenB;
        address router = swapRouter;
        IERC20(tokenA).approve(router, type(uint256).max);
        IERC20(tokenB).approve(router, type(uint256).max);
        router = positionManager;
        IERC20(tokenA).approve(router, type(uint256).max);
        IERC20(tokenB).approve(router, type(uint256).max);
        _depositThrusterA();
    }

    /**
     * @notice Deposits tokens into Thruster.
     * Can only be called by a valid executor or role owner for this TBA.
     */
    function depositThrusterA() external payable {
        _beforeExecuteStrategy();
        _depositThrusterA();
    }

    /**
     * @notice Withdraws tokens from Ring Protoocol.
     * Can only be called by a valid executor or role owner for this TBA.
     */
    function withdrawThrusterA() external payable {
        _beforeExecuteStrategy();
        _withdrawThrusterA();
    }

    /**
     * @notice Deposits tokens into Thruster.
     * Deposits the tokens into the liquidity pool and returns the LP token.
     * Will attempt to deposit this TBA's entire balance of each token.
     */
    function _depositThrusterA() internal {
        address tokenA = token0;
        address tokenB = token1;
        // optionally wrap weth
        {
        address weth_ = weth;
        if(tokenA == weth_ || tokenB == weth_) {
            uint256 ethAmount = address(this).balance;
            if(ethAmount > 0) Calls.sendValue(weth_, ethAmount);
        }
        }
        // get amounts
        uint256 tokenAAmount = IERC20(tokenA).balanceOf(address(this));
        uint256 tokenBAmount = IERC20(tokenB).balanceOf(address(this));
        if(tokenAAmount == 0 && tokenBAmount == 0) return; // exit if zero deposit
        ISwapRouter router = ISwapRouter(swapRouter);
        // rebalance
        if(tokenAAmount == 0 || tokenBAmount == 0) {
            // if excess tokenA, swap half for tokenB
            if(tokenAAmount > 0) {
                router.exactInputSingle(ISwapRouter.ExactInputSingleParams({
                    tokenIn: tokenA,
                    tokenOut: tokenB,
                    fee: 3000,
                    recipient: address(this),
                    deadline: type(uint256).max,
                    amountIn: tokenAAmount/2,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                }));
            }
            // if excess tokenB, swap half for tokenA
            else if(tokenBAmount > 0) {
                router.exactInputSingle(ISwapRouter.ExactInputSingleParams({
                    tokenIn: tokenB,
                    tokenOut: tokenA,
                    fee: 3000,
                    recipient: address(this),
                    deadline: type(uint256).max,
                    amountIn: tokenBAmount/2,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                }));
            }
            // get amounts
            tokenAAmount = IERC20(tokenA).balanceOf(address(this));
            tokenBAmount = IERC20(tokenB).balanceOf(address(this));
            if(tokenAAmount == 0 && tokenBAmount == 0) return; // exit if zero deposit
        }
        // deposit
        uint256 tokenid = tokenId;
        // mint new position if none
        if(tokenid == 0) {
            (tokenid, , , ) = INonfungiblePositionManager(positionManager).mint(
                INonfungiblePositionManager.MintParams({
                    token0: tokenA,
                    token1: tokenB,
                    fee: 3000,
                    tickLower: -887220,
                    tickUpper: 887220,
                    amount0Desired: tokenAAmount,
                    amount1Desired: tokenBAmount,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: address(this),
                    deadline: type(uint256).max
                })
            );
            tokenId = tokenid;
        }
        // deposit into existing position
        else {
            INonfungiblePositionManager(positionManager).increaseLiquidity(
                INonfungiblePositionManager.IncreaseLiquidityParams({
                    tokenId: tokenid,
                    amount0Desired: tokenAAmount,
                    amount1Desired: tokenBAmount,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: type(uint256).max
                })
            );
        }
    }

    function _withdrawThrusterA() internal {
    }

    function _beforeExecuteStrategy() internal {
        _verifySenderIsValidExecutorOrHasRole(STRATEGY_MANAGER_ROLE);
        _verifyIsUnlocked();
        _updateState();
    }
}
