// SPDX-License-Identifier: none
pragma solidity 0.8.24;

// https://docs.blast.io/building/guides/weth-yield


/**
 * @title IBlastBridge
 */
interface IBlastBridge {

  function bridgeERC20(
      address localToken,
      address remoteToken,
      uint256 amount,
      uint32 minGasLimit,
      bytes calldata extraData
  ) external;

  function bridgeERC20To(
      address localToken,
      address remoteToken,
      address to,
      uint256 amount,
      uint32 minGasLimit,
      bytes calldata extraData
  ) external;
}
