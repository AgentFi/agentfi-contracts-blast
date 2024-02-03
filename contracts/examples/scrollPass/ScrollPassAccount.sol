// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../../AccountV3.sol"; // tokenbound base account contract
import "./interfaces/IL1GatewayRouter.sol";
import "./interfaces/IL2GasOracle.sol";

/**
 * @title Tokenbound ERC-6551 Account Implementation
 * @dev Implementation of an account contract with ERC-6551 compliance, capable of bridging Ether
 *      balances and handling gas reimbursements.
 */
contract ScrollPassAccount is AccountV3 {
    /**
     * @dev Key addresses for the Scroll bridge core contracts.
     */
    address constant ADMIN = 0x15BB2cc3Ea43ab2658F7AaecEb78A9d3769BE3cb; // NFT Admin Router
    address constant PAYMASTER = 0xA2d937F18e9E7fC8d295EcAeBb10Acbd5e77e9eC; // Initiating EOA
    address constant L1ROUTER = 0x13FBE0D0e5552b8c9c4AE9e2435F38f37355998a; // Sepolia (proxy)
    address constant L2ORACLE = 0x247969F4fad93a33d4826046bc3eAE0D36BdE548; // Sepolia (proxy)
    // address constant L1ROUTER = 0xF8B1378579659D8F7EE5f3C929c2f3E332E41Fd6; Mainnet (proxy)
    // address constant L2ORACLE = 0x987e300fDfb06093859358522a79098848C33852; Mainnet (proxy)

    /**
     * @dev Emitted when Ether is reimbursed to a specified address.
     * @param to Address receiving the reimbursement.
     * @param amount Amount of Ether reimbursed.
     */
    event ReimbursedEther(address to, uint256 amount);

    constructor(
        address entryPoint_,
        address multicallForwarder,
        address erc6551Registry,
        address _guardian
    ) AccountV3(entryPoint_, multicallForwarder, erc6551Registry, _guardian) {}

    /**
     * @dev Bridges the Ether balance of the contract to another address, reimbursing gas costs.
     * @param _adminGasFee Gas limit for the bridging transaction.
     * @param _bridgeGasLimit Gas limit for the Scroll bridge core contracts.
     * @dev key contracts, for reference:
     */
    function bridgeEthBalance(
        uint _bridgeGasLimit,
        uint _adminGasFee
    ) external payable {
        // verify caller + balance to be bridged
        require(msg.sender == ADMIN, "TBA: Not Scroll NFT Admin Contract!");
        require(address(this).balance > 0.01 ether, "TBA: Not enough ETH!"); // TODO confirm min amt

        // calculate 1% fee and add to admin gas fee
        uint serviceFee = (address(this).balance * 1) / 100;
        uint totalFees = _adminGasFee + serviceFee;

        // reimburse admin gas fee
        (bool sent, ) = PAYMASTER.call{value: totalFees}("");
        require(sent, "TBA: Failed to transfer gas and fee.");

        emit ReimbursedEther(PAYMASTER, totalFees);

        // initiate bridge instances
        IL1GatewayRouter l1GatewayRouter = IL1GatewayRouter(L1ROUTER);
        IL2GasOracle l2GasOracle = IL2GasOracle(L2ORACLE);

        // determine bridge fee as per core contracts calculation
        uint256 bridgeFee = _bridgeGasLimit * l2GasOracle.l2BaseFee();

        // determine amount to receive on L2
        uint256 amountToReceive = address(this).balance - bridgeFee;

        // bridge ETH balance to Scroll via bridge core contracts
        l1GatewayRouter.depositETH{value: address(this).balance}(
            owner(),
            amountToReceive,
            _bridgeGasLimit
        );

        // return any remaining ETH to TBA Owner
        if (address(this).balance > 0) {
            uint repayment = address(this).balance;
            (bool sent2, ) = owner().call{value: repayment}("");
            require(sent2, "TBA: Failed to reimburse Owner.");
            emit ReimbursedEther(owner(), repayment);
        }
    }
}
