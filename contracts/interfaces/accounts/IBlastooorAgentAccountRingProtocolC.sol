// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IBlastooorAgentAccountRingProtocolC
 * @author AgentFi
 * @notice An account type used by agents. Integrates with Ring Protocol.
*/
interface IBlastooorAgentAccountRingProtocolC {

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Executes trades in Ring Protocol.
     * Will trade eth for usdc, usdt, dai, bolt, and rgb.
     * Can only be called by a valid executor or role owner for this TBA.
     * @param ethAmount The amount of eth to input.
     */
    function executeRingProtocolStrategyC(uint256 ethAmount) external payable;
}
