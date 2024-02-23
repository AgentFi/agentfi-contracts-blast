// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IFixedStakingRewards
 * @notice
 */
interface IFixedStakingRewards {

    /* ========== VIEWS ========== */

    function rewardPerTokenPerSecond(uint256 index) external view returns (uint256);

    function totalSupply(uint256 index) external view returns (uint256);

    function periodFinish(uint256 index) external view returns (uint256);

    function lastTimeRewardApplicable(uint256 index) external view returns (uint256);

    function lastUpdateTimeOf(uint256 index, address account) external view returns (uint256);

    function balanceOf(uint256 index, address account) external view returns (uint256);

    function rewardOf(uint256 index, address account) external view returns (uint256);

    function earned(uint256 index, address account) external view returns (uint256);

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stakeWithPermit(uint256 index, uint256 amount, uint deadline, uint8 v, bytes32 r, bytes32 s) external;

    function stake(uint256 index, uint256 amount) external;

    function stakeETH(uint256 index) external payable;

    function withdraw(uint256 index, uint256 amount) external;

    function withdrawETH(uint256 index, uint256 amount) external;

    function getReward(uint256 index) external;

    function exit(uint256 index) external;

    function updateRewardFor(uint256 index, address account) external;
  }
