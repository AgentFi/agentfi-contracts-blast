// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { ILoopooorModuleD } from "./../interfaces/modules/ILoopooorModuleD.sol";
//import { IThrusterRouter } from "./../interfaces/external/Thruster/IThrusterRouter.sol";
//import { IHyperlockStaking } from "./../interfaces/external/Hyperlock/IHyperlockStaking.sol";
//import { IRingSwapV2Router } from "./../interfaces/external/RingProtocol/IRingSwapV2Router.sol";
//import { IFixedStakingRewards } from "./../interfaces/external/RingProtocol/IFixedStakingRewards.sol";
//import { IBlasterswapV2Router02 } from "./../interfaces/external/Blaster/IBlasterswapV2Router02.sol";
import { IWETH } from "./../interfaces/external/tokens/IWETH.sol";


/**
 * @title LoopooorModuleD
 * @author AgentFi
 * @notice A module used in the Loopooor strategy.
 *
 * Designed for use on Blast Mainnet only.
 */
contract LoopooorModuleD is Blastable, ILoopooorModuleD {

    /***************************************
    CONSTANTS
    ***************************************/

    // tokens

    address internal constant _weth                = 0x4300000000000000000000000000000000000004; // wrapped eth
    address internal constant _fwweth              = 0x66714DB8F3397c767d0A602458B5b4E3C0FE7dd1; // few wrapped wrapped eth
    address internal constant _deth                = 0x1Da40C742F32bBEe81694051c0eE07485fC630f6; // duo eth
    address internal constant _odeth               = 0xa3135b76c28b3971B703a5e6CD451531b187Eb5A; // orbit duo eth

    address internal constant _usdb                = 0x4300000000000000000000000000000000000003;

    address internal constant _wrapMintEth         = 0xD89dcC88AcFC6EF78Ef9602c2Bf006f0026695eF;

    // orbit
    // deth
    // dusd

    /***************************************
    CONSTRUCTOR
    ***************************************/

    /**
     * @notice Constructs the LoopooorModuleD contract.
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

    function moduleName() external pure override returns (string memory name_) {
        name_ = "LoopooorModuleD";
    }

    function strategyType() external pure override returns (string memory type_) {
        type_ = "Loopooor";
    }

    function weth() external pure override returns (address weth_) { weth_ = _weth; }
    function usdb() external pure override returns (address usdb_) { usdb_ = _usdb; }

    // todo

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    function moduleD_depositBalance(MintParams memory params) external payable override {
        _depositBalance();
    }

    function moduleD_withdrawBalance() external payable override {
        _withdrawBalance();
    }

    function moduleD_withdrawBalanceTo(address receiver) external payable override {
        _withdrawBalance();
        // withdraw usdb
        uint256 balance = IERC20(_usdb).balanceOf(address(this));
        if(balance > 0) SafeERC20.safeTransfer(IERC20(_usdb), receiver, balance);
        // unwrap weth
        balance = IERC20(_weth).balanceOf(address(this));
        if(balance > 0) IWETH(_weth).withdraw(balance);
        // transfer eth last
        balance = address(this).balance;
        if(balance > 0) Calls.sendValue(receiver, balance);
    }

    // partial withdraws?

    /***************************************
    DEPOSIT FUNCTIONS
    ***************************************/

    /**
     * @notice Deposits this contracts balance and loops.
     */
    function _depositBalance() internal {
        // wrap eth
        uint256 balance = address(this).balance;
        if(balance > 0) Calls.sendValue(_weth, balance);
        // deposit weth into deth
        balance = IERC20(_weth).balanceOf(address(this));
        if(balance > 0) {
            //_checkApproval(_weth, _deth, balance);
            // _deth.deposit()
        }
        // deposit deth
        // ?
        // deposit usdb into dusd
        balance = IERC20(_usdb).balanceOf(address(this));
        //if(balance > 0) // deposit into dusd
        // deposit dusd
        // ?
    }

    /***************************************
    WITHDRAW FUNCTIONS
    ***************************************/

    /**
     * @notice Withdraws from any loops.
     * Will attempt to withdraw all known tokens and hold the WETH and USDB in the TBA.
     */
    function _withdrawBalance() internal {
        //
    }

    /***************************************
    HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Checks the approval of an ERC20 token from this contract to another address.
     * @param token The token to check allowance.
     * @param recipient The address to give allowance to.
     * @param minAmount The minimum amount of the allowance.
     */
    function _checkApproval(address token, address recipient, uint256 minAmount) internal {
        // if current allowance is insufficient
        if(IERC20(token).allowance(address(this), recipient) < minAmount) {
            // set allowance to max
            SafeERC20.forceApprove(IERC20(token), recipient, type(uint256).max);
        }
    }
}
