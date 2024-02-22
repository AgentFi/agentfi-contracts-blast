import hardhat from "hardhat";
const { /*waffle,*/ ethers } = hardhat;
//const { provider } = waffle;
//const BN = ethers.BigNumber;
import axios from "axios"
//const multicall = require("ethers-multicall-hysland-finance")

const { AddressZero } = ethers.constants

import { withBackoffRetries } from "./misc"
import { intToHex } from "./strings"

// fetch a block
export async function fetchBlock(provider:any, blockTag:string|number="latest") {
  return new Promise((resolve, reject) => {
    withBackoffRetries(() => provider.getBlock(blockTag)).then(resolve)
  })
}
exports.fetchBlock = fetchBlock

// fetch events that occurred in a contract with the given event name between startBlock and endBlock
export async function fetchEvents(contract:any, filter:any, startBlock:number, endBlock:string|number) {
  if(endBlock == "latest") endBlock = await contract.provider.getBlockNumber()
  return _fetchEvents(contract, filter, startBlock, endBlock as number, 0)
}
exports.fetchEvents = fetchEvents;

// helper for fetchEvents()
async function _fetchEvents(contract:any, filter:any, startBlock:number, endBlock:number, depth:number) {
  return new Promise(async (resolve,reject) => {
    try {
      var events = await contract.queryFilter(filter, startBlock, endBlock)
      resolve(events)
      return
    } catch(e) {
      /*
      var s = e.toString();
      if(!s.includes("10K") && !s.includes("1000 results") && !s.includes("statement timeout") && !s.includes("missing response")) {
        reject(e)
        return
      }
      */
      // log response size exceeded. recurse down
      var midBlock = Math.floor((startBlock+endBlock)/2)
      var [left, right]:any = [ [], [] ]
      if(depth < 8) {
        [left, right] = await Promise.all([ // parallel
          _fetchEvents(contract, filter, startBlock, midBlock, depth+1),
          _fetchEvents(contract, filter, midBlock+1, endBlock, depth+1),
        ])
      } else { // serial
        left = await _fetchEvents(contract, filter, startBlock, midBlock, depth+1)
        right = await _fetchEvents(contract, filter, midBlock+1, endBlock, depth+1)
      }
      var res = left.concat(right)
      resolve(res)
    }
  })
}

// returns true if code is deployed at the given address and block
// returns false if the address is invalid or no code was deployed yet
export async function isDeployed(provider:any, address:string, blockTag:number|string="latest") {
  try {
    // safety checks
    if(address === undefined || address === null) return false;
    if(address.length !== 42) return false;
    if(address === AddressZero) return false;
    if((await provider.getCode(address, blockTag)).length <= 2) return false;
    return true;
  } catch (e:any) {
    if(e.toString().includes("account aurora does not exist while viewing")) return false; // handle aurora idiosyncracies
    else throw e;
  }
}
exports.isDeployed = isDeployed

// use a binary search to determine the block in which a contract was deployed to the given address.
// returns -1 if the contract has not been deployed yet
// may fail if self destructed
export async function findDeployBlock(provider:any, address:string) {
  // part 0: setup, checks
  let R = await provider.getBlockNumber();
  if(!(await isDeployed(provider, address, R))) return -1;
  // part 1: it is likely that the nucleus was deployed recently
  // use a square linear search to efficiently find a lower block number bound
  let L: number;
  for(let blocksBack = 1; ; ) {
    L = R - blocksBack;
    // is deployed, keep iterating
    if(await isDeployed(provider, address, L)) {
      blocksBack *= 2;
      // if out of bounds, check edge
      if(blocksBack > R) {
        if(await isDeployed(provider, address, 0)) return 0;
        else {
          L = 1;
          break;
        }
      }
    }
    // is not deployed, terminate
    else {
      break;
    }
  }
  // part 2: binary search
  while(L < R-1) {
    let M = Math.floor((L+R)/2);
    if(await isDeployed(provider, address, M)) R = M;
    else L = M;
  }
  // part 3: checks
  let b1 = await isDeployed(provider, address, R-1);
  let b2 = await isDeployed(provider, address, R);
  if(b1 || !b2) throw "Error in findDeployBlock(): did not converge properly";
  return R;
}
exports.findDeployBlock = findDeployBlock

// uses multicall to efficiently read multiple calls at once
export async function multicallChunked(mcProvider:any, calls:any, blockTag:number|string="latest", chunkSize:number=25) {
  // // under most circumstances we enforce reading from same block number to ensure consistant data
  // // in this case we just want the "latest" data and can live with _slightly_ out of date / out of sync data
  if(blockTag == "latest") blockTag = await mcProvider._provider.getBlockNumber()

  // break into chunks
  var chunks = []
  for(var i = 0; i < calls.length; i += chunkSize) {
    var chunk = []
    for(var j = 0; j < chunkSize && i+j < calls.length; ++j) {
      chunk.push(calls[i+j])
    }
    chunks.push(chunk)
  }
  // parallel call each chunk
  var res1:any = await Promise.all(chunks.map(chunk => withBackoffRetries(() => mcProvider.all(chunk, {blockTag:blockTag,gasLimit:30000000}))))
  // reassemble
  var res2:any = []
  for(var i = 0; i < res1.length; ++i) {
    for(var j = 0; j < res1[i].length; ++j) {
      res2.push(res1[i][j])
    }
  }
  return res2
}
exports.multicallChunked = multicallChunked

// same as above but accepts a dictionary of calls
export async function multicallChunkedDict(mcProvider:any, callsDict:any, blockTag:number|string="latest", chunkSize:number=25) {
  // transform dict to arr
  let keys = Object.keys(callsDict).sort()
  let callsArr = []
  for(let i = 0; i < keys.length; ++i) callsArr.push(callsDict[keys[i]])
  // call
  let resultsArr = await multicallChunked(mcProvider, callsArr, blockTag, chunkSize)
  // transform arr to dict
  let resultsDict:any = {}
  for(let i = 0; i < keys.length; ++i) resultsDict[keys[i]] = resultsArr[i]
  // return
  return resultsDict
}
exports.multicallChunkedDict = multicallChunkedDict

// gets all events that occurred in a given block number
export async function getLogsFromBlockNumber(providerURL:string, blockNumber:number) {
  // this is written using axios because I don't see how to do it in ethers
  let url = providerURL
  let blockNumberHex = intToHex(blockNumber)
  let postData = {"method":"eth_getLogs","params":[{"fromBlock":blockNumberHex,"toBlock":blockNumberHex}],"id":1,"jsonrpc":"2.0"}
  let res = await axios.post(url, postData)
  let result = res.data.result
  return result
}
exports.getLogsFromBlockNumber = getLogsFromBlockNumber
