const {ethers,upgrades} = require("hardhat");
const fs = require("fs");
require("dotenv").config();
//更新部署V2
async function main(){
    const [deployer] = await ethers.getSigners();
    console.log("部署者地址:", deployer.address);
    const deploymentInfo = JSON.parse(
        fs.readFileSync(`ignition/deployments/${hre.network.name}-suntoken-deployment.json`, 'utf8')
    );
    console.log("V1 deployedInfo：",deploymentInfo);
    let {proxyNftAddress,sunNFTAbi,auctionTemplateAbi,proxyNftFactoryAddress,nfcFactoryAbi} = deploymentInfo;
    //升级拍卖工厂
    //新版的合约模版
    const AuctionTemplateV2 = await ethers.getContractFactory("SunNFTAuctionV2");
    const templateV2 = await AuctionTemplateV2.deploy(); // 普通部署
    await templateV2.waitForDeployment();
    console.log("V2模版拍卖合约地址：",await templateV2.getAddress());
    const nftFactory=new ethers.Contract(proxyNftFactoryAddress,nfcFactoryAbi,deployer);
    //开始升级
    console.log("开始升级拍卖合约...")
    nftFactory.updateTemplate(await templateV2.getAddress())
    //升级哪个拍卖合约地址.,这里取第一个测试，全部升级的话gas费消耗大,如果暂时没合约就不用升级了，上面最新模版已经替换过去了
    const auctionNum = await nftFactory.getNftAuctionCount()
    if(auctionNum>0){
        const auctionAddress=await nftFactory.getNftAuctionAt(0)
        const functionSignature = "initializeV2()";
        const initData = ethers.id(functionSignature).slice(0, 10);
        await nftFactory.upgradeAuction(auctionAddress,await templateV2.getAddress(),initData)
        console.log("升级成功")
    }
    console.log("upgrade finished")
}
main().catch((error)=>{
    console.log(error);
    process.exitCode=1;
})
