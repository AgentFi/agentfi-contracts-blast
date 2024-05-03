// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { MulticallableERC2771Context } from "./../utils/MulticallableERC2771Context.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IBlastooorStrategyAgents } from "./../interfaces/tokens/IBlastooorStrategyAgents.sol";
import { IExplorerAgents } from "./../interfaces/tokens/IExplorerAgents.sol";
import { IERC6551Registry } from "./../interfaces/erc6551/IERC6551Registry.sol";
import { IAgentRegistry } from "./../interfaces/utils/IAgentRegistry.sol";
import { IConcentratedLiquidityAgentFactory } from "./../interfaces/factory/IConcentratedLiquidityAgentFactory.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { Ownable2Step } from "./../utils/Ownable2Step.sol";
import { ConcentratedLiquidityModuleC } from "./../modules/ConcentratedLiquidityModuleC.sol";


/**
 * @title ConcentratedLiquidityAgentFactory
 * @author AgentFi
 * @notice A factory for strategy agents.
 *
 * Users can use [`createAgent()`](#createagent) to create a new agent. The agent will be created based on settings stored in the factory by the contract owner. These settings can be viewed via [`getAgentCreationSettings()`](#getagentcreationsettings).
 */
contract ConcentratedLiquidityAgentFactory is Blastable, Ownable2Step, MulticallableERC2771Context, IConcentratedLiquidityAgentFactory {

    /***************************************
    STATE VARIABLES
    ***************************************/

    // addresses
    address internal immutable _erc6551Registry;
    address internal immutable _agentRegistry;
    address internal immutable _genesisAgentNft;
    address internal immutable _strategyAgentNft;
    address internal immutable _explorerAgentNft;
    address internal immutable _weth;

    // agent creation settings
    bool internal _isActive;
    address internal _strategyAccountImpl;
    address internal _explorerAccountImpl;
    bytes internal _strategyInitializationCall;
    bytes internal _explorerInitializationCall;

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
     * @param multicallForwarder_ The MulticallForwarder address.
     * @param genesisAgentNft_ The genesis agents contract.
     * @param strategyAgentNft_ The strategy agents contract.
     * @param explorerAgentNft_ The explorer agents contract.
     * @param erc6551Registry_ The erc6551 registry contract.
     * @param agentRegistry_ The agent registry contract.
     * @param weth_ The address of wrapped ether.
     */
    constructor(
        address owner_,
        address blast_,
        address gasCollector_,
        address blastPoints_,
        address pointsOperator_,
        address multicallForwarder_,
        address genesisAgentNft_,
        address strategyAgentNft_,
        address explorerAgentNft_,
        address erc6551Registry_,
        address agentRegistry_,
        address weth_
    ) Blastable(blast_, gasCollector_, blastPoints_, pointsOperator_) MulticallableERC2771Context(multicallForwarder_) {
        _transferOwnership(owner_);
        _genesisAgentNft = genesisAgentNft_;
        _strategyAgentNft = strategyAgentNft_;
        _explorerAgentNft = explorerAgentNft_;
        _erc6551Registry = erc6551Registry_;
        _agentRegistry = agentRegistry_;
        _weth = weth_;
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Gets the addresses that have been statically set.
     */
    function getStaticAddresses() external view override returns (
        address erc6551Registry_,
        address agentRegistry_,
        address genesisAgentNft_,
        address strategyAgentNft_,
        address explorerAgentNft_,
        address weth_
    ) {
        erc6551Registry_ = _erc6551Registry;
        agentRegistry_ = _agentRegistry;
        genesisAgentNft_ = _genesisAgentNft;
        strategyAgentNft_ = _strategyAgentNft;
        explorerAgentNft_ = _explorerAgentNft;
        weth_ = _weth;
    }

    /**
     * @notice Gets the agent creation settings.
     */
    function getAgentCreationSettings() external view override returns (
        address strategyAccountImpl_,
        address explorerAccountImpl_,
        bytes memory strategyInitializationCall_,
        bytes memory explorerInitializationCall_,
        bool isActive_
    ) {
        strategyAccountImpl_ = _strategyAccountImpl;
        explorerAccountImpl_ = _explorerAccountImpl;
        strategyInitializationCall_ = _strategyInitializationCall;
        explorerInitializationCall_ = _explorerInitializationCall;
        isActive_ = _isActive;
    }

    /***************************************
    CREATE AGENT FUNCTIONS
    ***************************************/

    /**
     * @notice Creates a new V3 strategy agent.
     * The new agent will be minted to an existing root agent.
     * Can only be called by the owner of the root agent.
     * @param mintParams Parameters to use to mint the position.
     * @param deposit0 The first token and amount to deposit.
     * @param deposit1 The second token and amount to deposit.
     * @param rootAgentAddress The address of the root agent to transfer the v3 agent to.
     * @return nonfungiblePositionTokenId The ID of the concentrated liquidity position.
     * @return liquidity The amount of liquidity minted
     * @return amount0 The amount of token 0 used.
     * @return amount1 The amount of token 1 used.
     * @return strategyAgentID The ID of the newly created strategy agent.
     * @return strategyAddress The address of the newly created strategy agent.
     */
    function createConcentratedLiquidityAgentForRoot(
        MintBalanceParams calldata mintParams,
        TokenDeposit calldata deposit0,
        TokenDeposit calldata deposit1,
        address rootAgentAddress
    ) external payable override returns (
        uint256 nonfungiblePositionTokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1,
        uint256 strategyAgentID,
        address strategyAddress
    ) {
        // checks
        if(!_isActive) revert Errors.CreationSettingsPaused();
        IAgentRegistry registry = IAgentRegistry(_agentRegistry);
        (address collection, uint256 rootAgentID) = registry.getNftOfTba(rootAgentAddress);
        if(
            (collection == address(0)) || (
                (collection != _genesisAgentNft) &&
                (collection != _strategyAgentNft) &&
                (collection != _explorerAgentNft)
            )
        ) revert Errors.NotAnAgent();
        if(IERC721(collection).ownerOf(rootAgentID) != _msgSender()) revert Errors.NotOwnerOfAgent();
        // create v3 agent
        (nonfungiblePositionTokenId, liquidity, amount0, amount1, strategyAgentID, strategyAddress) =
            _createConcentratedLiquidityAgent(mintParams, deposit0, deposit1);
        // transfer strategy agent to root agent
        IBlastooorStrategyAgents(_strategyAgentNft).transferFrom(address(this), rootAgentAddress, strategyAgentID);
    }

    /**
     * @notice Creates a new V3 strategy agent.
     * The new agent will be minted to a new explorer agent.
     * @param mintParams Parameters to use to mint the position.
     * @param deposit0 The first token and amount to deposit.
     * @param deposit1 The second token and amount to deposit.
     * @return nonfungiblePositionTokenId The ID of the concentrated liquidity position.
     * @return liquidity The amount of liquidity minted
     * @return amount0 The amount of token 0 used.
     * @return amount1 The amount of token 1 used.
     * @return strategyAgentID The ID of the newly created strategy agent.
     * @return strategyAddress The address of the newly created strategy agent.
     * @return explorerAgentID The ID of the newly created explorer agent.
     * @return explorerAddress The address of the newly created explorer agent.
     */
    function createConcentratedLiquidityAgentAndExplorer(
        MintBalanceParams calldata mintParams,
        TokenDeposit calldata deposit0,
        TokenDeposit calldata deposit1
    ) external payable override returns (
        uint256 nonfungiblePositionTokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1,
        uint256 strategyAgentID,
        address strategyAddress,
        uint256 explorerAgentID,
        address explorerAddress
    ) {
        // checks
        if(!_isActive) revert Errors.CreationSettingsPaused();
        // create explorer agent
        (explorerAgentID, explorerAddress) = _createExplorerAgent();
        // create v3 agent
        (nonfungiblePositionTokenId, liquidity, amount0, amount1, strategyAgentID, strategyAddress) =
            _createConcentratedLiquidityAgent(mintParams, deposit0, deposit1);
        // transfer v3 agent to explorer agent
        IBlastooorStrategyAgents(_strategyAgentNft).transferFrom(address(this), explorerAddress, strategyAgentID);
        // transfer explorer agent to msg sender
        IExplorerAgents(_explorerAgentNft).transferFrom(address(this), _msgSender(), explorerAgentID);
    }

    /***************************************
    HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Creates a new concentrated liquidity agent.
     * @param mintParams Parameters to use to mint the position.
     * @param deposit0 The first token and amount to deposit.
     * @param deposit1 The second token and amount to deposit.
     * @return nonfungiblePositionTokenId The ID of the concentrated liquidity position.
     * @return liquidity The amount of liquidity minted
     * @return amount0 The amount of token 0 used.
     * @return amount1 The amount of token 1 used.
     * @return strategyAgentID The ID of the newly created strategy agent.
     * @return strategyAddress The address of the newly created strategy agent.
     */
    function _createConcentratedLiquidityAgent(
        MintBalanceParams calldata mintParams,
        TokenDeposit calldata deposit0,
        TokenDeposit calldata deposit1
    ) internal returns (
        uint256 nonfungiblePositionTokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1,
        uint256 strategyAgentID,
        address strategyAddress
    ) {
        // create nft
        (strategyAgentID, strategyAddress) = _createStrategyAgent();
        address weth = _weth;
        // handle token deposits
        if(deposit0.token == address(0)) {
            Calls.sendValue(weth, deposit0.amount);
            SafeERC20.safeTransfer(IERC20(weth), strategyAddress, deposit0.amount);
        }
        else {
            SafeERC20.safeTransferFrom(IERC20(deposit0.token), _msgSender(), strategyAddress, deposit0.amount);
        }
        if(deposit1.token == address(0)) {
            Calls.sendValue(weth, deposit1.amount);
            SafeERC20.safeTransfer(IERC20(weth), strategyAddress, deposit1.amount);
        }
        else {
            SafeERC20.safeTransferFrom(IERC20(deposit1.token), _msgSender(), strategyAddress, deposit1.amount);
        }
        // create the position in the strategy agent
        (nonfungiblePositionTokenId, liquidity, amount0, amount1) =
            ConcentratedLiquidityModuleC(payable(strategyAddress)).moduleC_mintWithBalance(
                ConcentratedLiquidityModuleC.MintBalanceParams({
                  manager: mintParams.manager,
                  pool: mintParams.pool,
                  slippageLiquidity: mintParams.slippageLiquidity,
                  tickLower: mintParams.tickLower,
                  tickUpper: mintParams.tickUpper,
                  sqrtPriceX96: mintParams.sqrtPriceX96
                })
            );
    }

    /**
     * @notice Creates a new strategy agent.
     * Includes the agent NFT and TBA.
     * Initializes the strategy but doesn't initialize the position.
     * @return strategyAgentID The ID of the new agent.
     * @return strategyAddress The address of the new agent.
     */
    function _createStrategyAgent() internal returns (
        uint256 strategyAgentID,
        address strategyAddress
    ) {
        // create nft
        address strategies = _strategyAgentNft;
        strategyAgentID = IBlastooorStrategyAgents(strategies).createAgent();
        // create account
        address accountImpl = _strategyAccountImpl;
        bytes32 salt = bytes32(uint256(0));
        strategyAddress = IERC6551Registry(_erc6551Registry).createAccount(
            accountImpl,
            salt,
            block.chainid,
            strategies,
            strategyAgentID
        );
        // register account
        IAgentRegistry(_agentRegistry).registerAgent(IAgentRegistry.RegisterAgentParam({
            agentAddress: strategyAddress,
            implementationAddress: accountImpl,
            collection: strategies,
            agentID: strategyAgentID
        }));
        // initialize account
        Calls.functionCall(strategyAddress, _strategyInitializationCall);
    }

    /**
     * @notice Creates a new explorer agent.
     * Includes the agent NFT and TBA.
     * Initializes the explorer but doesn't initialize the position.
     * @return explorerAgentID The ID of the new agent.
     * @return explorerAddress The address of the new agent.
     */
    function _createExplorerAgent() internal returns (
        uint256 explorerAgentID,
        address explorerAddress
    ) {
        // create nft
        address explorers = _explorerAgentNft;
        explorerAgentID = IExplorerAgents(explorers).createAgent();
        // create account
        address accountImpl = _explorerAccountImpl;
        bytes32 salt = bytes32(uint256(0));
        explorerAddress = IERC6551Registry(_erc6551Registry).createAccount(
            accountImpl,
            salt,
            block.chainid,
            explorers,
            explorerAgentID
        );
        // register account
        IAgentRegistry(_agentRegistry).registerAgent(IAgentRegistry.RegisterAgentParam({
            agentAddress: explorerAddress,
            implementationAddress: accountImpl,
            collection: explorers,
            agentID: explorerAgentID
        }));
        // initialize account
        Calls.functionCall(explorerAddress, _explorerInitializationCall);
    }

    /***************************************
    OWNER FUNCTIONS
    ***************************************/

    /**
     * @notice Posts a new AgentCreationSettings.
     * Can only be called by the contract owner.
     */
    function postAgentCreationSettings(
        AgentCreationSettings calldata creationSettings
    ) external payable override onlyOwner {
        _strategyAccountImpl = creationSettings.strategyAccountImpl;
        _explorerAccountImpl = creationSettings.explorerAccountImpl;
        _strategyInitializationCall = creationSettings.strategyInitializationCall;
        _explorerInitializationCall = creationSettings.explorerInitializationCall;
        _isActive = creationSettings.isActive;
        emit AgentCreationSettingsPosted();
    }
}
