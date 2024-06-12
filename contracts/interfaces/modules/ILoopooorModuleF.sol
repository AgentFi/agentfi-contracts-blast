// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IPool } from "./../external/AaveV3/IPool.sol";
import { IPriceOracle } from "./../external/AaveV3/IPriceOracle.sol";
import { IWrapMintV2 } from "./../external/Duo/IWrapMintV2.sol";
import { IRateContract } from "./../external/Duo/IRateContract.sol";
import { IOErc20Delegator } from "./../external/Orbit/IOErc20Delegator.sol";
import { IOrbitSpaceStationV4 } from "./../external/Orbit/IOrbitSpaceStationV4.sol";
import { IPacPoolWrapper } from "./../external/PacFinance/IPacPoolWrapper.sol";
import { IWETH } from "./../external/tokens/IWETH.sol";

/**
 * @title ILoopooorModuleF
 * @author AgentFi
 * @notice Interface for the LoopooorModuleF contract.
 */
interface ILoopooorModuleF {
    /***************************************
    ENUMS
    ***************************************/

    enum MODE {
        DIRECT, // Direct
        FIXED_RATE, // Mint Fixed Rate
        VARIABLE_RATE // Mint Variable Rate
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the address of the aToken for the DuoAsset.
     * @return The address of the aToken.
     */
    function aToken() external view returns (address);

    /**
     * @notice Returns the address of the borrow contract.
     * @return The address of the borrow contract.
     */
    function borrow() external view returns (address);

    /**
     * @notice Returns the balance of the borrowed asset.
     * @return The balance of the borrowed asset.
     */
    function borrowBalance() external view returns (uint256);

    /**
     * @notice Returns the DuoAsset token contract.
     * @return The DuoAsset token contract.
     */
    function duoAsset() external view returns (IERC20);

    /**
     * @notice Returns the current leverage of the strategy.
     * @return The current leverage.
     */
    function leverage() external view returns (uint256);

    /**
     * @notice Returns the current mode of the strategy.
     * @return The current mode.
     */
    function mode() external view returns (MODE);

    /**
     * @notice Returns the name of the module.
     * @return The name of the module.
     */
    function moduleName() external pure returns (string memory);

    /**
     * @notice Returns the price oracle contract.
     * @return The price oracle contract.
     */
    function oracle() external view returns (IPriceOracle);

    /**
     * @notice Returns the Aave pool contract.
     * @return The Aave pool contract.
     */
    function pool() external view returns (IPool);

    /**
     * @notice Returns the PacPoolWrapper contract.
     * @return The PacPoolWrapper contract.
     */
    function poolWrapper() external pure returns (IPacPoolWrapper);

    /**
     * @notice Returns the balance of the contract in the underlying asset.
     * @return The balance of the contract in the underlying asset.
     */
    function quoteBalance() external returns (uint256);

    /**
     * @notice Returns an array of rate contract addresses.
     * @return An array of rate contract addresses.
     */
    function rateContracts() external view returns (address[] memory);

    /**
     * @notice Returns the strategy type.
     * @return The strategy type.
     */
    function strategyType() external pure returns (string memory);

    /**
     * @notice Returns the balance of the supplied asset.
     * @return The balance of the supplied asset.
     */
    function supplyBalance() external view returns (uint256);

    /**
     * @notice Returns the address of the underlying asset.
     * @return The address of the underlying asset.
     */
    function underlying() external view returns (address);

    /**
     * @notice Returns the address of the variable debt token.
     * @return The address of the variable debt token.
     */
    function variableDebtToken() external view returns (address);

    /**
     * @notice Returns the address of the WrapMint contract.
     * @return The address of the WrapMint contract.
     */
    function wrapMint() external view returns (address);

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Mints a fixed rate DuoAsset contract.
     * @param wrapMint_ The address of the WrapMint contract.
     * @param exchange The address of the exchange contract.
     * @param token The address of the token to be minted.
     * @param amountIn The amount of the token to be minted.
     * @param amountOutMin The minimum amount of DuoAsset to be minted.
     * @param minLockedYield The minimum locked yield.
     * @param data Additional data for the mint operation.
     * @return fixedRateContract_ The address of the fixed rate contract.
     * @return amountOut The amount of DuoAsset minted.
     * @return lockedYield The locked yield.
     */
    function moduleF_mintFixedRate(
        address wrapMint_,
        address exchange,
        address token,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 minLockedYield,
        bytes memory data
    )
        external
        payable
        returns (
            address fixedRateContract_,
            uint256 amountOut,
            uint256 lockedYield
        );

    /**
     * @notice Mints a fixed rate DuoAsset contract using ETH.
     * @param wrapMint_ The address of the WrapMint contract.
     * @param exchange The address of the exchange contract.
     * @param amountIn The amount of ETH to be minted.
     * @param amountOutMin The minimum amount of DuoAsset to be minted.
     * @param minLockedYield The minimum locked yield.
     * @param data Additional data for the mint operation.
     * @return fixedRateContract_ The address of the fixed rate contract.
     * @return amountOut The amount of DuoAsset minted.
     * @return lockedYield The locked yield.
     */
    function moduleF_mintFixedRateEth(
        address wrapMint_,
        address exchange,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 minLockedYield,
        bytes calldata data
    )
        external
        payable
        returns (
            address fixedRateContract_,
            uint256 amountOut,
            uint256 lockedYield
        );

    /**
     * @notice Mints a variable rate DuoAsset contract.
     * @param wrapMint_ The address of the WrapMint contract.
     * @param exchange The address of the exchange contract.
     * @param token The address of the token to be minted.
     * @param amountIn The amount of the token to be minted.
     * @param amountOutMin The minimum amount of DuoAsset to be minted.
     * @param data Additional data for the mint operation.
     * @return variableRateContract_ The address of the variable rate contract.
     * @return amountOut The amount of DuoAsset minted.
     */
    function moduleF_mintVariableRate(
        address wrapMint_,
        address exchange,
        address token,
        uint256 amountIn,
        uint256 amountOutMin,
        bytes memory data
    )
        external
        payable
        returns (address variableRateContract_, uint256 amountOut);

    /**
     * @notice Mints a variable rate DuoAsset contract using ETH.
     * @param wrapMint_ The address of the WrapMint contract.
     * @param exchange The address of the exchange contract.
     * @param amountIn The amount of ETH to be minted.
     * @param amountOutMin The minimum amount of DuoAsset to be minted.
     * @param data Additional data for the mint operation.
     * @return variableRateContract_ The address of the variable rate contract.
     * @return amountOut The amount of DuoAsset minted.
     */
    function moduleF_mintVariableRateEth(
        address wrapMint_,
        address exchange,
        uint256 amountIn,
        uint256 amountOutMin,
        bytes memory data
    )
        external
        payable
        returns (address variableRateContract_, uint256 amountOut);

    /**
     * @notice Burns a variable rate DuoAsset contract.
     * @param wrapMint_ The address of the WrapMint contract.
     * @param variableRate The address of the variable rate contract.
     * @param amount The amount of DuoAsset to be burned.
     * @param minYield The minimum yield to be unlocked.
     * @return yieldToUnlock The amount of yield to be unlocked.
     * @return yieldToRelease The amount of yield to be released.
     */
    function moduleF_burnVariableRate(
        address wrapMint_,
        address variableRate,
        uint256 amount,
        uint256 minYield
    )
        external
        payable
        returns (uint256 yieldToUnlock, uint256 yieldToRelease);

    /**
     * @notice Burns a fixed rate DuoAsset contract.
     * @param wrapMint_ The address of the WrapMint contract.
     * @param fixedRate The address of the fixed rate contract.
     * @param amount The amount of DuoAsset to be burned.
     * @return yieldToUnlock The amount of yield to be unlocked.
     * @return yieldToRelease The amount of yield to be released.
     */
    function moduleF_burnFixedRate(
        address wrapMint_,
        address fixedRate,
        uint256 amount
    ) external payable returns (uint256 yieldToUnlock, uint256 yieldToRelease);

    /**
     * @notice Supplies an ERC20 token to the Aave pool.
     * @param asset The address of the asset to be supplied.
     * @param amount The amount of the asset to be supplied.
     * @param onBehalfOf The address to supply the asset on behalf of.
     */
    function moduleF_supplyERC20(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) external;

    /**
     * @notice Withdraws an ERC20 token from the Aave pool.
     * @param asset The address of the asset to be withdrawn.
     * @param amount The amount of the asset to be withdrawn.
     * @param to The address to receive the withdrawn asset.
     */
    function moduleF_withdrawERC20(
        address asset,
        uint256 amount,
        address to
    ) external;

    /**
     * @notice Borrows an ERC20 token from the Aave pool.
     * @param asset The address of the asset to be borrowed.
     * @param amount The amount of the asset to be borrowed.
     * @param interestRateMode The interest rate mode for the borrow (1 for stable, 2 for variable).
     */
    function moduleF_borrowERC20(
        address asset,
        uint256 amount,
        uint256 interestRateMode
    ) external;

    /**
     * @notice Repays an ERC20 token to the Aave pool.
     * @param asset The address of the asset to be repaid.
     * @param amount The amount of the asset to be repaid.
     * @param interestRateMode The interest rate mode for the repay (1 for stable, 2 for variable).
     * @param onBehalfOf The address to repay the asset on behalf of.
     */
    function moduleF_repayERC20(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external;

    /**
     * @notice Deposits the balance of the contract into the Aave pool.
     * @param wrapMint_ The address of the WrapMint contract.
     * @param borrow_ The address of the borrow asset.
     * @param underlying_ The address of the underlying asset.
     * @param mode_ The mode of the strategy (direct, fixed rate, or variable rate).
     * @param leverage_ The leverage to be used.
     */
    function moduleF_depositBalance(
        address wrapMint_,
        address borrow_,
        address underlying_,
        MODE mode_,
        uint256 leverage_
    ) external payable;

    /**
     * @notice Withdraws the balance of the contract from the Aave pool.
     * @return amount_ The amount of the underlying asset withdrawn.
     */
    function moduleF_withdrawBalance() external payable returns (uint256 amount_);

    /**
     * @notice Withdraws the balance of the contract from the Aave pool and sends it to a receiver.
     * @param receiver The address to receive the withdrawn balance.
     */
    function moduleF_withdrawBalanceTo(address receiver) external payable;

    /**
     * @notice Sends the balance of a token to a receiver.
     * @param receiver The address to receive the token balance.
     * @param token The address of the token.
     */
    function moduleF_sendBalanceTo(address receiver, address token) external payable;

    /**
     * @notice Sends an amount of a token to a receiver.
     * @param receiver The address to receive the token amount.
     * @param token The address of the token.
     * @param amount The amount of the token to be sent.
     */
    function moduleF_sendAmountTo(
        address receiver,
        address token,
        uint256 amount
    ) external payable;

    /**
     * @notice Increases the balance of the contract in the Aave pool with the current balance.
     */
    function moduleF_increaseWithBalance() external payable;

    /**
     * @notice Partially withdraws an amount of the underlying asset to a receiver and deposits the remaining balance into the Aave pool.
     * @param receiver The address to receive the withdrawn amount.
     * @param amount The amount of the underlying asset to be withdrawn.
     */
    function moduleF_partialWithdrawTo(address receiver, uint256 amount) external;
}