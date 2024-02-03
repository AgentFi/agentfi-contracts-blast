// chainlist
// 1: ethereum
// 111555111: sepolia
// 168587773: blast sepolia
// 31337: hardhat testnet

// given a chainID, returns some settings to use for the network
export function getNetworkSettings(chainID: number) {
  chainID = parseInt(chainID)
  const KNOWN_CHAINS = [1, 111555111, 168587773, 31337];
  if(!(KNOWN_CHAINS.includes(chainID))) throw new Error(`chainID '${chainID}' unknown`);

  // number of blocks to wait to ensure finality
  const CONFIRMATIONS: any = {
    [1]: 1,
    [111555111]: 1,
    [168587773]: 5,
    [31337]: 0
  };
  let confirmations = CONFIRMATIONS.hasOwnProperty(chainID) ? CONFIRMATIONS[chainID] : 1;

  // gas settings
  const ONE_GWEI = 1000000000;
  const OVERRIDES: any = {
    [1]: {maxFeePerGas: 40 * ONE_GWEI, maxPriorityFeePerGas: 2 * ONE_GWEI},
    [111555111]: {},
    [168587773]: {},
    [31337]: {},
  };
  let overrides = OVERRIDES.hasOwnProperty(chainID) ? OVERRIDES[chainID] : {};

  // testnets
  const TESTNETS: any = [111555111, 168587773, 31337];
  let isTestnet = TESTNETS.includes(chainID);

  // url of the provider
  const PROVIDER_URLS: any = {
    [1]: process.env.MAINNET_URL,
    [111555111]: process.env.SEPOLIA_URL,
    [168587773]: process.env.BLAST_SEPOLIA_URL,
    [31337]: "" // technically this does have a url when forking. but we want this to fail if not listening to prod network
  }
  let providerURL = (PROVIDER_URLS.hasOwnProperty(chainID) ? PROVIDER_URLS[chainID] : "") || "";

  const ETHERSCAN_SETTINGS: any = {
    [1]: {url: "", apikey: process.env.ETHERSCAN_API_KEY},
    [111555111]: {url: "", apikey: process.env.ETHERSCAN_API_KEY},
  }
  let etherscanSettings = ETHERSCAN_SETTINGS.hasOwnProperty(chainID) ? ETHERSCAN_SETTINGS[chainID] : undefined;

  let networkSettings = {confirmations, overrides, isTestnet, providerURL, etherscanSettings};
  return networkSettings;
}
