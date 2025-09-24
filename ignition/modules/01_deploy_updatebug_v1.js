const {ethers,upgrades} = require("hardhat");

require("dotenv").config();
//NFT不重新部署，只更新拍卖合约
async function main(){
    // 获取部署者账户
    const [deployer] = await ethers.getSigners();
    console.log("部署者地址:", deployer.address);
    const fs = require("fs");
    const deploymentInfo = JSON.parse(
        fs.readFileSync(`ignition/deployments/${hre.network.name}-suntoken-deployment.json`, 'utf8')
    );
    console.log("V1 deployedInfo：",deploymentInfo);
    let {proxyNftAddress,sunNFTAbi,auctionTemplateAbi,proxyNftFactoryAddress,nfcFactoryAbi} = deploymentInfo;

    //部署工厂
    const AuctionTemplate = await ethers.getContractFactory("SunNFTAuction");
    const template = await AuctionTemplate.deploy(); // 普通部署
    await template.waitForDeployment();
    const auctionTemplateArtifact = await hre.artifacts.readArtifact("SunNFTAuction");
    auctionTemplateAbi = auctionTemplateArtifact.abi;
    console.log("模版合约地址：",await template.getAddress());
    //修改后合约模版
    const nftFactory=new ethers.Contract(proxyNftFactoryAddress,nfcFactoryAbi,deployer);
    console.log("工厂：",await nftFactory.getAddress());
    //开始升级
    console.log("开始升级拍卖合约...")
    nftFactory.updateTemplate(await template.getAddress())

    const deployDir = "./ignition/deployments"
    if (!fs.existsSync(deployDir)) {
        fs.mkdirSync(deployDir);
    }
    fs.writeFileSync(
        `${deployDir}/${hre.network.name}-suntoken-deployment.json`,
        JSON.stringify({proxyNftAddress,sunNFTAbi,auctionTemplateAbi,proxyNftFactoryAddress,nfcFactoryAbi}, null, 2)
    )
    return deploymentInfo

}

main().catch((error)=>{
    console.log(error);
    process.exitCode=1;
})
