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

    function moduleC_mintBalance(MintBalanceParams memory params) public payable override {
        uint256 ethAmount = address(this).balance;
        if (ethAmount > 0) {
            Calls.sendValue(_weth, ethAmount);
        }
        super.moduleC_mintBalance(params);
    }

    function moduleC_increaseLiquidityWithBalance(uint24 slippage) public override returns (uint128, uint256, uint256) {
        uint256 ethAmount = address(this).balance;
        if (ethAmount > 0) {
            Calls.sendValue(_weth, ethAmount);
        }
        return super.moduleC_increaseLiquidityWithBalance(slippage);
    }

    /// @notice Collect tokens owned in position, sending funds to the receiver
    function moduleC_collectTo(address receiver) external override {
        (, , address token0, address token1, , , , , , , , ) = position();
        address[] memory tokens = new address[](2);
        tokens[0] = token0;
        tokens[1] = token1;

        // Cannot send directly to receiver as we need to unwrap WETH to ETH
        moduleC_collect(CollectParams({ amount0Max: type(uint128).max, amount1Max: type(uint128).max }));
        moduleC_sendBalanceTo(receiver, tokens);
    }

    function moduleC_sendBalanceTo(address receiver, address[] memory tokens) public override {
        uint256 balance = IERC20(_weth).balanceOf(address(this));
        if (balance > 0) {
            IWETH(_weth).withdraw(balance);
            Calls.sendValue(receiver, balance);
        }

        super.moduleC_sendBalanceTo(receiver, tokens);
    }
}
