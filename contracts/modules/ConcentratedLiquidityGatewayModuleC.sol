// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Calls } from "./../libraries/Calls.sol";
import { ConcentratedLiquidityModuleC } from "./ConcentratedLiquidityModuleC.sol";

/**
 * @title ConcentratedLiquidityGatewayModuleC
 * @author AgentFi
 * @notice A module used in the Concentrated liquidity strategy.
 *
 * Designed for use on Blast Mainnet only.
 */
// ! Need to be careful of signature collisions
interface IWETH {
    function transferFrom(address src, address dst, uint wad) external returns (bool);
    function withdraw(uint wad) external;
}

contract ConcentratedLiquidityGatewayModuleC is ConcentratedLiquidityModuleC {
    address internal constant _weth = 0x4300000000000000000000000000000000000004;

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
    ) ConcentratedLiquidityModuleC(blast_, gasCollector_, blastPoints_, pointsOperator_) {}

    function moduleC_depositBalance(int24 tickLower, int24 tickUpper) public payable override {
        uint256 ethAmount = address(this).balance;
        if (ethAmount > 0) {
            Calls.sendValue(_weth, ethAmount);
        }
        super.moduleC_depositBalance(tickLower, tickUpper);
    }

    function moduleC_increaseLiquidity() public override {
        uint256 ethAmount = address(this).balance;
        if (ethAmount > 0) {
            Calls.sendValue(_weth, ethAmount);
        }
        super.moduleC_increaseLiquidity();
    }

    function _sendBalanceTo(address receiver) internal override {
        uint256 balance = IERC20(_weth).balanceOf(address(this));
        if (balance > 0) {
            IWETH(_weth).withdraw(balance);
            Calls.sendValue(receiver, balance);
        }

        super._sendBalanceTo(receiver);
    }
}
