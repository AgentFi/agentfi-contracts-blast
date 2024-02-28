import { ethers, BigNumber as BN } from "ethers";
const { formatUnits } = ethers.utils;
import { leftPad, rightPad, formatUnits2 } from "./strings";


// price config
const fixed_overhead = 188 // set by chain governance
const dynamic_overhead = 0.684 // set by chain governance
const l1_gas_price = 20000000000 // 20 gwei. changes per block with eip1559
const eth_price = 1600

export default class L1DataFeeAnalyzer {
  txs: any

  // create a new instance
  constructor() {
    this.txs = {}
  }

  // registers a transaction under the given function name
  public register(functionName: string, tx: any) {
    if(!this.txs.hasOwnProperty(functionName)) {
      this.txs[functionName] = []
    }
    this.txs[functionName].push(tx)
  }

  // analyze all transactions that have been registered, broken down by function name
  public analyze() {
    let breakLine = `·------------------------------------------------·------------·----------------·----------------·`
    console.log(breakLine)
    console.log(`|  Analyzing functions by L1 data fee                                                           |`)
    console.log(breakLine)
    console.log(`|  function                                      |  data gas  |  data fee eth  |  data fee usd  |`)
    console.log(breakLine)
    // get function names, sorted
    const functionNames = Object.keys(this.txs).sort()
    // loop over functions
    for(const functionName of functionNames) {
      let function_str = rightPad(functionName, 44)
      //console.log(`Function: ${functionName}`)
      // calculate average tx_data_gas
      let tx_data_gas_sum = 0
      let txs = this.txs[functionName]
      for(const tx of txs) {
        //console.log(tx)
        //console.log(tx.data)
        tx_data_gas_sum += this.calcTxDataGas(tx.data)
      }
      let tx_data_gas_avg = tx_data_gas_sum / txs.length
      let tx_data_gas_str = leftPad(Math.floor(tx_data_gas_avg), 8)
      //console.log(`tx_data_gas        : ${leftPad(Math.floor(tx_data_gas_avg), 5)}`)
      let l1_data_fee = l1_gas_price * (tx_data_gas_avg + fixed_overhead) * dynamic_overhead
      //console.log(`l1_data_fee        : ${l1_data_fee}`)
      let data_fee_eth = BN.from(''+Math.floor(l1_data_fee))
      let data_fee_eth_str = rightPad(formatUnits2(data_fee_eth).substring(0, 12), 12, '0')
      //console.log(`data_fee_eth       : ${formatUnits(data_fee_eth)}`)
      let data_fee_usd = data_fee_eth.mul(eth_price)
      let data_fee_usd_str = rightPad(formatUnits2(data_fee_usd).substring(0, 12), 12, '0')
      //console.log(`data_fee_usd       : ${formatUnits(data_fee_usd)}`)
      console.log(`|  ${function_str}  |  ${tx_data_gas_str}  |  ${data_fee_eth_str}  |  ${data_fee_usd_str}  |`)
      console.log(breakLine)
    }
  }

  analyzeTxData(txdata: string) {


    //console.log(txdata)
    let numBytes = txdata.length/2-1
    let zeros = calcNumZeroBytes(txdata)
    let nonzeros = calcNumNonZeroBytes(txdata)
    console.log(`total num bytes    : ${leftPad(numBytes, 5)}`)
    console.log(`num zero bytes     : ${leftPad(zeros, 5)}`)
    console.log(`num nonzero bytes  : ${leftPad(nonzeros, 5)}`)
    let tx_data_gas = zeros * 4 + nonzeros * 16
    let l1_data_fee = l1_gas_price * (tx_data_gas + fixed_overhead) * dynamic_overhead
    console.log(`tx_data_gas        : ${leftPad(tx_data_gas, 5)}`)
    console.log(`l1_data_fee        : ${l1_data_fee}`)
    let data_fee_eth = BN.from(Math.floor(l1_data_fee))
    console.log(`data_fee_eth       : ${formatUnits2(data_fee_eth)}`)
    let data_fee_usd = data_fee_eth.mul(eth_price)
    console.log(`data_fee_usd       : ${formatUnits2(data_fee_usd)}`)
    // 52495909269977.38
    // 0.000052495909269977.38
  }

  calcTxDataGas(txdata: string) {
    //let zeros = calcNumZeroBytes(txdata)
    //let nonzeros = calcNumNonZeroBytes(txdata)
    let [zeros, nonzeros] = this.calcNumBytes(txdata)
    let tx_data_gas = zeros * 4 + nonzeros * 16
    //console.log(`tx_data_gas        : ${leftPad(tx_data_gas, 5)}`)
    return tx_data_gas
  }

  /*
  calcNumZeroBytes(txdata: string) {
    let count = 0
    for(let i = 2; i < txdata.length; i+=2) {
      let s = txdata.substring(i, i+2)
      if(s == '00') count++
    }
    return count
  }

  calcNumNonZeroBytes(txdata: string) {
    let count = 0
    for(let i = 2; i < txdata.length; i+=2) {
      let s = txdata.substring(i, i+2)
      if(s != '00') count++
    }
    return count
  }
  */
  calcNumBytes(txdata: string) {
    let zeros = 0
    let nonzeros = 0
    for(let i = 0; i < txdata.length; i+=2) {
      let s = txdata.substring(i, i+2)
      if(s == "0x") continue
      if(s == '00') zeros++
      else nonzeros++
    }
    //console.log(txdata)
    let numBytes = txdata.length/2-1
    //console.log(`total num bytes    : ${leftPad(numBytes, 5)}`)
    //console.log(`num zero bytes     : ${leftPad(zeros, 5)}`)
    //console.log(`num nonzero bytes  : ${leftPad(nonzeros, 5)}`)
    return [zeros, nonzeros]
  }
}
