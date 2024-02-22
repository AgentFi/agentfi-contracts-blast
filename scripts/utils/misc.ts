import { ethers } from "hardhat";
//import { BigNumber as BN, Contract, Signer } from "ethers";
//const formatUnits = ethers.utils.formatUnits
import fs from 'fs';
import { BigNumber, BigNumberish } from "ethers";
const BN = BigNumber
//import UniswapV3PoolArtifact from "@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json";

// when using JSON.stringify() on a BN or object that contains a BN, returns its string representation
ethers.BigNumber.prototype.toJSON = function toJSON(_key:any) { return this.toString() };

// helper functions

// returns a promise that resolves after a specified wait time
async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
exports.delay = delay

// returns the result of a given function call
// gracefully handles request timeouts and retries
//const MIN_RETRY_DELAY = 10000
//const RETRY_BACKOFF_FACTOR = 2
//const MAX_RETRY_DELAY = 100000
const MIN_RETRY_DELAY = 100
const RETRY_BACKOFF_FACTOR = 2
const MAX_RETRY_DELAY = 10000
export async function withBackoffRetries(f: Function, retryCount = 7, jitter = 250) {
  return new Promise(async (resolve, reject) => {
    //await delay(Math.floor(Math.random() * jitter))
    let nextWaitTime = MIN_RETRY_DELAY
    let i = 0
    while (true) {
      try {
        var res = await f()
        resolve(res)
        break
      } catch (error: any) {
        i++
        if(!error.toString().toLowerCase().includes("timeout")) {
          reject(error)
          break
        }
        if (i >= retryCount) {
          console.log('timeout. over max retries')
          reject(error)
          break
        }
        console.log('timeout. retrying')
        await delay(nextWaitTime + Math.floor(Math.random() * jitter))
        nextWaitTime = Math.min(MAX_RETRY_DELAY, RETRY_BACKOFF_FACTOR * nextWaitTime)
      }
    }
  })
}
exports.withBackoffRetries = withBackoffRetries

// tries to get the value returned by a call
// if the call fails, returns a default value
export async function tryGet(f: any, e: any) {
  try {
    return await f();
  } catch(err) {
    return e;
  }
}
exports.tryGet = tryGet

// returns an array of integers starting at start, incrementing, and stopping before stop
export function range(start: any, stop: any) {
  let arr = [];
  for(var i = start; i < stop; ++i) {
    arr.push(i);
  }
  return arr;
}

// sorts BigNumbers ascending
// usage: bnArray.sort(sortBNs)
export function sortBNs(a: any, b: any) {
  if(a.lt(b)) return -1;
  if(a.gt(b)) return 1;
  return 0;
}
exports.sortBNs = sortBNs

// returns the sign of a bignumber
export function bnSign(n:BigNumberish) {
  let n2 = BN.from(n)
  if(n2.eq(0)) return 0
  else if(n2.gt(0)) return +1
  else return -1
}
exports.bnSign = bnSign

// reads a file
export function readFile(filename:string) {
  return fs.readFileSync(filename).toString()
}
exports.readFile = readFile

// reads a json file and returns it as an object
export function readJsonFile(filename:string) {
  return JSON.parse(readFile(filename))
}
exports.readJsonFile = readJsonFile

// given an array and a mapper function (value => key)
// returns it as a dictionary
// in case two elements map to the same key, keep the first element in array
export function arrayToDict(arr:any[], mapper:Function=(x:any)=>x) {
  let dict:any = {}
  for(let i = 0; i < arr.length; ++i) {
    let ele = arr[i]
    let key = mapper(ele)
    if(!dict.hasOwnProperty(key)) dict[key] = ele
  }
  return dict
}
exports.arrayToDict = arrayToDict

// given an array that potentially contains duplicate elements
// returns a new array with only one copy of each unique element
// use mapper when elements are complex objects that should not be used as dictionary keys
// in case two elements map to the same key, keep the first element in array
export function deduplicateArray(arr:any[], mapper:Function=(x:any)=>x) {
  return Object.values(arrayToDict(arr, mapper))
}
exports.deduplicateArray = deduplicateArray

// the default array.filter() returns a new array with the elements that pass the filter
// this function returns two arrays - one will the elements that pass, one with those that dont
// todo: attach to array prototype
export function filterYN(f:Function, arr:any[]) {
  var y = []
  var n = []
  for(var ele of arr) {
    if(f(ele)) y.push(ele)
    else n.push(ele)
  }
  return [y, n]
}
exports.filterYN = filterYN
