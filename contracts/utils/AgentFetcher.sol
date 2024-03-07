// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IBlastooorGenesisAgents } from "./../interfaces/tokens/IBlastooorGenesisAgents.sol";
import { IBlastAgentAccount } from "./../interfaces/accounts/IBlastAgentAccount.sol";
import "hardhat/console.sol";

/**
 * @title AgentFetcher
 * @author AgentFi
 * @notice Helper contract to fetch data 
 */
contract AgentFetcher {
    struct Agent {
      address agentAddress;
      address implementation;
      address owner;
      address tokenAddress;
      uint256 tokenId;
    }

    function fetchAgent(address owner, address tokenAddress, uint256 tokenId) internal view returns (Agent memory agent) {
        IBlastooorGenesisAgents token = IBlastooorGenesisAgents(tokenAddress);
      
        (address agentAddress, address implementationAddress) = token.getAgentInfo(tokenId);

        agent = Agent({
          tokenAddress: tokenAddress,
          tokenId: tokenId, 
          agentAddress: agentAddress,
          implementation:implementationAddress,
          owner: owner
        });
    }


    function fetchAgents(address account, address[] calldata tokens) public view returns (Agent[] memory agents) {
      uint256 count = 0; // Number of agents found

      // Initialise a large one to start
      Agent[] memory temp = new Agent[](10000);


      // Find all Parent nodes and add to list
      for(uint256 i = 0; i < tokens.length; ++i) {
        IBlastooorGenesisAgents token = IBlastooorGenesisAgents(tokens[i]);
        uint256 balance = token.balanceOf(account);
        for(uint256 n = 0; n < balance; ++n) {
            uint256 tokenId = token.tokenOfOwnerByIndex(account, n);
            temp[count++] = fetchAgent(account, tokens[i], tokenId);
        }
      }

      // For each parent, keep adding children till we found the children for all nodes
      uint256 start = 0;
      while(start < count) {
        Agent memory parent = temp[start++];
        for(uint256 i = 0; i < tokens.length; ++i) {
          IBlastooorGenesisAgents token = IBlastooorGenesisAgents(tokens[i]);
          uint256 balance = token.balanceOf(parent.agentAddress);
          for(uint256 n = 0; n < balance; ++n) {
              uint256 tokenId = token.tokenOfOwnerByIndex(parent.agentAddress, n);
              temp[count++] = fetchAgent(parent.agentAddress, tokens[i], tokenId);
          }
        }
      }
      agents = new Agent[](count); 
      for(uint256 i = 0; i < count; i++) {
        agents[i] = temp[i];
      }
    }
}
