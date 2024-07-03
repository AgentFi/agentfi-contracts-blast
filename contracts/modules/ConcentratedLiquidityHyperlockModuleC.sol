// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IERC721PointsDeposits } from "./../interfaces/external/Hyperlock/IERC721PointsDeposits.sol";
import { INonfungiblePositionManager } from "./../interfaces/external/Thruster/INonfungiblePositionManager.sol";
import { Errors } from "./../libraries/Errors.sol";
import { FixedPoint128 } from "./../libraries/FixedPoint128.sol";
import { ConcentratedLiquidityGatewayModuleC } from "./ConcentratedLiquidityGatewayModuleC.sol";
import { IConcentratedLiquidityHyperlockModuleC } from "./../interfaces/modules/IConcentratedLiquidityHyperlockModuleC.sol";

/**
 * @title ConcentratedLiquidityHyperlockModuleC
 * @author AgentFi
 * @notice A module used in the Concentrated liquidity strategy.
 *
 * Designed for use on Blast Mainnet only.
 */

contract ConcentratedLiquidityHyperlockModuleC is ConcentratedLiquidityGatewayModuleC, IConcentratedLiquidityHyperlockModuleC {
    address internal constant _hyperlockStaking = 0xc28EffdfEF75448243c1d9bA972b97e32dF60d06;
    address internal constant _thrusterManager = 0x434575EaEa081b735C985FA9bf63CD7b87e227F9;

    /**
     * @notice Constructs the ConcentratedLiquidityHyperlockModuleC contract.
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
    ) ConcentratedLiquidityGatewayModuleC(blast_, gasCollector_, blastPoints_, pointsOperator_) {}

    /***************************************
    VIEW FUNCTIONS
    ***************************************/
    function hyperlockStaking() external pure override returns (address hyperlockStaking_) {
        hyperlockStaking_ = _hyperlockStaking;
    }

    function manager() public pure override returns (address manager_) {
        manager_ = _thrusterManager;
    }

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/
    function moduleC_mint(
        MintParams memory params
    ) public payable override returns (uint256 tokenId_, uint128 liquidity, uint256 amount0, uint256 amount1) {
        if (params.manager != _thrusterManager) revert Errors.InvalidManagerParam();

        (tokenId_, liquidity, amount0, amount1) = super.moduleC_mint(params);

        // Transfer position to hyperlock for staking
        IERC721(_thrusterManager).safeTransferFrom(address(this), _hyperlockStaking, tokenId_);
    }

    function moduleC_decreaseLiquidity(
        DecreaseLiquidityParams memory params
    ) public payable override returns (uint256, uint256) {
        uint256 tokenId_ = tokenId();
        if (tokenId_ == 0) revert Errors.NoPositionFound();

        // Hyperlock has no return, so calculate amount0, amount1 ourselves
        (
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            uint128 liq,
            uint256 feeGrowth0Start,
            uint256 feeGrowth1Start,
            uint256 amount0Start,
            uint256 amount1Start
        ) = position();

        IERC721PointsDeposits staker_ = IERC721PointsDeposits(_hyperlockStaking);
        staker_.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId_,
                liquidity: params.liquidity,
                amount0Min: params.amount0Min,
                amount1Min: params.amount1Min,
                deadline: params.deadline
            })
        );

        (, , , , , , , , uint256 feeGrowth0, uint256 feeGrowth1, uint256 amount0, uint256 amount1) = position();

        amount0 -= amount0Start - Math.mulDiv(feeGrowth0 - feeGrowth0Start, liq, FixedPoint128.Q128);
        amount1 -= amount1Start - Math.mulDiv(feeGrowth1 - feeGrowth1Start, liq, FixedPoint128.Q128);

        return (amount0, amount1);
    }

    function moduleC_collect(
        CollectParams memory params
    ) public payable override returns (uint256 amount0, uint256 amount1) {
        uint256 tokenId_ = tokenId();
        if (tokenId_ == 0) revert Errors.NoPositionFound();

        IERC721PointsDeposits staker_ = IERC721PointsDeposits(_hyperlockStaking);
        (amount0, amount1) = staker_.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId_,
                recipient: address(this),
                amount0Max: params.amount0Max,
                amount1Max: params.amount1Max
            })
        );
    }

    function moduleC_burn() public payable override {
        uint256 tokenId_ = tokenId();
        if (tokenId_ == 0) revert Errors.NoPositionFound();

        // Withdraw NFT back to contract before burning
        IERC721PointsDeposits staker_ = IERC721PointsDeposits(_hyperlockStaking);
        staker_.withdraw(tokenId_);

        super.moduleC_burn();
    }
}
