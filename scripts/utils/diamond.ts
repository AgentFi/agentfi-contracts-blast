/* global ethers */

import { ethers } from "ethers";
import { readJsonFile } from "./misc"

export const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 }

export const selector = (facet: ethers.Contract) => {
  let selection = get(getSelectors(facet),["goodbye()"]);
  console.log("FUNCTIONS: "+selection[0])
}

// get function selectors from ABI
export const getSelectors = (contract: ethers.Contract|ethers.ContractFactory) => {
  const signatures = Object.keys(contract.interface.functions)
  const selectors: any = signatures.reduce((acc, val) => {
    if (val !== "init(bytes)") {
      acc.push(contract.interface.getSighash(val))
    }
    return acc
  }, [] as any[])
  selectors.contract = contract
  selectors.remove = remove
  selectors.get = get
  return selectors
}

// get function selector from function signature
export const getSelector = (func:any) => {
  const abiInterface = new ethers.utils.Interface([func])
  return abiInterface.getSighash(ethers.utils.Fragment.from(func))
}

// used with getSelectors to remove selectors from an array of selectors
// functionNames argument is an array of function signatures
export const remove = (that: any, functionNames: string[]) => {
  const selectors = that.filter((v: string) => {
    for(let i = 0; i < functionNames.length; ++i) {
      const functionName = functionNames[i];
      if (v === that.contract.interface.getSighash(functionName)) {
        return false
      }
    }
    return true
  })
  selectors.contract = that.contract
  //selectors.remove = remove
  //selectors.get = get
  return selectors
}

// used with getSelectors to get selectors from an array of selectors
// functionNames argument is an array of function signatures
export const get = (that:any, functionNames:string[]) => {
  const selectors = that.filter((v:string) => {
    for (const functionName of functionNames) {
      if (v === that.contract.interface.getSighash(functionName)) {
        return true
      }
    }
    return false
  })
  selectors.contract = that.contract
  // selectors.remove = this.remove
  // selectors.get = this.get
  return selectors
}

// remove selectors using an array of signatures
export const removeSelectors = (selectors:string[], signatures:string[]) => {
  const iface = new ethers.utils.Interface(signatures.map(v => "function " + v))
  const removeSelectors = signatures.map(v => iface.getSighash(v))
  selectors = selectors.filter(v => !removeSelectors.includes(v))
  return selectors
}

// find a particular address position in the return value of diamondLoupeFacet.facets()
export const findAddressPositionInFacets = (facetAddress:string, facets:any) => {
  for (let i = 0; i < facets.length; i++) {
    if (facets[i].facetAddress === facetAddress) {
      return i
    }
  }
}

function calcSighash(funcSig:string) {
  //console.log(ethers.utils.id(''))
  // owner() -> 0x08c379a0
  return ethers.utils.id(funcSig).substring(0, 10)
}

function calcSighashes(contract:any, contractName="", debugMode=false) {
  //return Object.keys(contract.functions).filter((x:string)=>x.includes('(')).map(calcSighash)
  let functions = Object.keys(contract.functions).filter((x:string)=>x.includes('('))
  let sighashes = []
  let s = `\n${contractName}`
  for(let i = 0; i < functions.length; i++) {
    let func = functions[i]
    let sighash = calcSighash(func)
    sighashes.push(sighash)
    s = `${s}\n${sighash} ${func}`
  }
  //let debugMode = true;
  //let debugMode = false;
  if(debugMode) {
    console.log(s)
  }
  return sighashes
  /*
  let functions = Object.keys(contract.functions).filter((x:string)=>x.includes('('))
  console.log('functions');
  console.log(functions);
  for(let i = 0; i < functions.length; i++) {
    let func = functions[i]
    let data = erc6551AccountModule.interface.encodeFunctionData(func, []);
    console.log('func', func)
    console.log('data', data)
    console.log('sighash real', data.substring(0,10))
    let sighash = calcSighash(func)
    console.log('sighash calc', sighash)
  }
  */
}

// read the abi from the artifact filenames
// combine them into one abi
function getCombinedAbi(filenames: string[]) {
  let abiMap:any = {}
  function pushIfUnique(item:any) {
    if(item.type == "constructor") return
    abiMap[JSON.stringify(item)] = true
  }
  for(const filename of filenames) {
    let nextAbi = readJsonFile(filename)
    nextAbi = nextAbi.abi || nextAbi
    for(const item of nextAbi) {
      pushIfUnique(item)
    }
  }
  let abi = Object.keys(abiMap).map(JSON.parse)
  return abi
}

module.exports = {
  FacetCutAction,
  selector,
  get,
  getSelector,
  getSelectors,
  remove,
  removeSelectors,
  findAddressPositionInFacets,
  calcSighash,
  calcSighashes,
  getCombinedAbi,
}
