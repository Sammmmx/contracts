import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      evmVersion: "cancun",
    },
  },
  networks: {
    sepolia: {
      url:
        process.env.ALCHEMY_KEY ||
        "https://eth-sepolia.g.alchemy.com/v2/gVXcPfzuhkq1vlHWrkQ2E",
      accounts: [
        process.env.PRIVATE_KEY ||
          "e3fb3fff632bb25a1c90316ae39f66e332123dafd091a7a80788886ac3671455",
      ],
    },
  },
  etherscan: {
    apiKey:
      process.env.ETHERSCAN_API_KEY || "QKIFJ5FQM8SHY37H3WEB99GTB4E4GUPKHI",
  },
};

export default config;
