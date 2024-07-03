// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;


interface IFarmingCenter {

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

    /// @notice Enters in incentive (eternal farming) with NFT-position token
    /// @dev msg.sender must be the owner of NFT
    /// @param key The incentive key
    /// @param tokenId The id of position NFT
    function enterFarming(IncentiveKey memory key, uint256 tokenId) external;

    /// @notice Exits from incentive (eternal farming) with NFT-position token
    /// @dev msg.sender must be the owner of NFT
    /// @param key The incentive key
    /// @param tokenId The id of position NFT
    function exitFarming(IncentiveKey memory key, uint256 tokenId) external;

    /// @notice Used to collect reward from eternal farming. Then reward can be claimed.
    /// @param key The incentive key
    /// @param tokenId The id of position NFT
    /// @return reward The amount of collected reward
    /// @return bonusReward The amount of collected  bonus reward
    function collectRewards(IncentiveKey memory key, uint256 tokenId) external returns (uint256 reward, uint256 bonusReward);

    /// @notice Used to claim and send rewards from farming(s)
    /// @dev can be used via static call to get current rewards for user
    /// @param rewardToken The token that is a reward
    /// @param to The address to be rewarded
    /// @param amountRequested Amount to claim in eternal farming
    /// @return rewardBalanceBefore The total amount of unclaimed reward *before* claim
    function claimReward(address rewardToken, address to, uint256 amountRequested) external returns (uint256 rewardBalanceBefore);

    /// @notice Returns information about a deposited NFT
    /// @param tokenId The ID of the deposit (and token) that is being transferred
    /// @return eternalIncentiveId The id of eternal incentive that is active for this NFT
    function deposits(uint256 tokenId) external view returns (bytes32 eternalIncentiveId);

}
