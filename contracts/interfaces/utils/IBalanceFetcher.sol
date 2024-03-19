// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IBalanceFetcher
 * @author AgentFi
 * @notice The BalanceFetcher is a purely utility contract that helps offchain components efficiently fetch an account's balance of tokens.
 */
interface IBalanceFetcher {

    struct Agent {
        address agentAddress;
        address implementation;
        address owner;
        address collection;
        uint256 tokenId;
        uint256[] balances;
    }

    struct Position {
        address owner;
        address pool;
        address token;
        uint256 balance;
    }

    /**
     * @notice Given an account and a list of tokens, returns that account's balance of each token.
     * Supports ERC20s and the gas token.
     * @param account The account to query.
     * @param tokens The list of tokens to query.
     */
    function fetchBalances(address account, address[] calldata tokens) external payable returns (uint256[] memory balances);

    /**
     * @notice Given an account and a list of nft contracts and tokens, returns all agents under that account.
     * @param account The account to query.
     * @param collections The list of nfts tokens to query.
     * @param tokens The list of erc20 tokens to query.
     */
    function fetchAgents(address account, address[] calldata collections, address[] calldata tokens) external payable returns (Agent[] memory agents);

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

    /**
     * @notice Fetches the underlying balances of a uniswap v2 style LP pool
     * @param account The account to query.
     * @param poolAddress The uniswap v2 pool to query.
     * @param pos0 token 0 position
     * @param pos1 token 1 position
     */
    function fetchPositionV2(address account, address poolAddress) external view returns (Position memory pos0, Position memory pos1);

    /**
     * @notice Given an list of accounts and list of lp tokens, returns underlying balance across all pools
     * @param accounts The list of accounts to query.
     * @param pools The list of uniswap v2 style tokens to query.
     * @param positions List of uniswap v2 positions 
     */
    function fetchPositionsV2(address[] calldata accounts, address[] calldata pools) external view returns (Position[] memory positions);
}
