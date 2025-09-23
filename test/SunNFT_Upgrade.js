const {expect} = require("chai");
const {ethers,upgrades} =require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("拍卖合约升级测试",function (){
    let owner,account1,account2;
    let SunNFT;
    const NFT_NAME="SunNFT";
    const NFT_SYMBOL="SNT"
    const NFT_MAX_SUPPLY=10000;
    const NFT_MIN_MINTPRICE=ethers.parseEther("0.01");
    const NFT_BASE_URI="ipfs://bafkreietqqvhn4jzk2cd2c2wzpy7wm37sxdvaspwvqmd27mhqsrrumxj34";
    const SepoliaUsdctoUsdPari="0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E";
    const SepoliaEthToUdsPari="0x694AA1769357215DE4FAC081bf1f309aDC325306";
    const SepoliaUSDCAddress ="0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
    let NFTAuctionFactory;
    let NFTAuctionV1;
    before(async ()=>{
        [owner,account1,account2] =await ethers.getSigners();
        console.log("owner地址：",owner.address)
        console.log("account1地址:",account1.address);
        //部署SunNFT
        const SunNFTV1=await ethers.getContractFactory("SunNFT",{
            signer:owner,
        });
        SunNFT = await upgrades.deployProxy(SunNFTV1,[NFT_NAME,NFT_SYMBOL,NFT_MAX_SUPPLY,NFT_MIN_MINTPRICE,NFT_BASE_URI],{ kind: "uups" });
        await SunNFT.waitForDeployment();
        const proxyNftAddress=await SunNFT.getAddress();
        console.log(NFT_NAME+" 合约部署完成，合约地址：",proxyNftAddress);
        const sunNftLogicAddress = await upgrades.erc1967.getImplementationAddress(proxyNftAddress);
        console.log(NFT_NAME+" 合约部署完成，真实逻辑地址：",sunNftLogicAddress);

        //搞一个模版
        const AuctionTemplate = await ethers.getContractFactory("SunNFTAuction");
        const template = await AuctionTemplate.deploy(); // 普通部署
        await template.waitForDeployment();
        console.log("模版合约地址：",await template.getAddress());
        //部署NFTAuctionFactory
        const auctionFactory =await ethers.getContractFactory("NFTAuctionFactory",{
            signer:owner,
        });
        NFTAuctionFactory =await upgrades.deployProxy(auctionFactory,[await template.getAddress()],{ kind: "uups" })
        await NFTAuctionFactory.waitForDeployment();
        //初始化设置喂价
        await NFTAuctionFactory.setChainPriceFeed(SepoliaUsdctoUsdPari);
        await NFTAuctionFactory.setEthToUsdPriceFee(SepoliaEthToUdsPari);
        console.log("喂价成功");
        const proxyNftAuctionFactoryAddress=await NFTAuctionFactory.getAddress();
        console.log("拍卖管理工厂，合约地址：",proxyNftAuctionFactoryAddress);
        const sunNftFactoryLogicAddress = await upgrades.erc1967.getImplementationAddress(proxyNftAuctionFactoryAddress);
        console.log("拍卖管理工厂，真实逻辑地址：",sunNftFactoryLogicAddress);
    });
    //日志数据解析
    function listenerSunNFTEvent(logs,eventName,callBack){
        for (var i=0;i<logs.length;i++){
            //ps: contract.interface.parseLog() 解析日志
            const log= SunNFT.interface.parseLog(logs[i]);
            if (log.name===eventName){
                callBack(log.args)
                break
            }
        }
    }
    function listenerFactoryAuctionEvent(logs,eventName,callBack){
        for (var i=0;i<logs.length;i++){
            console.log("log"+i);
            const log = logs[i];
            if(log.fragment){
                try {
                    callBack(NFTAuctionFactory.interface.decodeEventLog(eventName,log.data,log.topics));
                    break
                }catch (e){
                    // console.log(e);
                }
            }else {
                console.log(`索引 ${i} 是普通 Log 对象，跳过`);
            }
        }
    }
    let customTokenId;
    it("部署一个V1版本拍卖合约",async()=>{
        let testURI="ipfs://bafkreibhoqfa7scarqipywbl6gzgex447hhmkqz44hykhxclfjrbrs6y2i"
        const  tx= await SunNFT.mintNFT(owner,testURI);
        let  receiptTest= await tx.wait();
        listenerSunNFTEvent(receiptTest.logs,"EventMintSuccess", function (args){
            console.log("管理员铸造NFT成功, 回调：",args);
            let {user,tokenId,time} = args;
            customTokenId=tokenId;
        })
        console.log("铸造的NFC合约地址：",await SunNFT.getAddress());
        await SunNFT.connect(owner).approve(await NFTAuctionFactory.getAddress(),customTokenId);
        //1.创建拍卖
        const duration=BigInt(60);
        const miniPrice=ethers.parseEther("0.001");
        //创建的拍卖合约地址
        const nftAuctionAddressTx=await NFTAuctionFactory.connect(owner).createAuction(duration,miniPrice,await SunNFT.getAddress(),customTokenId);
        // console.log("工厂创建的合约地址：",nftAuctionAddressTx);
        receipt= await nftAuctionAddressTx.wait();
        let nftAuctionAddress;
        listenerFactoryAuctionEvent(receipt.logs,"EventAuctionCreated",await function (args){
            let [auctionProxy,_nftAddress,_tokenId,_timestamp] =args;
            nftAuctionAddress=auctionProxy;
            console.log("args:",args);
        })
        NFTAuctionV1 = await ethers.getContractAt("SunNFTAuction", nftAuctionAddress);
        console.log("V1拍卖合约实例加载成功,地址：",await NFTAuctionV1.getAddress());
        console.log("V1拍卖合约信息：",await NFTAuctionV1.getAuctionInfo());
        const sunNFTAuctionLogicAddress = await upgrades.erc1967.getImplementationAddress(await NFTAuctionV1.getAddress());
        console.log("V1拍卖合约实例加载成功,逻辑地址：",sunNFTAuctionLogicAddress);
    });

    it("第一版本代理合约验证",async()=>{
        expect(await NFTAuctionV1.version()).to.equal(1);
        // expect(await NFTAuctionV1.owner()).to.equal(await NFTAuctionFactory.getAddress());
    })

    it("升级V2拍卖合约",async()=>{
        //先搞一个V2版本的模版
        const AuctionTemplateV2 = await ethers.getContractFactory("SunNFTAuctionV2");
        const template = await AuctionTemplateV2.deploy(); // 普通部署
        await template.waitForDeployment();
        console.log("V2模版合约地址：",await template.getAddress());
        //NFTAuctionFactory更新，，后面创建的都是新版本的拍卖合约
        NFTAuctionFactory.updateTemplate(await template.getAddress());

        //通过工厂升级 代理地，V2合约实现，数据
        // const functionSignature = "initializeV2()";
        // const initSelector = ethers.id(functionSignature).slice(0, 10);
        // const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
        //     [],
        //     []
        // );
        // const initData = initSelector + encodedParams.slice(2);
        const v2Address = await template.getAddress();
        const code = await ethers.provider.getCode(v2Address);
        console.log("V2 合约代码是否存在：", code !== "0x"); // 应为 true

        const functionSignature = "initializeV2()";
        const initData = ethers.id(functionSignature).slice(0, 10);
        await NFTAuctionFactory.upgradeAuction(await NFTAuctionV1.getAddress(),await template.getAddress(),initData)
        console.log("升级成功")

        //验证结果1
        const proxyAuctionV2 = await ethers.getContractAt("SunNFTAuctionV2", await NFTAuctionV1.getAddress());
        console.log("升级后的V2地址:",await proxyAuctionV2.getAddress());
        console.log(await proxyAuctionV2.version());
        await proxyAuctionV2.setNewValue(11);
        const resp=await proxyAuctionV2.getNewValue();
        console.log("newValue1:",resp)
        const {price,d} =await proxyAuctionV2.getPricePair(ethers.ZeroAddress);
        console.log("price:",price);

        const orgData=await proxyAuctionV2.getAuctionInfo()
        console.log("升级后V1原来的拍卖合约数据：",orgData)

        let  user= await SunNFT.isOwnerTo(customTokenId);
        console.log("当前NFT所有者：",user);
        //检查归属是否变更（变更了说明存在问题）
        expect(await proxyAuctionV2.getAddress()).to.equal(user);

        //新铸造一个NFT
        let testURI="ipfs://bafkreibhoqfa7scarqipywbl6gzgex447hhmkqz44hykhxclfjrbrs6y2i"
        const  tx= await SunNFT.mintNFT(owner,testURI);
        let  receiptTest= await tx.wait();
        listenerSunNFTEvent(receiptTest.logs,"EventMintSuccess", function (args){
            console.log("管理员铸造NFT成功, 回调：",args);
            let {user,tokenId,time} = args;
            customTokenId=tokenId;
        })
        console.log("新铸造的NFC合约地址：",await SunNFT.getAddress());
        //授权给工厂
        await SunNFT.connect(owner).approve(await NFTAuctionFactory.getAddress(),customTokenId);
        user= await SunNFT.isOwnerTo(customTokenId);
        console.log("当前NFT所有者：",user);

        //验证结果2 通过合约工厂创建新合约是否为升级的
        const duration=BigInt(60);
        const miniPrice=ethers.parseEther("0.001");
        const nftAuctionAddressTx=await NFTAuctionFactory.createAuction(duration,miniPrice,await SunNFT.getAddress(),customTokenId)
        let receipt= await nftAuctionAddressTx.wait();
        let nftAuctionAddress;
        listenerFactoryAuctionEvent(receipt.logs,"EventAuctionCreated",await function (args){
            let [auctionProxy,_nftAddress,_tokenId,_timestamp] =args;
            nftAuctionAddress=auctionProxy;
            console.log("args:",args);
        })
        console.log("工厂创建的合约拍卖地址：",nftAuctionAddress);
        let NFTAuctionV2 = await ethers.getContractAt("SunNFTAuctionV2", nftAuctionAddress);
        console.log(await NFTAuctionV2.version());
        await NFTAuctionV2.setNewValue(12);
        const resp0=await NFTAuctionV2.getNewValue();
        console.log("newValue0:",resp0)


    })
});
