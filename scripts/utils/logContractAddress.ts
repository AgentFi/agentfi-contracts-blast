export function expandStr(str: String, len: number) {
  let s = str;
  if(s === undefined || s === null) s = ""
  while(s.length < len) s = `${s} `
  return s;
}

export function logContractAddress(contractName: String, address: String) {
  console.log(`| ${expandStr(contractName,28)} | \`${expandStr(address,42)}\` |`)
}
