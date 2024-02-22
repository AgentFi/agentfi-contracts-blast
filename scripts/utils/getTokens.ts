import fs from "fs"

export function getTokenList(chainID:any) {
  return JSON.parse(fs.readFileSync(`./data/tokens/${chainID}.json`).toString())
}
exports.getTokenList = getTokenList

export function getTokensByAddress(chainID:any) {
  const tokenList = getTokenList(chainID)
  const d:any = {}
  tokenList.forEach((token:any) => d[token.address] = token)
  return d
}
exports.getTokensByAddress = getTokensByAddress

export function getTokensBySymbol(chainID:any) {
  const tokenList = getTokenList(chainID)
  const d:any = {}
  tokenList.forEach((token:any) => d[token.symbol] = token)
  return d
}
exports.getTokensBySymbol = getTokensBySymbol
