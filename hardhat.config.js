require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("hardhat-contract-sizer");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  contractSizer: {
    strict: true, // 体积超限时直接报错
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    },
    metadata:{
      bytecodeHash: "none",
    }
  },
  network:{
    ganacheDev: {
      chainId: 1337,
      url: `${process.env.DEV_GANACHE_URL}:${process.env.DEV_GANACHE_PORT}`,
      accounts: [process.env.DEV_GANACHE_PK]
    },
    sepolia:{
      url: `https://sepolia.infura.io/v3/${process.env.TEST_SEPOLIA_INFURA_API_KEY}`,
      accounts: [process.env.PK]
    }
  }
};
