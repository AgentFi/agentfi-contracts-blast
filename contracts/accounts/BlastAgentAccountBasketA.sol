// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IAgentFactory03 } from "./../interfaces/router/IAgentFactory03.sol";
import { BlastAgentAccount } from "./BlastAgentAccount.sol";
import { BlastAgentAccountRingProtocolD } from "./BlastAgentAccountRingProtocolD.sol";
import { BlastAgentAccountThrusterA } from "./BlastAgentAccountThrusterA.sol";


/**
 * @title BlastAgentAccountBasketA
 * @author AgentFi
 * @notice An account type used by agents. Creates a basket strategy with Thruster and Ring Protocol.
 */
contract BlastAgentAccountBasketA is BlastAgentAccount {

    /***************************************
    CONSTANTS
    ***************************************/

    address internal constant weth            = 0x4200000000000000000000000000000000000023;
    address internal constant factory         = 0x3c12E9F1FC3C3211B598aD176385939Ea01deA89;

    address public worker0;
    address public worker1;

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

    function initialize() external payable {
        _beforeExecuteStrategy();
        if(worker0 != address(0)) revert Errors.AlreadyInitialized();
        IAgentFactory03 factory_ = IAgentFactory03(factory);
        // optionally wrap eth
        uint256 ethAmount = address(this).balance;
        IERC20 weth_ = IERC20(weth);
        if(ethAmount > 0) Calls.sendValue(address(weth_), ethAmount);
        // deposit
        weth_.approve(address(factory_), type(uint256).max);
        ethAmount = weth_.balanceOf(address(this)) / 2;
        if(ethAmount > 0) {
            IAgentFactory03.TokenDeposit[] memory deposits = new IAgentFactory03.TokenDeposit[](1);
            deposits[0] = IAgentFactory03.TokenDeposit({
                token: address(weth_),
                amount: ethAmount
            });
            (, worker0) = factory_.createAgent(4, deposits);
            (, worker1) = factory_.createAgent(6, deposits);
        }
        else {
            (, worker0) = factory_.createAgent(4);
            (, worker1) = factory_.createAgent(6);
        }
    }

    /**
     * @notice Deposits tokens into the basket.
     * Can only be called by a valid executor or role owner for this TBA.
     */
    function depositBasketA() external payable {
        _beforeExecuteStrategy();
        _depositBasketA();
    }

    /**
     * @notice Withdraws tokens from Ring Protoocol.
     * Can only be called by a valid executor or role owner for this TBA.
     */
    function withdrawBasketA() external payable {
        _beforeExecuteStrategy();
        _withdrawBasketA();
    }

    /**
     * @notice Deposits tokens into the basket.
     * Will attempt to deposit this TBA's entire balance of weth.
     */
    function _depositBasketA() internal {
        // optionally wrap eth
        uint256 ethAmount = address(this).balance;
        IERC20 weth_ = IERC20(weth);
        if(ethAmount > 0) Calls.sendValue(address(weth_), ethAmount);
        // deposit
        ethAmount = weth_.balanceOf(address(this)) / 2;
        if(ethAmount == 0) return; // exit if zero deposit
        address worker = worker0;
        SafeERC20.safeTransfer(weth_, worker, ethAmount);
        BlastAgentAccountRingProtocolD(payable(worker)).depositRingProtocolStrategyD();
        worker = worker1;
        SafeERC20.safeTransfer(weth_, worker, ethAmount);
        BlastAgentAccountThrusterA(payable(worker)).depositThrusterA();
    }

    function _withdrawBasketA() internal {
    }

    function _beforeExecuteStrategy() internal {
        _verifySenderIsValidExecutorOrHasRole(STRATEGY_MANAGER_ROLE);
        _verifyIsUnlocked();
        _updateState();
    }
}
