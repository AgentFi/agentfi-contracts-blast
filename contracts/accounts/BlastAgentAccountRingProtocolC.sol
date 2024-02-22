// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { BlastAgentAccount } from "./BlastAgentAccount.sol";
import { IBlastAgentAccountRingProtocolC } from "./../interfaces/accounts/IBlastAgentAccountRingProtocolC.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IUniversalRouter } from "./../interfaces/external/RingProtocol/IUniversalRouter.sol";


/**
 * @title BlastAgentAccountRingProtocolC
 * @author AgentFi
 * @notice An account type used by agents. Integrates with Ring Protocol.
 */
contract BlastAgentAccountRingProtocolC is BlastAgentAccount, IBlastAgentAccountRingProtocolC {

    /***************************************
    CONSTANTS
    ***************************************/

    address public constant universalRouter = 0x334e3F7f5A9740627fA47Fa9Aa51cE0ccbD765cF;

    address public constant weth            = 0x4200000000000000000000000000000000000023;
    address public constant usdc            = 0xF19A5b56b419170Aa2ee49E5c9195F5902D39BF1;
    address public constant usdt            = 0xD8F542D710346DF26F28D6502A48F49fB2cFD19B;
    address public constant dai             = 0x9C6Fc5bF860A4a012C9De812002dB304AD04F581;
    address public constant bolt            = 0x1B0cC80F4E2A7d205518A1Bf36de5bED686662FE;
    address public constant rgb             = 0x7647a41596c1Ca0127BaCaa25205b310A0436B4C;

    address public constant fwweth          = 0x798dE0520497E28E8eBfF0DF1d791c2E942eA881;
    address public constant fwusdc          = 0xa7870cf9143084ED04f4C2311f48CB24a2b4A097;
    address public constant fwusdt          = 0xD8f6A67D198485335DAF4aaDeb74358BC021410d;
    address public constant fwdai           = 0x9DB240312deEFEC82687405a4CF42511032d55d8;
    address public constant fwbolt          = 0x0eF98E6F5268747B52f2B139de23981b776B314A;
    address public constant fwrgb           = 0x9BF7537cE9F808c845d5Cfe1e94c856A74Fa56d7;

    /// @dev Used for identifying cases when this contract's balance of a token is to be used as an input
    /// This value is equivalent to 1<<255, i.e. a singular 1 in the most significant bit.
    uint256 internal constant CONTRACT_BALANCE = 0x8000000000000000000000000000000000000000000000000000000000000000;

    /***************************************
    CONSTRUCTOR
    ***************************************/

    /**
     * @notice Constructs the BlastAgentAccount contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param governor_ The address of the gas governor.
     */
    constructor(
        address blast_,
        address governor_,
        address entryPoint_,
        address multicallForwarder,
        address erc6551Registry,
        address _guardian
    ) BlastAgentAccount(blast_, governor_, entryPoint_, multicallForwarder, erc6551Registry, _guardian) {}

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Executes trades in Ring Protocol.
     * Will trade eth for usdc, usdt, dai, bolt, and rgb.
     * Can only be called by a valid executor or role owner for this TBA.
     * @param ethAmount The amount of eth to input.
     */
    function executeRingProtocolStrategyC(uint256 ethAmount) external payable override {
        // checks
        _verifySenderIsValidExecutorOrHasRole(STRATEGY_MANAGER_ROLE);
        _verifyIsUnlocked();
        _updateState();

        // effects
        uint256 numCalls = 6;
        uint256 ethAmountPerCall = ethAmount / numCalls;
        if(ethAmountPerCall == 0) revert Errors.AmountZero();

        // encode commands to universal router
        bytes memory commands = new bytes(11);
        bytes[] memory inputs = new bytes[](11);
        // eth -> weth -> usdc
        commands[0] = 0x0b;
        commands[1] = 0x23;
        inputs[0] = abi.encode(2, ethAmountPerCall);
        inputs[1] = abi.encode(1, CONTRACT_BALANCE, 0, 192, 0, 1, 2, fwweth, fwusdc);
        // eth -> weth -> usdt
        commands[2] = 0x0b;
        commands[3] = 0x23;
        inputs[2] = inputs[0];
        inputs[3] = abi.encode(1, CONTRACT_BALANCE, 0, 192, 0, 1, 2, fwweth, fwusdt);
        // eth -> weth -> dai
        commands[4] = 0x0b;
        commands[5] = 0x23;
        inputs[4] = inputs[0];
        inputs[5] = abi.encode(1, CONTRACT_BALANCE, 0, 192, 0, 1, 2, fwweth, fwdai);
        // eth -> weth -> bolt
        commands[6] = 0x0b;
        commands[7] = 0x23;
        inputs[6] = inputs[0];
        inputs[7] = abi.encode(1, CONTRACT_BALANCE, 0, 192, 0, 1, 2, fwweth, fwbolt);
        // eth -> weth -> rgb
        commands[8] = 0x0b;
        commands[9] = 0x23;
        inputs[8] = inputs[0];
        inputs[9] = abi.encode(1, CONTRACT_BALANCE, 0, 192, 0, 1, 2, fwweth, fwrgb);
        // eth -> weth
        commands[10] = 0x0b;
        inputs[10] = abi.encode(1, ethAmount-(ethAmountPerCall*(numCalls-1)));

        // interactions
        // execute trades
        IUniversalRouter(universalRouter).execute{value:ethAmount}(
            commands,
            inputs
        );
    }
}
