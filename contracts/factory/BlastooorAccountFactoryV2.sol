// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IAgents } from "./../interfaces/tokens/IAgents.sol";
import { IBlastooorAccountFactoryV2 } from "./../interfaces/factory/IBlastooorAccountFactoryV2.sol";
import { IAgentRegistry } from "./../interfaces/utils/IAgentRegistry.sol";
import { IERC6551Registry } from "./../interfaces/erc6551/IERC6551Registry.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { Ownable2Step } from "./../utils/Ownable2Step.sol";
import { Multicall } from "./../utils/Multicall.sol";


/**
 * @title BlastooorAccountFactoryV2
 * @author AgentFi
 * @notice A factory for Agent accounts.
 *
 * Creates new agents for an existing collection. Loops over the supply and if an nft doesn't have an account, creates one.
 */
contract BlastooorAccountFactoryV2 is IBlastooorAccountFactoryV2, Blastable, Ownable2Step, Multicall {

    /***************************************
    STATE VARIABLES
    ***************************************/

    address internal immutable _agentNft;
    address internal immutable _agentRegistry;
    address internal immutable _erc6551Registry;

    AgentCreationSettings internal _agentCreationSettings;

    uint256 internal _lastCheckedAgentID;

    /***************************************
    CONSTRUCTOR
    ***************************************/

    /**
     * @notice Constructs the factory contract.
     * @param owner_ The owner of the contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param gasCollector_ The address of the gas collector.
     * @param blastPoints_ The address of the blast points contract.
     * @param pointsOperator_ The address of the blast points operator.
     * @param agentNft_ The Agents contract.
     * @param agentRegistry_ The AgentRegistry contract.
     * @param erc6551Registry_ The ERC6551Registry contract.
     */
    constructor(
        address owner_,
        address blast_,
        address gasCollector_,
        address blastPoints_,
        address pointsOperator_,
        address agentNft_,
        address agentRegistry_,
        address erc6551Registry_
    ) Blastable(blast_, gasCollector_, blastPoints_, pointsOperator_) {
        _transferOwnership(owner_);
        _agentNft = agentNft_;
        _agentRegistry = agentRegistry_;
        _erc6551Registry = erc6551Registry_;
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Gets the agent creation settings.
     * @return agentNft The agents contract.
     * @return agentImplementation The agent implementation.
     * @return initializationCalls The calls to initialize the agent.
     */
    function getAgentCreationSettings() external view override returns (
        address agentNft,
        address agentImplementation,
        bytes[] memory initializationCalls
    ) {
        agentNft = _agentNft;
        AgentCreationSettings memory creationSettings = _agentCreationSettings;
        agentImplementation = creationSettings.agentImplementation;
        initializationCalls = creationSettings.initializationCalls;
    }

    /**
    * @notice Gets the ID of the last checked agent.
    * @return agentID The ID of the agent.
    */
    function lastCheckedAgentID() external view override returns (uint256 agentID) {
        agentID = _lastCheckedAgentID;
    }

    /***************************************
    OWNER FUNCTIONS
    ***************************************/

    /**
     * @notice Posts a new AgentCreationSettings.
     * Can only be called by the contract owner.
     * @param creationSettings The new creation settings to post.
     */
    function postAgentCreationSettings(
        AgentCreationSettings calldata creationSettings
    ) external payable override onlyOwner {
        // checks
        Calls.verifyHasCode(creationSettings.agentImplementation);
        // post
        _agentCreationSettings = creationSettings;
        emit AgentCreationSettingsPosted();
    }

    /**
     * @notice Creates new accounts.
     * Can only be called by the contract owner.
     */
    function createAccounts() external payable override onlyOwner {
        // checks and early exit
        address agentNft = _agentNft;
        uint256 agentID = _lastCheckedAgentID;
        uint256 supply = IAgents(agentNft).totalSupply();
        if(agentID >= supply) revert Errors.NoMoreItemsInQueue();
        // setup
        IAgentRegistry registry = IAgentRegistry(_agentRegistry);
        AgentCreationSettings memory creationSettings = _agentCreationSettings;
        bytes32 salt = bytes32(uint256(1));
        // loop over agents
        while(true) {
            // exit when done
            ++agentID;
            if(agentID > supply) {
                --agentID; // mark this one as not yet processed
                break;
            }
            // early exit for out of gas
            uint256 gasl = gasleft();
            if(gasl < 50_000) {
                --agentID; // mark this one as not yet processed
                break;
            }
            // if the agent doesnt have an account
            if(registry.getTbasOfNft(agentNft, agentID).length == 0) {
                // early exit for out of gas 2
                gasl = gasleft();
                if(gasl < 800_000) {
                    --agentID; // mark this one as not yet processed
                    break;
                }
                // create account
                address account = IERC6551Registry(_erc6551Registry).createAccount(
                    creationSettings.agentImplementation,
                    salt,
                    block.chainid,
                    agentNft,
                    agentID
                );
                // register account
                registry.registerAgent(IAgentRegistry.RegisterAgentParam({
                    agentAddress: account,
                    implementationAddress: creationSettings.agentImplementation,
                    collection: agentNft,
                    agentID: agentID
                }));
                // initialize account
                for(uint256 i = 0; i < creationSettings.initializationCalls.length; ++i) {
                    Calls.functionCall(account, creationSettings.initializationCalls[i]);
                }
            }
        }
        // save progress
        _lastCheckedAgentID = agentID;
    }

}
