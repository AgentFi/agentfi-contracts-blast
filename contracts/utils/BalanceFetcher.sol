// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Multicall } from "./Multicall.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IBalanceFetcher } from "./../interfaces/utils/IBalanceFetcher.sol";
import { Blastable } from "./Blastable.sol";
import { Ownable2Step } from "./../utils/Ownable2Step.sol";


/**
 * @title BalanceFetcher
 * @author AgentFi
 * @notice The BalanceFetcher is a purely utility contract that helps offchain components efficiently fetch an account's balance of tokens.
 */
contract BalanceFetcher is IBalanceFetcher, Blastable, Ownable2Step, Multicall {

    /**
     * @notice Constructs the BalanceFetcher contract.
     * @param owner_ The owner of the contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param governor_ The address of the gas governor.
     */
    constructor(
        address owner_,
        address blast_,
        address governor_
    ) Blastable(blast_, governor_) {
        _transferOwnership(owner_);
    }

    /**
     * @notice Given an account and a list of tokens, returns that account's balance of each token.
     * Supports ERC20s and the gas token.
     * @param account The account to query.
     * @param tokens The list of tokens to query.
     */
    function fetchBalances(address account, address[] calldata tokens) external payable override returns (uint256[] memory balances) {
        balances = new uint256[](tokens.length);
        for(uint256 i = 0; i < tokens.length; ++i) {
            address token = tokens[i];
            if(token == address(0)) balances[i] = account.balance;
            else if(token == address(1)) balances[i] = _tryQuoteClaimAllGas(account);
            else if(token == address(2)) balances[i] = _tryQuoteClaimMaxGas(account);
            else balances[i] = IERC20(token).balanceOf(account);
        }
    }

    /**
     * @notice Given a list of `Blastable` contracts, returns the gas quote for all.
     * @param accounts The list of accounts to quote.
     * @return quotes The list of quotes.
     */
    function fetchBlastableGasQuotes(address[] calldata accounts) external payable override returns (GasQuote[] memory quotes) {
        quotes = new GasQuote[](accounts.length);
        for(uint256 i = 0; i < accounts.length; ++i) {
            address account = accounts[i];
            quotes[i].quoteAmountAllGas = _tryQuoteClaimAllGas(account);
            quotes[i].quoteAmountMaxGas = _tryQuoteClaimMaxGas(account);
        }
    }

    /**
     * @notice Quotes the amount of gas expected when claiming all gas.
     * Can be called by anyone.
     * @return quoteAmount The amount of gas that can be claimed.
     */
    function _tryQuoteClaimAllGas(address account) internal returns (uint256 quoteAmount) {
        bytes memory payload = abi.encodeWithSignature("quoteClaimAllGas()");
        (bool success, bytes memory returndata) = account.call(payload);
        if(!success) return 0;
        if(returndata.length != 32) return 0;
        (quoteAmount) = abi.decode(returndata, (uint256));
    }

    /**
     * @notice Quotes the amount of gas expected when claiming max gas.
     * Can be called by anyone.
     * @return quoteAmount The amount of gas that can be claimed.
     */
    function _tryQuoteClaimMaxGas(address account) internal returns (uint256 quoteAmount) {
        bytes memory payload = abi.encodeWithSignature("quoteClaimMaxGas()");
        (bool success, bytes memory returndata) = account.call(payload);
        if(!success) return 0;
        if(returndata.length != 32) return 0;
        (quoteAmount) = abi.decode(returndata, (uint256));
    }
}
