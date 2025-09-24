const {ethers,upgrades} = require("hardhat");
const fs = require("fs");
require("dotenv").config();

const NFT_NAME="SunNFT";
const NFT_SYMBOL="SunNFT";
const NFT_MAX_SUPPLY=10000;
const NFT_MIN_PRICE=ethers.parseEther("0.01");
const NFT_BASE_URI="ipfs://"
const SepoliaUsdctoUsdPari="0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E";
const SepoliaEthToUdsPari="0x694AA1769357215DE4FAC081bf1f309aDC325306";
//部署V1
async function main(){
    // 获取部署者账户
    const [deployer] = await ethers.getSigners();
    console.log("部署者地址:", deployer.address);
    //部署NFT
    const SunNFTV1=await ethers.getContractFactory("SunNFT");
    const SunNFT = await upgrades.deployProxy(SunNFTV1,[NFT_NAME,NFT_SYMBOL,NFT_MAX_SUPPLY,NFT_MIN_PRICE,NFT_BASE_URI],
        { kind: "uups",initializer:"initialize" });
    await SunNFT.waitForDeployment();
    const proxyNftAddress=await SunNFT.getAddress();
    console.log("✅ NFT合约代理地址：",proxyNftAddress);
    const SunNFTArtifact = await hre.artifacts.readArtifact("SunNFT");
    const sunNFTAbi = SunNFTArtifact.abi;
    //部署工厂
    const AuctionTemplate = await ethers.getContractFactory("SunNFTAuction");
    const template = await AuctionTemplate.deploy(); // 普通部署
    await template.waitForDeployment();
    const auctionTemplateArtifact = await hre.artifacts.readArtifact("SunNFTAuction");
    const auctionTemplateAbi = auctionTemplateArtifact.abi;
    console.log("模版合约地址：",await template.getAddress());
    const auctionFactory =await ethers.getContractFactory("NFTAuctionFactory");
    const NFTAuctionFactory =await upgrades.deployProxy(auctionFactory,
        [await template.getAddress()],
        { kind: "uups",initializer:"initialize" })
    await NFTAuctionFactory.waitForDeployment();
    const AuctionFactoryArtifact = await hre.artifacts.readArtifact("NFTAuctionFactory");
    const nfcFactoryAbi = AuctionFactoryArtifact.abi;

    //初始化设置喂价
    await NFTAuctionFactory.setChainPriceFeed(SepoliaUsdctoUsdPari);
    await NFTAuctionFactory.setEthToUsdPriceFee(SepoliaEthToUdsPari);
    const proxyNftAuctionFactoryAddress=await NFTAuctionFactory.getAddress();
    console.log("✅ 拍卖管理工厂，合约地址：",proxyNftAuctionFactoryAddress);
    //创建一个拍卖合约试试

    //save to file
    const fs = require("fs");
    const deployDir = "./ignition/deployments"
    if (!fs.existsSync(deployDir)) {
        fs.mkdirSync(deployDir);
    }
    let deployData={
        "proxyNftAddress":proxyNftAddress,
        "sunNFTAbi":sunNFTAbi,
        "auctionTemplateAbi":auctionTemplateAbi,"proxyNftFactoryAddress":proxyNftAuctionFactoryAddress,"nfcFactoryAbi":nfcFactoryAbi};
    fs.writeFileSync(
        `${deployDir}/${hre.network.name}-suntoken-deployment.json`,
        JSON.stringify(deployData, null, 2)
    )
    return {SunNFTV1,proxyNftAddress,auctionTemplateAbi,NFTAuctionFactory,proxyNftAuctionFactoryAddress}
}

main().catch((error)=>{
    console.log(error);
    process.exitCode=1;
})

