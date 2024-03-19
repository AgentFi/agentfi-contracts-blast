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
        /*
        queue[0] = Agent({
            collection: address(0),
            tokenId: 0,
            agentAddress: account,
            implementation: address(0),
            owner: address(0),
            balances: new uint256[](0)
        });
        */

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

        // Don't include the first agent, which is the one we added manually
        agents = new Agent[](count - 1);
        for(uint256 i = 0; i < count - 1; i++) {
            agents[i] = queue[i+1];
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
     * @notice Fetches the underlying balances of a uniswap v2 style LP pool
     * @param account The account to query.
     * @param poolAddress The uniswap v2 pool to query.
     * @param pos0 token 0 position
     * @param pos1 token 1 position
     */
    function fetchPositionV2(address account, address poolAddress) public view returns (Position memory pos0, Position memory pos1)  {
        IRingV2Pair pool = IRingV2Pair(poolAddress);

        uint256 balance = pool.balanceOf(account);
        uint256 total = pool.totalSupply();
        (uint112 token0, uint112 token1,) = pool.getReserves();
        
        pos0 = Position({
            owner: account,
            pool: poolAddress,
            token: pool.token0(),
            balance: uint256(token0) * balance / total
        });
        pos1 = Position({
            owner: account,
            pool: poolAddress,
            token: pool.token1(),
            balance: uint256(token1) * balance / total
        });
    }

    /**
     * @notice Given an list of accounts and list of lp tokens, returns underlying balance across all pools
     * @param accounts The list of accounts to query.
     * @param pools The list of uniswap v2 style tokens to query.
     * @param positions List of uniswap v2 positions 
     */
    function fetchPositionsV2(address[] calldata accounts, address[] calldata pools) public view returns (Position[] memory positions) {
        positions = new Position[](accounts.length * pools.length * 2);
        uint256 count = 0; 
        for(uint256 a = 0; a < accounts.length; a++) {
            for(uint256 p = 0; p < pools.length; p++) {
                (Position memory pos0, Position memory pos1) = fetchPositionV2(accounts[a], pools[p]);
                positions[count++] = pos0;
                positions[count++] = pos1;
            }
        }
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
