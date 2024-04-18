export function priceToTick(price: number) {
  const spacing = 60;
  const tick = Math.floor(Math.log(price) / Math.log(1.0001));
  return Math.round(tick / spacing) * spacing;
}

// Inverse is for USDB/WETH pool, but want 1 WETH = X USDB
export function priceInverseToTick(price: number) {
  return priceToTick(1 / price);
}

export function tickToPrice(tick: number) {
  return Math.pow(1.0001, tick);
}

export function sqrtPriceX96ToPriceInverse(sqrtPriceX96: bigint) {
  const price = 2n ** 192n / sqrtPriceX96 ** 2n;
  return Number(price * 10n ** 18n) / 10 ** 18;
}
