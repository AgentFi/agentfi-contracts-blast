require('@nomicfoundation/hardhat-toolbox')
require('@nomicfoundation/hardhat-verify')

require('dotenv').config()

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.22',
        settings: {
          evmVersion: 'paris', // no paris? https://hardhat.org/hardhat-network/docs/reference
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
  },
  networks: {
    // for mainnet
    'blast-mainnet': {
      url: 'coming end of February',
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 1000000000,
    },
    // for Sepolia testnet
    'blast-sepolia': {
      url: 'https://sepolia.blast.io',
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 1000000000,
    },
    // for local dev environment
    'blast-local': {
      url: 'http://localhost:8545',
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 1000000000,
    },
    hardhat: {
      // chainId: 1337,
      chainId: 1,
      forking: {
        url: process.env.ALCHEMY_MAINNET_URL, // fork mainnet to work with 6551
        blockNumber: 18961184, // mid-Jan 2024 block
      },
    },
    sepolia: {
      url: process.env.ALCHEMY_SEPOLIA_URL || '',
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    defaultNetwork: 'blast-local',
    // defaultNetwork: 'hardhat',
  },
  mocha: {
    timeout: 20000,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API,
  },
  sourcify: {
    enabled: true,
  },
}
