// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { MockERC20 } from "./MockERC20.sol";
import { Multicall } from "./../../utils/Multicall.sol";


/**
 * @title MockERC20Rebasing
 * @notice A nonstandard ERC20 contract used to mock USDB.
 *
 * This implementation should NOT be used in production (unguarded mint).
 */
contract MockERC20Rebasing is MockERC20, Multicall {

    mapping(address => uint256) public lastUpdatedTimestamp;
    uint256 internal constant secondsPerYear = 31536000;
    uint256 internal constant maxbps = 10_000;

    // amount earned per year measured in BPS
    // eg 5% APY => 500
    uint256 public fixedAPY;

    /**
     * @notice Constructs the MockERC20 contract.
     * @param name_ The name of the token.
     * @param symbol_ The symbol of the token.
     * @param decimals_ The amount of decimals in the token.
     * @param apy The amount earned per year.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 apy
    ) MockERC20(name_, symbol_, decimals_) {
        _decimals = decimals_;
        fixedAPY = apy;
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address account) public view virtual override returns (uint256 bal) {
        bal = _calculateBalanceAfterInterest(account);
    }

    /**
     * @dev Hook that is called before any transfer of tokens. This includes
     * minting and burning.
     *
     * Calling conditions:
     *
     * - when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
     * will be transferred to `to`.
     * - when `from` is zero, `amount` tokens will be minted for `to`.
     * - when `to` is zero, `amount` of ``from``'s tokens will be burned.
     * - `from` and `to` are never both zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _update(address from, address to, uint256 amount) internal virtual override {
        super._update(from, to, amount);
        _updateBalanceBeforeTransfer(from);
        _updateBalanceBeforeTransfer(to);
    }

    function _calculateBalanceAfterInterest(address account) internal view returns (uint256 bal) {
        // short circuit if zero balance
        bal = super.balanceOf(account);
        //if(bal == 0) return 0;
        // short circuit if not previously updated
        uint256 lastTime = lastUpdatedTimestamp[account];
        if(lastTime == 0) return bal;
        // short circuit if already updated this block
        uint256 timeNow = block.timestamp;
        if(lastTime >= timeNow) return bal;
        // earn 5% APY
        // A = P + (P * R * T)
        uint256 timeElapsed = timeNow - lastTime;
        bal = bal + ( ( bal * fixedAPY * timeElapsed ) / (maxbps * secondsPerYear) );
    }

    function _updateBalanceBeforeTransfer(address account) internal {
        // short circuit if address zero
        if(account == address(0)) return;
        // short circuit if not previously updated
        uint256 timeNow = block.timestamp;
        uint256 lastTime = lastUpdatedTimestamp[account];
        if(lastTime == 0) {
            lastUpdatedTimestamp[account] = timeNow;
            return;
        }
        // short circuit if already updated this block
        if(lastTime >= timeNow) return;
        // earn 5% APY
        // A = P + (P * R * T)
        uint256 timeElapsed = timeNow - lastTime;
        uint256 bal0 = super.balanceOf(account);
        uint256 bal1 = bal0 + ( ( bal0 * fixedAPY * timeElapsed ) / (maxbps * secondsPerYear) );
        lastUpdatedTimestamp[account] = timeNow;
        //if(bal1 > bal0) _mint(account, bal1-bal0);
        _mint(account, bal1-bal0);
    }
}
