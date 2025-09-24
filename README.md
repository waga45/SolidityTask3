# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
```

NFT拍卖合约
```
工厂模式管理拍卖合约，用于用户自主创建和结束拍卖，集成Chainlink价格预言机，UUPS合约升级。

IAuctionFactory.sol 合约工厂接口
ISunNFTAuction.sol  拍卖合约接口
NFTAuctionFactory.sol 工厂合约实现
SunNFT.sol NFT合约
SunNFTAuction.sol 拍卖合约
SunNFTAuctionV2.sol 用于测试升级拍卖合约V2
```

```angular2html
部署 npx hardhat run ignition/modules/01_deploy_SunNFTAuction_V1.js --network sepolia

测试 npx hardhat test ./test/SunNFT.js

合约大小分析：npx hardhat size-contracts
```
