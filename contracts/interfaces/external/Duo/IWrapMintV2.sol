// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IWrapMintV2 {
    /* Events */
    event MintFixedRate(address indexed fixedRate, address indexed owner, uint256 principal, uint256 yield);
    event BurnFixedRate(address indexed fixedRate, uint256 principal, uint256 yieldToUnlock, uint256 yieldToRelease);
    event MintVariableRate(address indexed variableRate, address indexed owner, uint256 amount);
    event BurnVariableRate(address indexed variableRate, uint256 amount, uint256 yield, uint256 fee);
    event UpdateExchange(address indexed exchange, bool status);
    event UpdateFixedRateNft(address indexed nft);
    event UpdateVariableRateNft(address indexed nft);
    event UpdateDuoAssetToken(address indexed duoAssetToken);

    /** @notice mint a variable rate contract, input with ETH */
    function mintVariableRateEth(
        address exchange,
        uint256 amountIn,
        uint256 amountOutMin,
        bytes calldata data
    ) external payable returns (address variableRateContract, uint256 amountOut);

    /**
     * @notice burn a variable rate contract, together with asset token, receiving principal and yield
     * @param variableRate the variable rate contract to burn
     * @param amount the amount of variable rate contract to burn
     * @param minYield the minimum amount of yield to unlock
     * @return yield the amount of yield unlocked
     * @return fee the amount of fee
     */
    function burnVariableRate(
        address variableRate,
        uint256 amount,
        uint256 minYield
    ) external returns (uint256 yield, uint256 fee);

    /**
     * @notice burn a fixed rate contract, together with asset token, receiving principal and yield
     * @param fixedRate the fixed rate contract to burn
     * @param amount the amount of fixed rate contract to burn
     * @return yieldToUnlock the amount of yield to unlock
     * @return yieldToRelease the amount of yield to release
     */
    function burnFixedRate(
        address fixedRate,
        uint256 amount
    ) external returns (uint256 yieldToUnlock, uint256 yieldToRelease);
}
