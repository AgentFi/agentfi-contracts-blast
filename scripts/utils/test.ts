import { expect } from "chai";
import { BigNumber, BigNumberish } from "ethers";
const BN = ethers.BigNumber;

// Default 0.001%
export function almostEqual(actual: BigNumberish, expected: BigNumberish, percentage = 0.001) {
  const a = BN.from(actual)
  const e = BN.from(expected)
  const epsilon = e.mul(Math.floor(percentage * 100_000)).div(100_000);
  return expect(a).to.be.within(e.sub(epsilon), e.add(epsilon))
}

// Ether.js returns some funky stuff for structs (merges an object and array). Convert to an object
export function convertToStruct(res: any) {
  return Object.keys(res)
    .filter((x) => Number.isNaN(parseInt(x)))
    .reduce(
      (acc, k) => {
        acc[k] = res[k];
        return acc;
      },
      {} as Record<string, any>
    );
}
