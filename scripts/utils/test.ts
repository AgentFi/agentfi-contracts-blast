import { expect } from "chai";
import { BigNumber } from "ethers";

// Default 0.001%
export function almostEqual(actual: BigNumber, expected: BigNumber, percentage = 0.001) {
  const epsilon = expected.mul(percentage * 100_000).div(100_000);
  return expect(actual).to.be.within(expected.sub(epsilon), expected.add(epsilon))
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
