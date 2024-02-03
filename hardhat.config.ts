import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-abi-exporter";
import "hardhat-contract-sizer";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const ethereum_fork = { url: process.env.ETHEREUM_URL||'', blockNumber:parseInt(process.env.ETHEREUM_FORK_BLOCK)||undefined };
const sepolia_fork = { url: process.env.SEPOLIA_URL||'', blockNumber:parseInt(process.env.SEPOLIA_FORK_BLOCK)||undefined };
//const blast_fork = { url: process.env.BLAST_URL||'', blockNumber:parseInt(process.env.BLAST_FORK_BLOCK)||undefined };
const blast_sepolia_fork = { url: process.env.BLAST_SEPOLIA_URL||'', blockNumber:parseInt(process.env.BLAST_SEPOLIA_FORK_BLOCK)||undefined };
const no_fork = undefined;
const forking = (
    process.env.FORK_NETWORK === "ethereum"       ? ethereum_fork
  : process.env.FORK_NETWORK === "sepolia"        ? sepolia_fork
  //: process.env.FORK_NETWORK === "blast"          ? blast_fork
  : process.env.FORK_NETWORK === "blastsepolia"   ? blast_sepolia_fork
  : no_fork
);

const accounts = (!!process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : JSON.parse(process.env.PRIVATE_KEYS || '[]'))

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: process.env.FORK_NETWORK ? forking : undefined,
      chainId: 31337,
    },
    localhost: { url: "http://127.0.0.1:8545" },
    ethereum: {
      url: process.env.ETHEREUM_URL||'',
      chainId: 1,
      accounts: accounts
    },
    sepolia: {
      url: process.env.SEPOLIA_URL||'',
      chainId: 111555111,
      accounts: accounts
    },
    blastsepolia: {
      url: process.env.BLAST_SEPOLIA_URL||'',
      chainId: 168587773,
      accounts: accounts
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          },
        },
      },
    ]
  },
  abiExporter: {
    path: "./abi",
    runOnCompile: true,
    clear: true,
    spacing: 0,
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    gasPrice: 1, // really should be ~0.001 gwei, but this doesnt support decimals
    coinmarketcap: process.env.CMC_API_KEY || "",
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
};

export default config;
