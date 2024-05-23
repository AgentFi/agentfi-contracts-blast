import chai from "chai";
const { expect } = chai;

import {
  getNewTicksForNeutralStrategy,
  price1ToTick,
  tickToPrice1,
} from "../scripts/utils/v3";

describe("V3 helpers tests", () => {
  it("Can get range width from ticks", () => {
    const tickLower = price1ToTick(3300);
    const tickUpper = price1ToTick(2700);

    // Note price rounded due to ticks
    expect(tickLower).to.equal(-81000);
    expect(tickUpper).to.equal(-79020);
    expect(tickToPrice1(tickUpper)).to.equal(2701.6147433895053);
    expect(tickToPrice1(tickLower)).to.equal(3293.1341747694587);

    const spot = 4000;
    const ticks = getNewTicksForNeutralStrategy(spot, tickLower, tickUpper);

    expect(ticks).to.deep.equal([-83880, -81900]);
    expect(ticks.map(tickToPrice1)).to.deep.equal([
      4392.178515447191, 3603.246513258591,
    ]);
  });
});
