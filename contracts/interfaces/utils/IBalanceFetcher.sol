// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IBalanceFetcher
 * @author AgentFi
 * @notice The BalanceFetcher is a purely utility contract that helps offchain components efficiently fetch an account's balance of tokens.
 */
interface IBalanceFetcher {

    /**
     * @notice Given an account and a list of tokens, returns that account's balance of each token.
     * Supports ERC20s and the gas token.
     * @param account The account to query.
     * @param tokens The list of tokens to query.
     */
    function fetchBalances(address account, address[] calldata tokens) external payable returns (uint256[] memory balances);

    struct GasQuote {
        uint256 quoteAmountAllGas;
        uint256 quoteAmountMaxGas;
    }

    /**
     * @notice Given a list of `Blastable` contracts, returns the gas quote for all.
     * @param accounts The list of accounts to quote.
     * @return quotes The list of quotes.
     */
    function fetchBlastableGasQuotes(address[] calldata accounts) external payable returns (GasQuote[] memory quotes);
}
