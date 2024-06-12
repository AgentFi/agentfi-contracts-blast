// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { BlastableLibrary } from "./../libraries/BlastableLibrary.sol";
import { Calls } from "./../libraries/Calls.sol";
import { DoubleEndedQueue } from "./../libraries/DoubleEndedQueueAddress.sol";
import { Errors } from "./../libraries/Errors.sol";
import { ILoopooorModuleF } from "./../interfaces/modules/ILoopooorModuleF.sol";
import { IPool } from "./../interfaces/external/AaveV3/IPool.sol";
import { IPoolAddressesProvider } from "./../interfaces/external/AaveV3/IPoolAddressesProvider.sol";
import { IVariableDebtToken } from "./../interfaces/external/AaveV3/IVariableDebtToken.sol";
import { IPriceOracle } from "./../interfaces/external/AaveV3/IPriceOracle.sol";
import { DataTypes } from "./../interfaces/external/AaveV3/DataTypes.sol";
import { ReserveConfiguration } from "./../interfaces/external/AaveV3/ReserveConfiguration.sol";
import { IWrapMintV2 } from "./../interfaces/external/Duo/IWrapMintV2.sol";
import { IRateContract } from "./../interfaces/external/Duo/IRateContract.sol";
import { IPacPoolWrapper } from "./../interfaces/external/PacFinance/IPacPoolWrapper.sol";
import { IWETH } from "./../interfaces/external/tokens/IWETH.sol";

/**
 * @title LoopooorModuleF
 * @author AgentFi
 * @notice A module used in the Loopooor strategy.
 *
 * Designed for use on Blast Mainnet only.
 */

contract LoopooorModuleF is Blastable, ILoopooorModuleF {
    using ReserveConfiguration for DataTypes.ReserveConfigurationMap;

    /***************************************
    CONSTANTS
    ***************************************/

    uint256 internal constant PRECISION_LTV = 10 ** 4; // Precision of ltv on aave
    uint256 internal constant PRECISION_LEVERAGE = 10 ** 18; // Precision of leverage input (10 ** 18 = 1x leverage)
    uint256 internal constant PRECISION_PRICE = 10 ** 18; // Precision of price of duo asset

    address internal constant _eth = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address internal constant _weth = 0x4300000000000000000000000000000000000004; // wrapped eth
    address internal constant _poolWrapper = 0xfDe98aB7a6602ad55462297D952CE25b58743140;

    /***************************************
    STATE
    ***************************************/
    bytes32 private constant LOOPOOR_MODULED_STORAGE_POSITION = keccak256("agentfi.storage.loopoormoduleF");

    struct LoopooorModuleFStorage {
        address borrow; // Fixed or variable storage contract
        address underlying;
        address wrapMint;
        MODE mode;
        DoubleEndedQueue.AddressDeque queue;
    }

    function loopooorModuleFStorage() internal pure returns (LoopooorModuleFStorage storage s) {
        bytes32 position_ = LOOPOOR_MODULED_STORAGE_POSITION;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            s.slot := position_
        }
    }

    /***************************************
    CONSTRUCTOR
    ***************************************/

    /**
     * @notice Constructs the LoopooorModuleD contract.
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
    ) Blastable(blast_, gasCollector_, blastPoints_, pointsOperator_) {}

    /***************************************
    VIEW FUNCTIONS
    ***************************************/
    function aToken() public view returns (address) {
        return pool().getReserveData(address(duoAsset())).aTokenAddress;
    }

    function borrow() public view returns (address) {
        return loopooorModuleFStorage().borrow;
    }

    function borrowBalance() public view returns (uint256) {
        if (borrow() == address(0)) {
            return 0;
        }
        return IERC20(variableDebtToken()).balanceOf(address(this));
    }

    function duoAsset() public view returns (IERC20) {
        address wrapMint_ = wrapMint();
        if (wrapMint_ == address(0)) {
            return IERC20(address(0));
        }
        return IERC20(IWrapMintV2(wrapMint_).duoAssetToken());
    }

    function leverage() public view returns (uint256) {
        uint256 supply_ = supplyBalance();
        uint256 borrow_ = borrowBalance();
        if (supply_ == 0) {
            return 0;
        }
        return Math.mulDiv(supply_, PRECISION_LEVERAGE, supply_ - borrow_);
    }

    function mode() public view returns (MODE) {
        return loopooorModuleFStorage().mode;
    }

    function moduleName() external pure returns (string memory name_) {
        name_ = "LoopooorModuleF";
    }

    function oracle() public view returns (IPriceOracle) {
        IPoolAddressesProvider registry = IPoolAddressesProvider(poolWrapper().ADDRESSES_PROVIDER());
        return IPriceOracle(registry.getPriceOracle());
    }

    function pool() public view returns (IPool) {
        return IPool(IPacPoolWrapper(_poolWrapper).POOL());
    }

    function poolWrapper() public pure returns (IPacPoolWrapper) {
        return IPacPoolWrapper(_poolWrapper);
    }

    function _quoteBalanceWithRevert() external {
        uint256 balance = moduleF_withdrawBalance();
        revert Errors.RevertForAmount(balance);
    }

    /**
     * @notice Returns the balance in underlying asset of the contract.
     * @dev Should be a view function, but requires on state change and revert
     */
    function quoteBalance() external returns (uint256 balance) {
        try LoopooorModuleF(payable(address(this)))._quoteBalanceWithRevert() {} catch (bytes memory reason) {
            balance = BlastableLibrary.parseRevertReasonForAmount(reason);
        }
    }

    function rateContracts() public view returns (address[] memory contracts) {
        DoubleEndedQueue.AddressDeque storage queue = loopooorModuleFStorage().queue;

        contracts = new address[](DoubleEndedQueue.length(queue));
        for (uint256 i = 0; i < contracts.length; i++) {
            contracts[i] = DoubleEndedQueue.at(queue, i);
        }
    }

    function strategyType() external pure returns (string memory type_) {
        type_ = "Loopooor";
    }

    function supplyBalance() public view returns (uint256) {
        if (wrapMint() == address(0)) {
            return 0;
        }
        return IERC20(aToken()).balanceOf(address(this));
    }

    function underlying() public view returns (address) {
        return loopooorModuleFStorage().underlying;
    }

    function variableDebtToken() public view returns (address) {
        return pool().getReserveData(borrow()).variableDebtTokenAddress;
    }

    function wrapMint() public view returns (address) {
        return loopooorModuleFStorage().wrapMint;
    }

    /***************************************
    LOW LEVEL DUO MUTATOR FUNCTIONS
    ***************************************/
    function moduleF_mintFixedRate(
        address wrapMint_,
        address exchange,
        address token,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 minLockedYield,
        bytes memory data
    ) public payable returns (address fixedRateContract_, uint256 amountOut, uint256 lockedYield) {
        IWrapMintV2 wrapper = IWrapMintV2(wrapMint_);

        _checkApproval(token, address(wrapper), amountIn);
        (fixedRateContract_, amountOut, lockedYield) = wrapper.mintFixedRate(
            exchange,
            token,
            amountIn,
            amountOutMin,
            minLockedYield,
            data
        );
    }

    function moduleF_mintFixedRateEth(
        address wrapMint_,
        address exchange,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 minLockedYield,
        bytes calldata data
    ) public payable returns (address fixedRateContract_, uint256 amountOut, uint256 lockedYield) {
        IWrapMintV2 wrapper = IWrapMintV2(wrapMint_);

        (fixedRateContract_, amountOut, lockedYield) = wrapper.mintFixedRateEth{ value: amountIn }(
            exchange,
            amountIn,
            amountOutMin,
            minLockedYield,
            data
        );
    }

    function moduleF_mintVariableRate(
        address wrapMint_,
        address exchange,
        address token,
        uint256 amountIn,
        uint256 amountOutMin,
        bytes memory data
    ) public payable returns (address variableRateContract_, uint256 amountOut) {
        IWrapMintV2 wrapper = IWrapMintV2(wrapMint_);

        _checkApproval(token, address(wrapper), amountIn);
        (variableRateContract_, amountOut) = wrapper.mintVariableRate(exchange, token, amountIn, amountOutMin, data);
    }

    function moduleF_mintVariableRateEth(
        address wrapMint_,
        address exchange,
        uint256 amountIn,
        uint256 amountOutMin,
        bytes memory data
    ) public payable returns (address variableRateContract_, uint256 amountOut) {
        IWrapMintV2 wrapper = IWrapMintV2(wrapMint_);

        (variableRateContract_, amountOut) = wrapper.mintVariableRateEth{ value: amountIn }(
            exchange,
            amountIn,
            amountOutMin,
            data
        );
    }

    function moduleF_burnVariableRate(
        address wrapMint_,
        address variableRate,
        uint256 amount,
        uint256 minYield
    ) public payable returns (uint256 yieldToUnlock, uint256 yieldToRelease) {
        _checkApproval(address(duoAsset()), wrapMint_, amount);

        (yieldToUnlock, yieldToRelease) = IWrapMintV2(wrapMint_).burnVariableRate(variableRate, amount, minYield);
    }

    function moduleF_burnFixedRate(
        address wrapMint_,
        address fixedRate,
        uint256 amount
    ) public payable returns (uint256 yieldToUnlock, uint256 yieldToRelease) {
        _checkApproval(address(duoAsset()), wrapMint_, amount);
        (yieldToUnlock, yieldToRelease) = IWrapMintV2(wrapMint_).burnFixedRate(fixedRate, amount);
    }

    /***************************************
    LOW LEVEL PAC FINANCE MUTATOR FUNCTIONS
    ***************************************/
    function moduleF_supplyERC20(address asset, uint256 amount, address onBehalfOf) public {
        _checkApproval(asset, _poolWrapper, amount);
        IPacPoolWrapper(_poolWrapper).supplyERC20(asset, amount, onBehalfOf);
    }

    function moduleF_withdrawERC20(address asset, uint256 amount, address to) public {
        _checkApproval(aToken(), _poolWrapper, amount);
        IPacPoolWrapper(_poolWrapper).withdrawERC20(asset, amount, to);
    }

    function moduleF_borrowERC20(address asset, uint256 amount, uint256 interestRateMode) public {
        IPacPoolWrapper(_poolWrapper).borrowERC20(asset, amount, interestRateMode);
    }

    function moduleF_repayERC20(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) public {
        _checkApproval(asset, _poolWrapper, amount);
        IPacPoolWrapper(_poolWrapper).repayERC20(asset, amount, interestRateMode, onBehalfOf);
    }

    /***************************************
    HIGH LEVEL AGENT MUTATOR FUNCTIONS
    ***************************************/
    /// @notice Converts balance to DuoAsset
    function mintDuoAsset() internal {
        LoopooorModuleFStorage storage state = loopooorModuleFStorage();

        if (state.mode == MODE.DIRECT) {
            return;
        }

        address underlying_ = state.underlying;
        if (underlying_ == _eth) {
            underlying_ = _weth;
        }

        uint256 balance = IERC20(underlying_).balanceOf(address(this));
        if (balance == 0) {
            return;
        }

        address contract_;
        if (state.mode == MODE.FIXED_RATE) {
            (contract_, , ) = moduleF_mintFixedRate(
                state.wrapMint,
                address(0),
                underlying_,
                balance,
                0,
                0,
                new bytes(0)
            );
        }

        if (state.mode == MODE.VARIABLE_RATE) {
            (contract_, ) = moduleF_mintVariableRate(state.wrapMint, address(0), underlying_, balance, 0, new bytes(0));
        }

        DoubleEndedQueue.pushBack(state.queue, contract_);
    }

    /// @notice Burns all of the DuoAsset balance of the contract.
    function burnDuoAsset() internal {
        LoopooorModuleFStorage storage state = loopooorModuleFStorage();

        if (state.mode == MODE.DIRECT) {
            return;
        }

        IERC20 duoAsset_ = duoAsset();
        uint256 balance = IERC20(duoAsset_).balanceOf(address(this));

        while (balance > 0 && DoubleEndedQueue.length(state.queue) > 0) {
            address contract_ = DoubleEndedQueue.back(state.queue);

            uint256 principal = IRateContract(contract_).principal();
            uint256 amount = Math.min(balance, principal);

            if (state.mode == MODE.FIXED_RATE) {
                moduleF_burnFixedRate(state.wrapMint, contract_, amount);
            }

            if (state.mode == MODE.VARIABLE_RATE) {
                moduleF_burnVariableRate(state.wrapMint, contract_, amount, 0);
            }

            // If there is no more principal, remove the contract from the queue.
            if (IRateContract(contract_).principal() == 0) {
                DoubleEndedQueue.popBack(state.queue);
            }

            balance = IERC20(duoAsset_).balanceOf(address(this));
        }
    }

    function moduleF_depositBalance(
        address wrapMint_,
        address borrow_,
        address underlying_,
        MODE mode_,
        uint256 leverage_
    ) public payable {
        LoopooorModuleFStorage storage state = loopooorModuleFStorage();

        if (supplyBalance() > 0) {
            moduleF_withdrawBalance();
        }

        state.borrow = borrow_;
        state.mode = mode_;
        state.underlying = underlying_;
        state.wrapMint = wrapMint_;

        // Wrap ETH into WETH.
        if (underlying_ == _eth) {
            Calls.sendValue(_weth, address(this).balance);
            underlying_ = _weth;
        }

        // Allow the pool wrapper to borrow from the borrow contract.
        IVariableDebtToken(variableDebtToken()).approveDelegation(_poolWrapper, type(uint256).max);

        mintDuoAsset();

        IERC20 duoAsset_ = duoAsset();
        uint256 balance = duoAsset_.balanceOf(address(this));
        uint256 total = Math.mulDiv(balance, leverage_, PRECISION_LEVERAGE);

        // Do first deposit
        moduleF_supplyERC20(address(duoAsset_), balance, address(this));
        total -= balance;

        // Perform borrow + supply loop until target total is reached.
        uint256 price = oracle().getAssetPrice(borrow_);
        while (total > 0) {
            (, , uint256 amount, , , ) = pool().getUserAccountData(address(this));

            // Borrow as much as possible
            amount = Math.mulDiv(amount, PRECISION_PRICE, price, Math.Rounding.Floor);
            amount = Math.min(total, amount);
            moduleF_borrowERC20(borrow_, amount, 2);

            mintDuoAsset();

            balance = duoAsset_.balanceOf(address(this));
            moduleF_supplyERC20(address(duoAsset_), balance, address(this));

            total -= amount;
        }
    }

    function moduleF_withdrawBalance() public payable returns (uint256 amount_) {
        LoopooorModuleFStorage storage state = loopooorModuleFStorage();

        IERC20 variableDebtToken_ = IERC20(variableDebtToken());
        address duoAsset_ = address(duoAsset());

        uint256 price = oracle().getAssetPrice(duoAsset_);
        (uint256 ltv, , , , , ) = pool().getConfiguration(duoAsset_).getParams();

        (, uint256 borrowed, uint256 amount, , , ) = pool().getUserAccountData(address(this));
        while (borrowed > 0) {
            // Withdraw max by calculating USD collateral we can withdraw, and convert to underlying
            amount = Math.mulDiv(amount, PRECISION_LTV, ltv, Math.Rounding.Floor);
            amount = Math.mulDiv(amount, PRECISION_PRICE, price, Math.Rounding.Floor);
            moduleF_withdrawERC20(duoAsset_, amount, address(this));

            // Don't burn if i need to repay duo asset
            if (duoAsset_ != state.borrow) {
                burnDuoAsset();
            }

            // Repay as much as possible
            uint256 balance = IERC20(state.borrow).balanceOf(address(this));
            balance = Math.min(balance, variableDebtToken_.balanceOf(address(this)));
            moduleF_repayERC20(state.borrow, balance, 2, address(this));

            (, borrowed, amount, , , ) = pool().getUserAccountData(address(this));
        }

        // Final withdrawal
        moduleF_withdrawERC20(duoAsset_, IERC20(aToken()).balanceOf(address(this)), address(this));

        // Burn
        burnDuoAsset();

        // Unwrap if necesary
        if (underlying() == _eth) {
            amount_ = IERC20(_weth).balanceOf(address(this));
            IWETH(_weth).withdraw(amount_);
        } else {
            amount_ = IERC20(state.underlying).balanceOf(address(this));
        }
    }

    function moduleF_withdrawBalanceTo(address receiver) external payable {
        moduleF_withdrawBalance();
        moduleF_sendBalanceTo(receiver, underlying());
        moduleF_sendBalanceTo(receiver, address(duoAsset())); // Leaves some dust in some condifitions
    }

    // Send funds to reciever
    function moduleF_sendBalanceTo(address receiver, address token) public payable {
        if (token == _eth) {
            Calls.sendValue(receiver, address(this).balance);
        } else {
            SafeERC20.safeTransfer(IERC20(token), receiver, IERC20(token).balanceOf(address(this)));
        }
    }

    function moduleF_sendAmountTo(address receiver, address token, uint256 amount) public payable {
        if (token == _eth) {
            Calls.sendValue(receiver, amount);
        } else {
            SafeERC20.safeTransfer(IERC20(token), receiver, amount);
        }
    }

    function moduleF_increaseWithBalance() public payable {
        LoopooorModuleFStorage storage state = loopooorModuleFStorage();
        uint256 leverage_ = leverage();

        moduleF_withdrawBalance();

        moduleF_depositBalance(state.wrapMint, state.borrow, state.underlying, state.mode, leverage_);
    }

    function moduleF_partialWithdrawTo(address receiver, uint256 amount) external {
        LoopooorModuleFStorage storage state = loopooorModuleFStorage();
        uint256 leverage_ = leverage();

        moduleF_withdrawBalance();

        moduleF_sendAmountTo(receiver, state.underlying, amount);

        moduleF_depositBalance(state.wrapMint, state.borrow, state.underlying, state.mode, leverage_);
    }

    /***************************************
    HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Checks the approval of an ERC20 token from this contract to another address.
     * @param token The token to check allowance.
     * @param recipient The address to give allowance to.
     * @param minAmount The minimum amount of the allowance.
     */
    function _checkApproval(address token, address recipient, uint256 minAmount) internal {
        // if current allowance is insufficient
        if (IERC20(token).allowance(address(this), recipient) < minAmount) {
            // set allowance to max
            SafeERC20.forceApprove(IERC20(token), recipient, type(uint256).max);
        }
    }
}
