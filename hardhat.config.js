require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

if (!process.env.PRIVATE_KEY || process.env.PRIVATE_KEY.trim().length !== 64) {
  throw new Error("Invalid PRIVATE_KEY. Check your .env file.");
}

module.exports = {
  solidity: "0.8.28",
  networks: {
    amoy: {
      url: "https://rpc-amoy.polygon.technology",
      accounts: [process.env.PRIVATE_KEY.trim()]
    }
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY || ""
  }
};
