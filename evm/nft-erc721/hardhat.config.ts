import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const { ALCHEMY_URL, PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

// Fail fast for deployment-critical values
if (!ALCHEMY_URL) {
  throw new Error("ALCHEMY_SEPOLIA_URL not set in .env");
}

if (!PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY not set in .env");
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    sepolia: {
      url: ALCHEMY_URL,
      accounts: [PRIVATE_KEY],
    },
  },

  etherscan: {
    apiKey: ETHERSCAN_API_KEY || "", // optional (only needed for verification)
  },

  paths: {
    sources: "./src",
  },
};

export default config;
