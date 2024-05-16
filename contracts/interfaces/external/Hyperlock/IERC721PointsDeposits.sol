// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
// Source https://blastscan.io/address/0xc28effdfef75448243c1d9ba972b97e32df60d06#contracts

import { INonfungiblePositionManager } from "../Thruster/INonfungiblePositionManager.sol";

interface IERC721PointsDeposits {
    /* -------------------------------------------------------------------
    Storage
    ------------------------------------------------------------------- */

    function nfps(address _address, uint256 _id) external view returns (bool);

    /* -------------------------------------------------------------------
    Events
    ------------------------------------------------------------------- */

    event LockedERC721(address sender, bytes32 lockKey, uint256 tokenId);
    event Deposit(address pool, address sender, uint256 tokenId);
    event Withdraw(address pool, address sender, uint256 tokenId);

    /* -------------------------------------------------------------------
    NFT LP Tokens
    ------------------------------------------------------------------- */

    function withdraw(uint256 _tokenId) external;

    /* --------------------------------------------------------------
    NFT LP Tokens: Manage Liquidity 
    -------------------------------------------------------------- */
    function decreaseLiquidity(INonfungiblePositionManager.DecreaseLiquidityParams memory params) external ;

    function collect(INonfungiblePositionManager.CollectParams memory params) external returns (uint256, uint256);
}
