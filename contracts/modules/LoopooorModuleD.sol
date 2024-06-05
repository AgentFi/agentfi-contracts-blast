// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { ILoopooorModuleD } from "./../interfaces/modules/ILoopooorModuleD.sol";
import { IWrapMintV2 } from "./../interfaces/external/Duo/IWrapMintV2.sol";
import { IOErc20Delegator } from "./../interfaces/external/Orbit/IOErc20Delegator.sol";
import { IPriceOracle } from "./../interfaces/external/Orbit/IPriceOracle.sol";
import { IOrbitSpaceStationV4 } from "./../interfaces/external/Orbit/IOrbitSpaceStationV4.sol";
import { IWETH } from "./../interfaces/external/tokens/IWETH.sol";


/**
 * @title LoopooorModuleD
 * @author AgentFi
 * @notice A module used in the Loopooor strategy.
 *
 * Designed for use on Blast Mainnet only.
 */

contract LoopooorModuleD is Blastable, ILoopooorModuleD {
    /***************************************
    CONSTANTS
    ***************************************/

    uint256 internal constant PRECISION_CF = 10 ** 18; // Precision of collatral factor from orbit
    uint256 internal constant PRECISION_LEVERAGE = 10 ** 18; // Precision of leverage input (10 ** 18 = 1x leverage)
    uint256 internal constant PRECISION_EXCHANGE_RATE = 10 ** 18; // Precision of exchange rate between oToken and duo asset
    uint256 internal constant PRECISION_PRICE = 10 ** 18; // Precision of price of duo asset

    address internal constant _eth = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address internal constant _weth = 0x4300000000000000000000000000000000000004; // wrapped eth

    /***************************************
    STATE
    ***************************************/
    bytes32 private constant LOOPOOR_MODULED_STORAGE_POSITION = keccak256("agentfi.storage.loopoormoduleD");

    struct LoopooorModuleDStorage {
        address oToken;
        address rateContract; // Fixed or variable storage contract
        address underlying;
        address wrapMint;
        MODE mode;
    }

    function loopooorModuleDStorage() internal pure returns (LoopooorModuleDStorage storage s) {
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

    function moduleName() external pure override returns (string memory name_) {
        name_ = "LoopooorModuleD";
    }

    function strategyType() external pure override returns (string memory type_) {
        type_ = "Loopooor";
    }

    function eth() external pure override returns (address) {
        return _eth;
    }

    function weth() external pure override returns (address) {
        return _weth;
    }

    function mode() public view override returns (MODE) {
        return loopooorModuleDStorage().mode;
    }

    function rateContract() public view override returns (address) {
        return loopooorModuleDStorage().rateContract;
    }

    function underlying() public view override returns (address) {
        return loopooorModuleDStorage().underlying;
    }

    function wrapMint() public view override returns (address) {
        return loopooorModuleDStorage().wrapMint;
    }

    function oToken() public view override returns (IOErc20Delegator) {
        return IOErc20Delegator(loopooorModuleDStorage().oToken);
    }

    function comptroller() public view override returns (IOrbitSpaceStationV4) {
        return getComptroller(address(oToken()));
    }

    function duoAsset() public view override returns (IERC20) {
        return getDuoAssetFromOToken(address(oToken()));
    }

    function supplyBalance() public view override returns (uint256 supply_) {
        IOErc20Delegator oToken_ = oToken();
        if (address(oToken_) == address(0)) {
            return 0;
        }

        uint256 exchangeRate = oToken_.exchangeRateStored();

        supply_ = oToken_.balanceOf(address(this));
        supply_ = Math.mulDiv(supply_, exchangeRate, PRECISION_EXCHANGE_RATE);
    }

    function borrowBalance() public view override returns (uint256 borrow_) {
        IOErc20Delegator oToken_ = oToken();
        if (address(oToken_) == address(0)) {
            return 0;
        }

        borrow_ = oToken_.borrowBalanceStored(address(this));
    }

    function getComptroller(address oToken_) internal view returns (IOrbitSpaceStationV4) {
        if (oToken_ == address(0)) {
            return IOrbitSpaceStationV4(address(0));
        }
        return IOrbitSpaceStationV4(IOErc20Delegator(oToken_).comptroller());
    }

    function getDuoAssetFromOToken(address oToken_) internal view returns (IERC20) {
        if (oToken_ == address(0)) {
            return IERC20(address(0));
        }
        return IERC20(IOErc20Delegator(oToken_).underlying());
    }

    function getDuoAssetFromWrapMint(address wrapMint_) internal view returns (IERC20) {
        if (wrapMint_ == address(0)) {
            return IERC20(address(0));
        }
        return IERC20(IWrapMintV2(wrapMint_).duoAssetToken());
    }

    /***************************************
    LOW LEVEL DUO MUTATOR FUNCTIONS
    ***************************************/
    function moduleD_mintFixedRate(
        address wrapMint_,
        address exchange,
        address token,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 minLockedYield,
        bytes memory data
    ) public payable override returns (address fixedRateContract_, uint256 amountOut, uint256 lockedYield) {
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

    function moduleD_mintFixedRateEth(
        address wrapMint_,
        address exchange,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 minLockedYield,
        bytes calldata data
    ) public payable override returns (address fixedRateContract_, uint256 amountOut, uint256 lockedYield) {
        IWrapMintV2 wrapper = IWrapMintV2(wrapMint_);

        (fixedRateContract_, amountOut, lockedYield) = wrapper.mintFixedRateEth{ value: amountIn }(
            exchange,
            amountIn,
            amountOutMin,
            minLockedYield,
            data
        );
    }

    function moduleD_mintVariableRate(
        address wrapMint_,
        address exchange,
        address token,
        uint256 amountIn,
        uint256 amountOutMin,
        bytes memory data
    ) public payable override returns (address variableRateContract_, uint256 amountOut) {
        IWrapMintV2 wrapper = IWrapMintV2(wrapMint_);

        _checkApproval(token, address(wrapper), amountIn);
        (variableRateContract_, amountOut) = wrapper.mintVariableRate(exchange, token, amountIn, amountOutMin, data);
    }

    function moduleD_mintVariableRateEth(
        address wrapMint_,
        address exchange,
        uint256 amountIn,
        uint256 amountOutMin,
        bytes memory data
    ) public payable override returns (address variableRateContract_, uint256 amountOut) {
        IWrapMintV2 wrapper = IWrapMintV2(wrapMint_);

        (variableRateContract_, amountOut) = wrapper.mintVariableRateEth{ value: amountIn }(
            exchange,
            amountIn,
            amountOutMin,
            data
        );
    }

    function moduleD_burnVariableRate(
        address wrapMint_,
        address variableRate,
        uint256 amount,
        uint256 minYield
    ) public payable override returns (uint256 yieldToUnlock, uint256 yieldToRelease) {
        _checkApproval(address(getDuoAssetFromWrapMint(wrapMint_)), wrapMint_, amount);

        (yieldToUnlock, yieldToRelease) = IWrapMintV2(wrapMint_).burnVariableRate(variableRate, amount, minYield);
    }

    function moduleD_burnFixedRate(
        address wrapMint_,
        address fixedRate,
        uint256 amount
    ) public payable override returns (uint256 yieldToUnlock, uint256 yieldToRelease) {
        _checkApproval(address(getDuoAssetFromWrapMint(wrapMint_)), wrapMint_, amount);
        (yieldToUnlock, yieldToRelease) = IWrapMintV2(wrapMint_).burnFixedRate(fixedRate, amount);
    }

    /***************************************
    LOW LEVEL ORBITER MUTATOR FUNCTIONS
    ***************************************/
    function moduleD_borrow(address oToken_, uint borrowAmount) public payable override returns (uint) {
        return IOErc20Delegator(oToken_).borrow(borrowAmount);
    }

    function moduleD_mint(address oToken_, uint mintAmount) public payable override returns (uint) {
        _checkApproval(address(getDuoAssetFromOToken(oToken_)), oToken_, mintAmount);
        return IOErc20Delegator(oToken_).mint(mintAmount);
    }

    function moduleD_repayBorrow(address oToken_, uint repayAmount) public payable override returns (uint) {
        _checkApproval(address(getDuoAssetFromOToken(oToken_)), oToken_, repayAmount);

        return IOErc20Delegator(oToken_).repayBorrow(repayAmount);
    }

    function moduleD_redeem(address oToken_, uint redeemTokens) public payable override returns (uint) {
        _checkApproval(oToken_, oToken_, redeemTokens);

        return IOErc20Delegator(oToken_).redeem(redeemTokens);
    }

    function moduleD_enterMarkets(address comptroller_, address[] memory oTokens) public payable override returns (uint[] memory) {
        return IOrbitSpaceStationV4(comptroller_).enterMarkets(oTokens);
    }

    /***************************************
    HIGH LEVEL AGENT MUTATOR FUNCTIONS
    ***************************************/
    function moduleD_claim() internal {
        comptroller().claimOrb(address(this));
    }

    function moduleD_enterMarket() internal {
        address[] memory oTokens = new address[](1);
        oTokens[0] = address(oToken());
        moduleD_enterMarkets(address(comptroller()), oTokens);
    }

    function moduleD_depositBalance(
        address wrapMint_,
        address oToken_,
        address underlying_,
        MODE mode_,
        uint256 leverage
    ) external payable override {
        LoopooorModuleDStorage storage state = loopooorModuleDStorage();

        if (state.rateContract != address(0)) {
            revert Errors.PositionAlreadyExists();
        }

        state.mode = mode_;
        state.oToken = oToken_;
        state.underlying = underlying_;
        state.wrapMint = wrapMint_;

        moduleD_enterMarket();

        if (underlying_ == _eth) {
            Calls.sendValue(_weth, address(this).balance);
            underlying_ = _weth;
        }

        uint256 balance = IERC20(underlying_).balanceOf(address(this));
        uint256 total = Math.mulDiv(balance, leverage, PRECISION_LEVERAGE);

        if (mode_ == MODE.FIXED_RATE) {
            (address fixedRateContract_, , ) = moduleD_mintFixedRate(
                wrapMint_,
                address(0),
                underlying_,
                balance,
                0,
                0,
                new bytes(0)
            );
            state.rateContract = fixedRateContract_;
        }
        if (mode_ == MODE.VARIABLE_RATE) {
            (address variableRateContract_, ) = moduleD_mintVariableRate(
                wrapMint_,
                address(0),
                underlying_,
                balance,
                0,
                new bytes(0)
            );
            state.rateContract = variableRateContract_;
        }

        moduleD_mint(oToken_, balance);
        total -= balance;

        uint256 price = IPriceOracle(comptroller().oracle()).getUnderlyingPrice(address(oToken()));
        while (total > 0) {
            // Get maximum USD we can borrow
            (, uint256 liquidity, ) = comptroller().getAccountLiquidity(address(this));

            // Convert this to underlying
            liquidity = Math.mulDiv(liquidity, PRECISION_PRICE, price, Math.Rounding.Floor);

            // Borrow, and re-supply
            moduleD_borrow(oToken_, Math.min(total, liquidity));
            balance = duoAsset().balanceOf(address(this));
            moduleD_mint(oToken_, balance);

            total -= balance;
        }
    }

    function moduleD_withdrawBalance() public payable override {
        LoopooorModuleDStorage storage state = loopooorModuleDStorage();

        IOErc20Delegator oToken_ = IOErc20Delegator(state.oToken);
        IERC20 duoAsset_ = duoAsset();
        IOrbitSpaceStationV4 comptroller_ = comptroller();

        uint256 exchangeRate = oToken_.exchangeRateCurrent();
        uint256 price = IPriceOracle(comptroller_.oracle()).getUnderlyingPrice(address(oToken()));
        (, uint256 collateralFactorMantissa, ) = comptroller_.markets(address(oToken()));

        // While i have borrow, withdrawal maximum collateral and repay
        uint256 borrow = oToken_.borrowBalanceCurrent(address(this));
        while (borrow > 0) {
            // Get maximum USD we can borrow
            (, uint256 liquidity, ) = comptroller_.getAccountLiquidity(address(this));

            // Get USD collateral we can withdraw
            liquidity = Math.mulDiv(liquidity, PRECISION_CF, collateralFactorMantissa, Math.Rounding.Floor);

            // Convert this to underlying
            liquidity = Math.mulDiv(liquidity, PRECISION_PRICE, price, Math.Rounding.Floor);

            // Covert underlying amount to oToken
            liquidity = Math.mulDiv(liquidity, PRECISION_EXCHANGE_RATE, exchangeRate, Math.Rounding.Floor);

            moduleD_redeem(state.oToken, liquidity);

            // Repay borrow
            uint256 balance = duoAsset_.balanceOf(address(this));
            moduleD_repayBorrow(state.oToken, Math.min(balance, borrow));

            borrow = oToken_.borrowBalanceCurrent(address(this));
        }

        // Final withdrawal
        moduleD_redeem(state.oToken, oToken_.balanceOf(address(this)));

        // Burn
        if (state.mode == MODE.FIXED_RATE) {
            moduleD_burnFixedRate(state.wrapMint, state.rateContract, duoAsset_.balanceOf(address(this)));
        }
        if (state.mode == MODE.VARIABLE_RATE) {
            moduleD_burnVariableRate(state.wrapMint, state.rateContract, duoAsset_.balanceOf(address(this)), 0);
        }
        state.rateContract = address(0);

        // Unwrap if necesary
        if (underlying() == _eth) {
            uint256 balance = IERC20(_weth).balanceOf(address(this));
            IWETH(_weth).withdraw(balance);
        }

        // claim orbit token
        moduleD_claim();
    }

    function moduleD_withdrawBalanceTo(address receiver) external payable override {
        moduleD_withdrawBalance();
        moduleD_sendBalanceTo(receiver, underlying());
        // Send any orbit.
        moduleD_sendBalanceTo(receiver, comptroller().getTokenAddress());
    }

    // Send funds to reciever
    function moduleD_sendBalanceTo(address receiver, address token) public payable override {
        if (token == _eth) {
            Calls.sendValue(receiver, address(this).balance);
        } else {
            SafeERC20.safeTransfer(IERC20(token), receiver, IERC20(token).balanceOf(address(this)));
        }
    }

    function moduleD_claimTo(address receiver) public {
        // Claim all orbs first
        moduleD_claim();

        // Send balance. Note in the event comptroller is empty, might not get full claim
        moduleD_sendBalanceTo(receiver, comptroller().getTokenAddress());
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
        if(IERC20(token).allowance(address(this), recipient) < minAmount) {
            // set allowance to max
            SafeERC20.forceApprove(IERC20(token), recipient, type(uint256).max);
        }
    }
}
