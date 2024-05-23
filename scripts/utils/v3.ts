export function price0ToTick(price: number) {
  const spacing = 60;
  const tick = Math.floor(Math.log(price) / Math.log(1.0001));
  return Math.round(tick / spacing) * spacing;
}

// Inverse is for USDB/WETH pool, but want 1 WETH = X USDB
export function price1ToTick(price: number) {
  return price0ToTick(1 / price);
}

export function tickToPrice0(tick: number) {
  return Math.pow(1.0001, tick);
}

export function tickToPrice1(tick: number) {
  return 1 / tickToPrice0(tick);
}

export function sqrtPriceX96ToPrice1(sqrtPriceX96: bigint) {
  const price = 2n ** 192n / sqrtPriceX96 ** 2n;
  return Number(price * 10n ** 18n) / 10 ** 18;
}

export function getNewTicksForNeutralStrategy(
  spot: number,
  tickLower: number,
  tickUpper: number,
): [number, number] {
  const pa = tickToPrice1(tickUpper);
  const pb = tickToPrice1(tickLower);

  const width = (pb - pa) / (pb + pa);

  return [price1ToTick(spot + width * spot), price1ToTick(spot - width * spot)];
}
