// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
// code borrowed from blast:0xC3EcaDB7a5faB07c72af6BcFbD588b7818c4a40e


interface IHyperlockStaking {

    /* -------------------------------------------------------------------
    Storage
    ------------------------------------------------------------------- */

    /// @dev To force all locks to expire and enable withdrawals
    function forceExpireLocks() external view returns (bool forceExpire);
    /// @dev user => key => lock time
    function locks(address user, bytes32 key) external view returns (uint256 locktime);
    /// @dev lpToken => isProtected
    function isProtectedToken(address lptoken) external view returns (bool isProtected);

    /// @dev user => lptoken => amount
    function staked(address user, address lptoken) external view returns (uint256 amount);

    /* -------------------------------------------------------------------
    Events
    ------------------------------------------------------------------- */

    event SetForceExpireLocks(bool force);
    event LockedERC20(address sender, bytes32 lockKey, address lptoken);
    event Stake(address lpToken, address sender, uint256 amount);
    event Unstake(address lpToken, address sender, uint256 amount);

    /* -------------------------------------------------------------------
    ERC20 LP Tokens
    ------------------------------------------------------------------- */

    function stake(
        address _lpToken,
        uint256 _amount,
        uint256 _lock
    ) external;

    function unstake(address _lpToken, uint256 _amount) external;
}
