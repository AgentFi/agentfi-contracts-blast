// SPDX-License-Identifier: none
pragma solidity 0.8.24;
// code borrowed from blast:0xEff87A51f5Abd015F1AFCD5737BBab450eA15A24

/**
 * @title IFixedStakingRewards
 * @notice
 */
interface IFixedStakingRewards {
      // Views
      function WETH() external pure returns (address);

      function fewFactory() external pure returns (address);

      function rewardsToken() external view returns (address);

      function rewardSetter() external view returns (address);

      function stakingInfoCount() external view returns (uint256);

      function rewardPerTokenPerSecond(uint256 index) external view returns (uint256);

      function totalSupply(uint256 index) external view returns (uint256);

      function periodFinish(uint256 index) external view returns (uint256);

      function lastTimeRewardApplicable(uint256 index) external view returns (uint256);

      function lastUpdateTimeOf(uint256 index, address account) external view returns (uint256);

      function balanceOf(uint256 index, address account) external view returns (uint256);

      function rewardOf(uint256 index, address account) external view returns (uint256);

      function earned(uint256 index, address account) external view returns (uint256);

      // Mutative

      function stakeWithPermit(uint256 index, uint256 amount, uint deadline, uint8 v, bytes32 r, bytes32 s) external;

      function stake(uint256 index, uint256 amount) external;

      function stakeETH(uint256 index) external payable;

      function withdraw(uint256 index, uint256 amount) external;

      function withdrawETH(uint256 index, uint256 amount) external;

      function getReward(uint256 index) external;

      function exit(uint256 index) external;

      function updateRewardFor(uint256 index, address account) external;

      function deploy(address stakingToken, uint256 _rewardPerTokenPerSecond, uint256 _periodFinish) external returns (uint256);

      function setRewardPerTokenPerSecond(uint256 index, uint256 _rewardPerTokenPerSecond) external;

      function setPeriodFinish(uint256 index, uint256 _periodFinish) external;

      function setRewardSetter(address _rewardSetter) external;

      event StakingCreated(uint256 index, address stakingToken, address indexed user, uint256 _rewardPerTokenPerSecond, uint256 _periodFinish);
      event Staked(uint256 index, address stakingToken, address indexed user, uint256 amount);
      event Withdrawn(uint256 index, address stakingToken, address indexed user, uint256 amount);
      event RewardPaid(uint256 index, address stakingToken, address indexed user, uint256 reward);
      event SetRewardPerTokenPerSecond(uint256 index, address stakingToken, address indexed user, uint256 _rewardPerTokenPerSecond);
      event SetPeriodFinish(uint256 index, address stakingToken, address indexed user, uint256 _periodFinish);
      event SetRewardSetter(address indexed rewardSetter, address _rewardSetter);
  }
