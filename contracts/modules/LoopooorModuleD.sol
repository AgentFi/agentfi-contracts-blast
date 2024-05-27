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
// TODO:- Write interface
contract LoopooorModuleD is Blastable {
    /***************************************
    State
    ***************************************/
    bytes32 private constant LOOPOOR_MODULED_STORAGE_POSITION = keccak256("agentfi.storage.loopoormoduleD");

    struct LoopooorModuleDStorage {
        address wrapMint;
        address oToken;
        address variableRateContract;
        address fixedRateContract;
    }

    function loopooorModuleDStorage() internal pure returns (LoopooorModuleDStorage storage s) {
        bytes32 position_ = LOOPOOR_MODULED_STORAGE_POSITION;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            s.slot := position_
        }
    }

    /***************************************
    CONSTANTS
    ***************************************/

    address internal constant _weth = 0x4300000000000000000000000000000000000004; // wrapped eth
    address internal constant _usdb = 0x4300000000000000000000000000000000000003;

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

    function moduleName() external pure returns (string memory name_) {
        name_ = "LoopooorModuleD";
    }

    function strategyType() external pure returns (string memory type_) {
        type_ = "Loopooor";
    }

    function weth() external pure returns (address weth_) {
        weth_ = _weth;
    }
    function usdb() external pure returns (address usdb_) {
        usdb_ = _usdb;
    }

    function variableRateContract() public view returns (address) {
        return loopooorModuleDStorage().variableRateContract;
    }

    function fixedRateContract() public view returns (address) {
        return loopooorModuleDStorage().fixedRateContract;
    }

    function wrapMint() public view returns (address) {
        return loopooorModuleDStorage().wrapMint;
    }

    function oToken() public view returns (IOErc20Delegator) {
        return IOErc20Delegator(loopooorModuleDStorage().oToken);
    }

    function comptroller() public view returns (IOrbitSpaceStationV4) {
        address oToken_ = loopooorModuleDStorage().oToken;
        if (oToken_ == address(0)) {
            return IOrbitSpaceStationV4(address(0));
        }
        return IOrbitSpaceStationV4(IOErc20Delegator(oToken_).comptroller());
    }

    function duoAsset() public view returns (address) {
        address oToken_ = loopooorModuleDStorage().oToken;
        if (oToken_ == address(0)) {
            return address(0);
        }
        return IOErc20Delegator(oToken_).underlying();
    }

    /***************************************
    LOW LEVEL DUO MUTATOR FUNCTIONS
    ***************************************/

    function moduleD_mintFixedRate(
        address exchange,
        address token,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 minLockedYield,
        bytes memory data
    ) public returns (address fixedRateContract_, uint256 amountOut, uint256 lockedYield) {
        IWrapMintV2 wrapper = IWrapMintV2(wrapMint());

        SafeERC20.safeIncreaseAllowance(IERC20(token), address(wrapper), amountIn);
        (fixedRateContract_, amountOut, lockedYield) = wrapper.mintFixedRate(
            exchange,
            token,
            amountIn,
            amountOutMin,
            minLockedYield,
            data
        );

        // Save the variable rate contract address. Need this when burning
        LoopooorModuleDStorage storage state = loopooorModuleDStorage();
        state.fixedRateContract = fixedRateContract_;
    }

    function moduleD_mintFixedRateEth(
        address exchange,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 minLockedYield,
        bytes calldata data
    ) public payable returns (address fixedRateContract_, uint256 amountOut, uint256 lockedYield) {
        IWrapMintV2 wrapper = IWrapMintV2(wrapMint());

        (fixedRateContract_, amountOut, lockedYield) = wrapper.mintFixedRateEth{ value: amountIn }(
            exchange,
            amountIn,
            amountOutMin,
            minLockedYield,
            data
        );

        LoopooorModuleDStorage storage state = loopooorModuleDStorage();
        state.fixedRateContract = fixedRateContract_;
        // TODO:- Add refund (like underlying)
    }
    function moduleD_mintVariableRate(
        address exchange,
        address token,
        uint256 amountIn,
        uint256 amountOutMin,
        bytes memory data
    ) public returns (address variableRateContract_, uint256 amountOut) {
        IWrapMintV2 wrapper = IWrapMintV2(wrapMint());

        SafeERC20.safeIncreaseAllowance(IERC20(token), address(wrapper), amountIn);
        (variableRateContract_, amountOut) = wrapper.mintVariableRate(exchange, token, amountIn, amountOutMin, data);

        // Save the variable rate contract address. Need this when burning
        LoopooorModuleDStorage storage state = loopooorModuleDStorage();
        state.variableRateContract = variableRateContract_;
    }

    function moduleD_mintVariableRateEth(
        address exchange,
        uint256 amountIn,
        uint256 amountOutMin,
        bytes memory data
    ) public payable returns (address variableRateContract_, uint256 amountOut) {
        IWrapMintV2 wrapper = IWrapMintV2(wrapMint());

        (variableRateContract_, amountOut) = wrapper.mintVariableRateEth{ value: amountIn }(
            exchange,
            amountIn,
            amountOutMin,
            data
        );

        LoopooorModuleDStorage storage state = loopooorModuleDStorage();
        state.variableRateContract = variableRateContract_;
    }

    function moduleD_burnVariableRate(
        address variableRate,
        uint256 amount,
        uint256 minYield
    ) public returns (uint256 yieldToUnlock, uint256 yieldToRelease) {
        IWrapMintV2 wrapper = IWrapMintV2(wrapMint());
        // IWrapMintV2 wrapper = IWrapMintV2(0x7B4b51b482e874B3109ba618B0CA9cc1A75210dF);

        IERC20(duoAsset()).approve(wrapMint(), amount);
        return wrapper.burnVariableRate(variableRate, amount, minYield);
    }

    /***************************************
    LOW LEVEL ORBITER MUTATOR FUNCTIONS
    ***************************************/
    function moduleD_borrow(uint borrowAmount) public returns (uint) {
        return oToken().borrow(borrowAmount);
    }

    function moduleD_mint(uint mintAmount) public returns (uint) {
        IOErc20Delegator oToken_ = oToken();
        IERC20(duoAsset()).approve(address(oToken_), mintAmount);
        return oToken_.mint(mintAmount);
    }

    function moduleD_repayBorrow(uint repayAmount) public returns (uint) {
        IOErc20Delegator oToken_ = oToken();
        IERC20(duoAsset()).approve(address(oToken_), repayAmount);
        return oToken_.repayBorrow(repayAmount);
    }

    function moduleD_redeem(uint redeemTokens) public returns (uint) {
        IOErc20Delegator oToken_ = IOErc20Delegator(oToken());
        IERC20(address(oToken_)).approve(address(oToken_), redeemTokens);
        return oToken_.redeem(redeemTokens);
    }

    function moduleD_enterMarkets(address[] memory oTokens) public returns (uint[] memory) {
        return comptroller().enterMarkets(oTokens);
    }

    /***************************************
    HIGH LEVEL AGENT MUTATOR FUNCTIONS
    ***************************************/

    function moduleD_initialize(address wrapMint_, address oToken_) external {
        LoopooorModuleDStorage storage state = loopooorModuleDStorage();
        if (state.wrapMint != address(0) || state.oToken != address(0)) revert Errors.AlreadyInitialized();
        state.wrapMint = wrapMint_;
        state.oToken = oToken_;
    }

    function moduleD_enterMarket() public {
        address[] memory oTokens = new address[](1);
        oTokens[0] = address(oToken());
        moduleD_enterMarkets(oTokens);
    }

    function moduleD_depositBalance(uint256 leverage) external payable {
        moduleD_enterMarket();

        uint256 balance = address(this).balance;
        uint256 total = Math.mulDiv(balance, leverage, 10 ** 18);

        moduleD_mintVariableRateEth(address(0), balance, 0, new bytes(0));
        moduleD_mint(balance);
        total -= balance;

        uint256 price = IPriceOracle(comptroller().oracle()).getUnderlyingPrice(address(oToken()));
        while (total > 0) {
            // Get maximum USD we can borrow
            (, uint256 liquidity, ) = comptroller().getAccountLiquidity(address(this));

            // Convert this to underlying
            liquidity = Math.mulDiv(liquidity, 10 ** 18, price, Math.Rounding.Floor);

            // Borrow, and re-supply
            moduleD_borrow(Math.min(total, liquidity));
            balance = IERC20(address(duoAsset())).balanceOf(address(this));
            moduleD_mint(balance);

            total -= balance;
        }
    }

    function moduleD_withdrawBalance() external payable {
        IOErc20Delegator oToken_ = oToken();
        uint256 price = IPriceOracle(comptroller().oracle()).getUnderlyingPrice(address(oToken()));
        uint256 exchangeRate = oToken_.exchangeRateCurrent();
        (, uint256 collateralFactorMantissa, ) = comptroller().markets(address(oToken()));

        // While i have borrow, withdrawal maximum collateral and repay
        uint256 borrow = oToken_.borrowBalanceCurrent(address(this));
        while (borrow > 0) {
            // Get maximum USD we can borrow
            (, uint256 liquidity, ) = comptroller().getAccountLiquidity(address(this));

            // Get USD collateral we can withdraw
            liquidity = Math.mulDiv(liquidity, 10 ** 18, collateralFactorMantissa, Math.Rounding.Floor);

            // Convert this to underlying
            liquidity = Math.mulDiv(liquidity, 10 ** 18, price, Math.Rounding.Floor);

            // Covert underlying amount to oToken
            liquidity = Math.mulDiv(liquidity, 10 ** 18, exchangeRate, Math.Rounding.Floor);

            moduleD_redeem(liquidity);

            // Repay borrow
            uint256 balance = IERC20(duoAsset()).balanceOf(address(this));
            moduleD_repayBorrow(Math.min(balance, borrow));

            borrow = oToken_.borrowBalanceCurrent(address(this));
        }

        // Final withdrawal
        moduleD_redeem(oToken_.balanceOf(address(this)));

        // Burn
        moduleD_burnVariableRate(
            loopooorModuleDStorage().variableRateContract,
            IERC20(duoAsset()).balanceOf(address(this)),
            0
        );
    }

    function moduleD_withdrawBalanceTo(address receiver) external payable {
        _withdrawBalance();
        // withdraw usdb
        uint256 balance = IERC20(_usdb).balanceOf(address(this));
        if (balance > 0) SafeERC20.safeTransfer(IERC20(_usdb), receiver, balance);
        // unwrap weth
        balance = IERC20(_weth).balanceOf(address(this));
        if (balance > 0) IWETH(_weth).withdraw(balance);
        // transfer eth last
        balance = address(this).balance;
        if (balance > 0) Calls.sendValue(receiver, balance);
    }

    /***************************************
    DEPOSIT FUNCTIONS
    ***************************************/

    /**
     * @notice Deposits this contracts balance and loops.
     */
    function _depositBalance() internal {
        // wrap eth
        uint256 balance = address(this).balance;
        if (balance > 0) Calls.sendValue(_weth, balance);
        // deposit weth into deth
        balance = IERC20(_weth).balanceOf(address(this));
        if (balance > 0) {
            //_checkApproval(_weth, _deth, balance);
            // _deth.deposit()
        }
        // deposit deth
        // ?
        // deposit usdb into dusd
        balance = IERC20(_usdb).balanceOf(address(this));
        //if(balance > 0) // deposit into dusd
        // deposit dusd
        // ?
    }

    /***************************************
    WITHDRAW FUNCTIONS
    ***************************************/

    /**
     * @notice Withdraws from any loops.
     * Will attempt to withdraw all known tokens and hold the WETH and USDB in the TBA.
     */
    function _withdrawBalance() internal {
        //
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
