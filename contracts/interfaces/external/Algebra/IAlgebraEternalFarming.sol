// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;


interface IAlgebraEternalFarming {

    /// @param rewardToken The token being distributed as a reward (token0)
    /// @param bonusRewardToken The bonus token being distributed as a reward (token1)
    /// @param pool The Algebra pool
    /// @param nonce The nonce of incentive
    struct IncentiveKey {
        address rewardToken;
        address bonusRewardToken;
        address pool;
        uint256 nonce;
    }

    /// @notice Returns amounts of reward tokens owed to a given address according to the last time all farms were updated
    /// @param owner The owner for which the rewards owed are checked
    /// @param rewardToken The token for which to check rewards
    /// @return rewardsOwed The amount of the reward token claimable by the owner
    function rewards(address owner, address rewardToken) external view returns (uint256 rewardsOwed);

    /// @notice Calculates the reward amount that will be received for the given farm
    /// @param key The key of the incentive
    /// @param tokenId The ID of the token
    /// @return reward The reward accrued to the NFT for the given incentive thus far
    /// @return bonusReward The bonus reward accrued to the NFT for the given incentive thus far
    function getRewardInfo(IncentiveKey memory key, uint256 tokenId) external returns (uint256 reward, uint256 bonusReward);

}
