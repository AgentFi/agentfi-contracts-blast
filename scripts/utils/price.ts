import hre from "hardhat";
const { ethers } = hre;
const { provider, deployContract } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
const formatUnits = ethers.utils.formatUnits;

import { withBackoffRetries } from "./misc";

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

// given the decimals of a token, returns a bignumber of one token
export function decimalsToAmount(decimals: any) {
  decimals = BN.from(decimals).toNumber()
  var s = '1'
  for(var i = 0; i < decimals; ++i) s += '0'
  return BN.from(s)
}
exports.decimalsToAmount = decimalsToAmount
