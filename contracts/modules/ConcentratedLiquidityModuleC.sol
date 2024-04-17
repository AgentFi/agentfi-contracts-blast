// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { Calls } from "./../libraries/Calls.sol";
import { INonfungiblePositionManager } from "./../interfaces/external/Thruster/INonfungiblePositionManager.sol";


/**
 * @title ConcentratedLiquidityModuleC
 * @author AgentFi
 * @notice A module used in the Concentrated liquidity strategy.
 *
 * Designed for use on Blast Mainnet only.
 */
contract ConcentratedLiquidityModuleC is Blastable {

    /***************************************
    CONSTANTS
    ***************************************/

    // tokens

    address internal constant _weth                = 0x4300000000000000000000000000000000000004;
    address internal constant _usdb                = 0x4300000000000000000000000000000000000003;

    // thruster
    address internal constant _thrusterManager     = 0x434575EaEa081b735C985FA9bf63CD7b87e227F9;

    // Config
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

    function weth() external pure returns (address weth_) { weth_ = _weth; }
    function usdb() external pure returns (address usdb_) { usdb_ = _usdb; }

    function thrusterManager() external pure returns (address thrusterManager_) { thrusterManager_ = _thrusterManager; }

    function tokenId() external view returns (uint256 tokenId_) { tokenId_ = _tokenId; }

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    function moduleC_depositBalance() external payable {
        _depositBalance();
    }

    function moduleC_withdrawBalance() external payable {
        _withdrawBalance();
    }

    function moduleC_withdrawBalanceTo(address receiver) external payable {
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
    function _depositBalance() internal returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) {
        {
        uint256 ethAmount = address(this).balance;
        if(ethAmount > 0) Calls.sendValue(_weth, ethAmount);
        }
        uint256 wethAmount = IERC20(_weth).balanceOf(address(this));
        uint256 usdbAmount = IERC20(_usdb).balanceOf(address(this));

        INonfungiblePositionManager thruster = INonfungiblePositionManager (_thrusterManager);
        
        _checkApproval(_weth, _thrusterManager, wethAmount);
        _checkApproval(_usdb, _thrusterManager, usdbAmount);
         

        (tokenId, liquidity, amount0, amount1) = thruster.mint(INonfungiblePositionManager.MintParams({
            token0: _usdb,
            token1: _weth,
            fee: fee,
            tickLower: -120000,
            tickUpper: 120000,
            amount0Desired: usdbAmount,
            amount1Desired: wethAmount,
            amount0Min: 0,
            amount1Min: 0,
            recipient: address(this),
            deadline: block.timestamp
        }));
        _tokenId = tokenId;
    }

    /***************************************
    WITHDRAW FUNCTIONS
    ***************************************/

    function _withdrawBalance() internal {
    }


    function _checkApproval(address token, address recipient, uint256 minAmount) internal {
        if(IERC20(token).allowance(address(this), recipient) < minAmount) IERC20(token).approve(recipient, type(uint256).max);
    }
}
