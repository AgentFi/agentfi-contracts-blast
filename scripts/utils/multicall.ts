import { providers } from "ethers";
import { Contract, ContractCall } from 'ethers-multicall-hysland-finance';
import { all } from 'ethers-multicall-hysland-finance/dist/call';
import { getEthBalance } from 'ethers-multicall-hysland-finance/dist/calls';

export class MulticallProvider {
  _provider: providers.Provider;
  _multicallAddress: string;

  constructor(provider: providers.Provider, chainId: number) {
    this._provider = provider;
    this._multicallAddress = multicallAddresses[chainId];
  }

  public getEthBalance(address: string) {
    if (!this._provider) {
      throw new Error('Provider should be initialized before use.');
    }
    return getEthBalance(address, this._multicallAddress);
  }

  public async all<T extends any[] = any[]>(calls: ContractCall[]) {
    if (!this._provider) {
      throw new Error('Provider should be initialized before use.');
    }
    return all<T>(calls, this._multicallAddress, this._provider, {});
  }
}

const multicallAddresses: {[chainID: number]: string} = {
    1: '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
    3: '0xF24b01476a55d635118ca848fbc7Dab69d403be3',
    4: '0x42ad527de7d4e9d9d011ac45b31d8551f8fe9821',
    5: '0x77dca2c955b15e9de4dbbcf1246b4b85b651e50e',
    42: '0x2cc8688c5f75e365aaeeb4ea8d6a480405a48d2a',
    56: '0x1Ee38d535d541c55C9dae27B12edf090C608E6Fb',
    66: '0x94fEadE0D3D832E4A05d459eBeA9350c6cDd3bCa',
    97: '0x3A09ad1B8535F25b48e6Fa0CFd07dB6B017b31B2',
    100: '0xb5b692a88bdfc81ca69dcb1d924f59f0413a602a',
    128: '0x2C55D51804CF5b436BA5AF37bD7b8E5DB70EBf29',
    137: '0x11ce4B23bD875D7F5C6a31084f55fDe1e9A87507',
    250: '0x0118EF741097D0d3cc88e46233Da1e407d9ac139',
    4002: '0x8f81207F59A4f86d68608fF90b259A0927242967',
    1337: '0x77dca2c955b15e9de4dbbcf1246b4b85b651e50e',
    42161: '0x813715eF627B01f4931d8C6F8D2459F26E19137E',
    43114: '0x7f3aC7C283d7E6662D886F494f7bc6F1993cDacf',
    80001: '0x08411ADd0b5AA8ee47563b146743C13b3556c9Cc',
    1313161554: '0xdc1522872E440cF9cD48E237EAFEfaa5F157Ca1d',
    1313161555: '0x8f81207F59A4f86d68608fF90b259A0927242967',
    8453: '0xcA11bde05977b3631167028862bE2a173976CA11',
    84531: '0x13F51B7b96f420b0F7153279f771edAa27d70dF6',
    81457: '0x26aDd0cB3eA65ADBb063739A5C5735055029B6BD',
    168587773: '0x2FDDaa20266E88dD7E6D0c4DfbCcBe5125a3dF79',
};

export const MulticallContract = Contract
