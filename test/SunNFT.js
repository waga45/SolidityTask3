const {expect} = require("chai");
const {ethers,upgrades} =require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("SunNFTAuction测试",function (){
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
    let NFTAuction;
    before(async()=>{
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
    })
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
    //1
    it("SunNFT铸造测试",async()=>{
        //1.1单个铸造
        let testURI="ipfs://bafkreibhoqfa7scarqipywbl6gzgex447hhmkqz44hykhxclfjrbrs6y2i"
        const  tx= await SunNFT.mintNFT(owner,testURI);
        const  receipt= await tx.wait();
        listenerSunNFTEvent(receipt.logs,"EventMintSuccess",async function (args){
            console.log("管理员铸造NFT成功, 回调：",args);

            //1.1.1 测试tokenId归属地址
            const getOwner=await SunNFT.isOwnerTo(args[1]);
            const result=await getOwner.wait();
            console.log(args[1]+" 归属人："+result);
        })

        //1.2批量铸造
        let uris=["ipfs://bafkreibhoqfa7scarqipywbl6gzgex447hhmkqz44hykhxclfjrbrs6y2i","ipfs://bafkreietqqvhn4jzk2cd2c2wzpy7wm37sxdvaspwvqmd27mhqsrrumxj34"]
        const txBatchMint = await SunNFT.batchMintNFT(owner,uris);
        const batchMintResult=await txBatchMint.wait();
        listenerSunNFTEvent(batchMintResult.logs,"EventBatchMintSuccess",function (args){
            console.log("管理员批量铸造NFT成功, 回调：",args);
        })

        //1.3用户花钱铸造
        const accountBalanceBefore=await ethers.provider.getBalance(account1);
        console.log("用户1铸造前余额：",ethers.formatEther(accountBalanceBefore));
        //
        let userPayMintTx= await SunNFT.connect(account1).mintPublic(testURI,{value:ethers.parseEther("0.1")});
        let userPayMintTxReceipt=await userPayMintTx.wait();
        listenerSunNFTEvent(userPayMintTxReceipt.logs,"EventMintSuccess",async function (args){
            console.log("用户1花销铸造NFT成功, 回调：",args);
            //1.3.1
            const accountBalanceAfter=await ethers.provider.getBalance(account1);
            console.log("用户1铸造后余额：",ethers.formatEther(accountBalanceAfter));
        })

        //1.4管理员调整最低铸造价 为1ETH
        const updatePrice=await SunNFT.connect(owner).setMintPrice(ethers.parseEther("1"));
        const updateResult=await updatePrice.wait();
        console.log("花销铸造价已经调整成功");
        //1.5再次铸造(设置价格不满足)
        userPayMintTx= await SunNFT.connect(account1).mintPublic(testURI,{value:ethers.parseEther("1")});
        userPayMintTxReceipt=await userPayMintTx.wait();
        listenerSunNFTEvent(userPayMintTxReceipt.logs,"EventMintSuccess",function (args){
            console.log("用户1花销铸造NFT成功, 回调：",args);
        })
    })
    //日志数据解析
    function listenerNFCAuctionEvent(logs,eventName,callBack){
        for (var i=0;i<logs.length;i++){
            console.log("log"+i);
            const log = logs[i];
            if(log.fragment){
                try {
                    callBack(NFTAuction.interface.decodeEventLog(eventName,log.data,log.topics));
                    break
                }catch (e){
                    console.log(e);
                }
            }else {
                console.log(`索引 ${i} 是普通 Log 对象，跳过`);
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
    it.only("SunNFTAuction拍卖场管理测试",async()=>{
        //0.跑一次铸造
        let testURI="ipfs://bafkreibhoqfa7scarqipywbl6gzgex447hhmkqz44hykhxclfjrbrs6y2i"
        const  tx= await SunNFT.mintNFT(owner,testURI);
        let  receiptTest= await tx.wait();
        let customTokenId;
        listenerSunNFTEvent(receiptTest.logs,"EventMintSuccess", function (args){
            console.log("管理员铸造NFT成功, 回调：",args);
            let {user,tokenId,time} = args;
            customTokenId=tokenId;
        })
        console.log("合约地址：",await SunNFT.getAddress());
        console.log("拍卖工厂地址：",await NFTAuctionFactory.getAddress());
        console.log("customTokenId：",customTokenId);
        //0.1 把NFT授权给拍卖合约--这个很重要
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
        console.log("工厂创建的合约拍卖地址：",nftAuctionAddress);
        const SunNFTAuctionAbi =await ethers.getContractFactory("SunNFTAuction");
        NFTAuction = await ethers.getContractAt("SunNFTAuction", nftAuctionAddress);
        console.log("拍卖合约实例加载成功,地址：",await NFTAuction.getAddress());
        const sunNFTAuctionLogicAddress = await upgrades.erc1967.getImplementationAddress(await NFTAuction.getAddress());
        console.log("拍卖合约实例加载成功,逻辑地址：",sunNFTAuctionLogicAddress);

        //2.用户1用ETH参与竞拍 正常出价
        let joinPrice=ethers.parseEther("0.001");
        const zeroAddress = ethers.ZeroAddress;
        const joinAuctionTx=await NFTAuction.connect(account1).joinAuction(joinPrice,zeroAddress,{value:joinPrice});
        receipt=await joinAuctionTx.wait();
        listenerNFCAuctionEvent(receipt.logs,"EventJoinAuction",async function (args){
            let [tokenId,beforeUser,beforePrice,joinUser,joinValue,timestamp] =args;
            console.log("用户1成功参与竞拍,回调:",args);
            //2.1 查询用户当前余额
            const userBalance=await ethers.provider.getBalance(account1);
            console.log("用户参与拍卖后余额：",ethers.formatEther(userBalance));
        })


        //3.查询拍卖活动信息
        const auctionInfoTx=await NFTAuction.getAuctionInfo();
        console.log("活动信息:",auctionInfoTx);
        //4.用户2用USDC参与竞拍
        const joinUsdcPrice=ethers.parseEther("1");
        const joinAuctionTx2=await NFTAuction.connect(account2).joinAuction(joinUsdcPrice,zeroAddress,{value:joinUsdcPrice});
        receipt=await joinAuctionTx2.wait();
        listenerNFCAuctionEvent(receipt.logs,"EventJoinAuction",async function (args){
            let [tokenId,beforeUser,beforePrice,joinUser,joinValue,timestamp] =args;
            console.log("用户2成功参与竞拍,回调:",args);
            //241 查询用户2当前余额
            const erc20Abi = ["function balanceOf(address) view returns (uint256)"];
            const usdcContract = new ethers.Contract(SepoliaUSDCAddress, erc20Abi, ethers.provider);
            const rawBalance = await usdcContract.balanceOf(joinUser);
            const formattedBalance = ethers.utils.formatUnits(rawBalance, 6);
            console.log(`用户2 USDC 余额：${formattedBalance}`);
        });
        //5.查询上一个出价用户金额是否退回
        const userBalance1=await ethers.provider.getBalance(account1);
        console.log("用户2参与拍卖后，用户1余额：",ethers.formatEther(userBalance1));
        const ownerBlance0=await ethers.provider.getBalance(owner);
        console.log("拍卖结束前owner余额:",ethers.formatEther(ownerBlance0))
        //6.结束拍卖，结算支付，转移所有权
        await time.increase(70);
        const endAuctionTx=await NFTAuction.endAuction();
        receipt=await endAuctionTx.wait();
        listenerNFCAuctionEvent(receipt.logs,"EventEndAuction",async function (args){
            let [tokenId,seller,highestBidder,highestBidPrice,timestamp] =args;
            console.log("拍卖活动结束,回调:",args);
            console.log("tokenId=",tokenId);
            console.log("seller=",seller);
            console.log("highestBidder=",highestBidder);
            console.log("highestBidPrice=",highestBidPrice);
            console.log("timestamp=",timestamp);
        })
        console.log("拍卖结束");
        //8.检查结果
        const ownerBlance=await ethers.provider.getBalance(owner);
        console.log("owner余额:",ethers.formatEther(ownerBlance))
        const  user= await SunNFT.isOwnerTo(customTokenId);
        console.log("当前NFT所有者：",user);
    })


})
