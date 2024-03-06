// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IBlastooorGenesisAgents } from "./../interfaces/tokens/IBlastooorGenesisAgents.sol";

/**
 * @title AgentFetcher
 * @author AgentFi
 * @notice Helper contract to fetch data 
 */
contract AgentFetcher {
    struct AgentInfo {
      address implimentation;
      uint256 tokenId;
    }
    
    function fetchAgents(address account, address[] calldata collections) external view returns (AgentInfo[] memory agents) {
      // Figure out total number of agents
      uint256 totalAgents = 0;
      for(uint256 i = 0; i < collections.length; ++i) {
        IBlastooorGenesisAgents implimentation = IBlastooorGenesisAgents(collections[i]);
        totalAgents += implimentation.balanceOf(account);
      }

      agents = new AgentInfo[](totalAgents);

      uint256 counter = 0;
      for(uint256 i = 0; i < collections.length; ++i) {
        IBlastooorGenesisAgents implimentation = IBlastooorGenesisAgents(collections[i]);
        uint256 balance = implimentation.balanceOf(account);

        for(uint256 n = 0; n < balance; ++n) {
            uint256 tokenId = implimentation.tokenOfOwnerByIndex(account, n);
            AgentInfo memory agent = AgentInfo(collections[i], tokenId);
            agents[counter++] = agent;
        }
      }
    }
}
