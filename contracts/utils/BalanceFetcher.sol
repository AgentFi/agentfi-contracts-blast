// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Multicall } from "./Multicall.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IBalanceFetcher } from "./../interfaces/utils/IBalanceFetcher.sol";
import { IRingV2Pair } from "./../interfaces/external/RingProtocol/IRingV2Pair.sol";
import { Blastable } from "./Blastable.sol";
import { Ownable2Step } from "./../utils/Ownable2Step.sol";
import { IBlastooorGenesisAgents } from "./../interfaces/tokens/IBlastooorGenesisAgents.sol";


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
     * @param gasCollector_ The address of the gas collector.
     * @param blastPoints_ The address of the blast points contract.
     * @param pointsOperator_ The address of the blast points operator.
     */
    constructor(
        address owner_,
        address blast_,
        address gasCollector_,
        address blastPoints_,
        address pointsOperator_
    ) Blastable(blast_, gasCollector_, blastPoints_, pointsOperator_) {
        _transferOwnership(owner_);
    }

    /**
     * @notice Given an account and a list of tokens, returns that account's balance of each token.
     * Supports ERC20s and the gas token.
     * @param account The account to query.
     * @param tokens The list of tokens to query.
     */
    function fetchBalances(address account, address[] calldata tokens) public payable override returns (uint256[] memory balances) {
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
     * @notice Given an account and a list of nft contracts and tokens, returns all agents under that account
     * @param account The account to query.
     * @param collections The list of nfts tokens to query.
     * @param tokens The list of erc20 tokens to query.
     */
    function fetchAgents(address account, address[] calldata collections, address[] calldata tokens) public payable returns (Agent[] memory agents) {
        // Start a queue of agents to search for child agents
        Agent[] memory queue = new Agent[](10000);

        // Add the queried account as the first item in the queue
        queue[0].agentAddress = account;	
        queue[0].balances = fetchBalances(account, tokens);	

        // For each item in the queue, add children agents to the end.
        // Keep searching until we check all agents
        uint256 start = 0;
        uint256 count = 1; // Number of agents found
        while(start < count) {
            address parent = queue[start++].agentAddress;

            for(uint256 i = 0; i < collections.length; i++) {
                IBlastooorGenesisAgents collection = IBlastooorGenesisAgents(collections[i]);
                uint256 balance = collection.balanceOf(parent);
                for(uint256 n = 0; n < balance; ++n) {
                    uint256 tokenId = collection.tokenOfOwnerByIndex(parent, n);
                    queue[count++] = _fetchAgent(parent, collections[i], tokenId, tokens);
                }
            }
        }

        // Copy to final array to get the right length
        agents = new Agent[](count);
        for(uint256 i = 0; i < count; i++) {
            agents[i] = queue[i];
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
     * @notice Fetch key information for a uniswap v2 style pool
     * @param poolAddress The address of the pool
     * @return total Total supply of the pool
     * @return address0 Token 0 address
     * @return address1 Token 1 address
     * @return reserve0 Token 0 reserve
     * @return reserve1 Token 1 reserve
     */
    function fetchPoolInfoV2(address poolAddress) public view returns (uint256 total, address address0, address address1, uint112 reserve0, uint112 reserve1) {
        IRingV2Pair pool = IRingV2Pair(poolAddress);

        total = pool.totalSupply();

        address0 = pool.token0();
        address1 = pool.token1();
        (reserve0, reserve1,) = pool.getReserves();
    }

    /**
     * @notice Fetch information about a particular agent
     * @param account Owner
     * @param collection Nft contract address
     * @param tokenId Id of the token on the token address
     * @param tokens List of tokens to get fetch balances for
     * @return agent Agent information, including balances
     */
    function _fetchAgent(address account, address collection, uint256 tokenId, address[] calldata tokens) internal returns (Agent memory agent) {
        IBlastooorGenesisAgents token = IBlastooorGenesisAgents(collection);

        (address agentAddress, address implementationAddress) = token.getAgentInfo(tokenId);

        agent = Agent({
            collection: collection,
            tokenId: tokenId,
            agentAddress: agentAddress,
            implementation:implementationAddress,
            owner: account,
            balances: fetchBalances(agentAddress, tokens)
        });
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
