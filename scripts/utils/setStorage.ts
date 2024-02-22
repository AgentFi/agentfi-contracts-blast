import { ethers } from "hardhat";
import { BigNumber as BN, BigNumberish } from "ethers";
const { hexlify, zeroPad, hexStripZeros, solidityKeccak256 } = ethers.utils;

import { expectDeployed } from "./expectDeployed";
import { expect } from "chai";

// returns a number in its full 32 byte hex representation
export function toBytes32(bn: BigNumberish) {
  return hexlify(zeroPad(BN.from(bn).toHexString(), 32));
};

// same as above without leading 0x
export function toAbiEncoded(bn: BigNumberish) {
  return toBytes32(bn).substring(2);
};

// same as above but a list
export function abiEncodeArgs(list: BigNumberish[]) {
  return list.map(toAbiEncoded).join('');
}

// manipulates storage in the hardhat test network
export async function setStorageAt(address: string, index: string, value: string) {
  index = hexStripZeros(index);
  if(index == "0x") index = "0x0"
  await ethers.provider.send("hardhat_setStorageAt", [address, index, value]);
  await ethers.provider.send("evm_mine", []); // Just mines to the next block
};

const ABI_ERC20 = [{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}];

// manipulates a user's balance of an ERC20 token in the hardhat test network
export async function manipulateERC20BalanceOf(
  token: string,
  balanceOfSlot: number,
  holder: string,
  desiredBalance: BigNumberish,
  isVyper: boolean = false
) {
  // get storage slot index
  const order = (isVyper
    ? [balanceOfSlot, holder] // slot, key. vyper
    : [holder, balanceOfSlot] // key, slot. solidity
  );
  const index = solidityKeccak256(
    ["uint256", "uint256"],
    order
  );
  await setStorageAt(token, index.toString(), toBytes32(desiredBalance));
  let tokenContract = await ethers.getContractAt(ABI_ERC20, token);
  expect(await tokenContract.balanceOf(holder)).eq(desiredBalance);
}

// finds the slot that an ERC20 uses to store balanceOf
// may not work for rebasing tokens or proxies
export async function findERC20BalanceOfSlot(token: string, isVyper: boolean = false) {
  await expectDeployed(token);
  const snapshot = await ethers.provider.send("evm_snapshot", []);
  const tkn = await ethers.getContractAt(ABI_ERC20, token);
  const dummyAddress = "0x1237496012374091324516234098657061327439";
  const bal = await tkn.balanceOf(dummyAddress);
  const newBal = bal.add(ethers.constants.WeiPerEther);
  // manipulate storage until reflected in reponse
  for(let slotNum = 0; slotNum < 100; ++slotNum) {
    await manipulateERC20BalanceOf(token, slotNum, dummyAddress, newBal, isVyper);
    const setBal = await tkn.balanceOf(dummyAddress);
    if(setBal.eq(newBal)) {
      await ethers.provider.send("evm_revert", [snapshot]);
      return slotNum;
    }
  }
  await ethers.provider.send("evm_revert", [snapshot]);
  throw("ERC20 balanceOf slot not found");
}

// finds the slot that an ERC20 uses to store balanceOf
// may not work for rebasing tokens
export async function findERC20BalanceOfSlotAndLanguage(token: string) {
  try {
    return [await findERC20BalanceOfSlot(token, false), "solidity"];
  } catch(e) {}
  try {
    return [await findERC20BalanceOfSlot(token, true), "vyper"];
  } catch(e) {}
  throw("ERC20 balanceOf slot not found");
}
