// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./IAuctionFactory.sol";
import "./ISunNFTAuction.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

//拍卖管理
//1.开启拍卖
//2.参与竞拍
//3.拍卖结束-支付结算-转移拍品
contract SunNFTAuction is Initializable,UUPSUpgradeable,ISunNFTAuction{
    uint256 public constant DECIMALS = 18;
    uint256 public constant ONE = 10**DECIMALS;
    uint256 public version;
    struct Action{
        address seller;//卖家
        uint256 startTime;//开始时间
        uint256 duration;//持续时间 s
        uint256 startPrice; //起拍价
        bool ended; //是否结束
        address highestBidder;//当前最高出价人
        uint256 highestBidPrice;//当前最高出价
        uint256 tokenId;//NFT ID
        address contractAddr; //合约地址
        address tokenAddres;//其他ERC20标准代币
        uint256 usdPrice;//出价当时USD价值
    }
    //拍卖ID->获得信息映射
    Action private auction;
    address private factoryAddress;
    //拍卖合约工厂
    IAuctionFactory private  factoryInterface;
    //管理员
    address admin;
    //事件
    event EventUpgraded(address newImplementation,uint256 timestamp);
    //成功参与竞价t通知 NFTID 上一个最高出价者，上一个最高出价金额，现在最高出价者,最高出价金额，参与竞拍时间
    event EventJoinAuction(uint256 indexed tokenId,address beforeUser,uint256 beforePrice,address user,uint256 joinPrice,uint256 timestamp);
    //拍卖结束通知 NFTID/售卖者/购买者/成交价/成交时间
    event EventEndAuction(uint256 indexed tokenId,address seller,address highestBid,uint256 dealAmount,uint256 timestamp);
    event EventCreateSuccess(address user,uint256 indexed auctionId,uint256 timestamp);

    constructor() {
        _disableInitializers();
    }
    modifier existToken(){
        require(auction.tokenId>=0,"auction not exist");
        _;
    }
    modifier isFactory(){
        require(msg.sender==factoryAddress,"sender!=owner");
        _;
    }
    //合约工厂模式-这里有工厂进行部署初始化
    function initialize(address _factory,address _admin) external initializer{
        __UUPSUpgradeable_init();
        admin= _admin;
        factoryAddress=_factory;
        factoryInterface = IAuctionFactory(_factory);
        version=1;
    }

    //1.创建拍卖
    function createAuction(address _seller,uint256 _duration,uint256 _miniPrice,address _nftAddress,uint256 _tokenId) external isFactory {
        auction=Action({
        seller: _seller,
        duration: _duration,
        startPrice: _miniPrice,
        ended: false,
        highestBidder: address(0),
        highestBidPrice:0,
        startTime:block.timestamp,
        tokenId: _tokenId,
        contractAddr:_nftAddress,
        tokenAddres:address(0),
        usdPrice:0
        });
    }

    //2.参与竞拍（支持ETH/ERC20代币  这里需要考虑汇率浮动以及结算问题 以最高价本币结算，或者以统一度量USD结算处理方式都不一样）
    //因为msg.value 无法处理除ETH以外的token，所以入参处理下
    //这里暂时只做以最高价的本币结算，要求_erc20TokenAddress必须传，客户端提供ETH  USDC选项，这里统一用USD作为度量
    function joinAuction(uint256 amount,address _erc20TokenAddress) public payable existToken {
        require(msg.sender!=address(0));
        require(block.timestamp>=auction.startTime && block.timestamp<=auction.startTime+auction.duration,"error:the auction time corrent");
        require(auction.ended==false,"auction.ended=true");

        address beforeHighestBidder=auction.highestBidder;
        uint256 beforePrice = auction.highestBidPrice;
        if(_erc20TokenAddress!=address(0)){
            //使用ERC20代币
            require(amount>0, "join amount<=0");
            (int tokenUsdPriceFee,uint256 decimals) = getPricePair(_erc20TokenAddress);
            require(tokenUsdPriceFee > 0, "tokenUsdPriceFee <= 0");
            uint256 tokenUsdPrice = (amount * uint256(tokenUsdPriceFee))/(10** decimals);//当前出价
            if(auction.highestBidder==address(0)){
                //第一次出价格
                (int ethFee,uint8 d) = getPricePair(address(0));
                uint256 miniPriceUsdPrice =(auction.startPrice*uint256(ethFee))/(10** d);
                require(tokenUsdPrice>=miniPriceUsdPrice, "tokenUsdPrice<miniPriceUsdPrice");
            }
            (int beforeTokenUsdPriceFee,uint8 beforeDecimals) = getPricePair(auction.tokenAddres);
            uint256 beforeHighestPirceUsd=(auction.highestBidPrice*uint256(beforeTokenUsdPriceFee))/(10** beforeDecimals);
            require(tokenUsdPrice>beforeHighestPirceUsd, "tokenUsdPrice<=beforeHighestPirceUsd");
            //退回
            if(auction.tokenAddres==address(0)){
                (bool success,) = payable(auction.highestBidder).call{value:auction.highestBidPrice}("");
                require(success, "revert before highestBidPrice failed!");
            }else {
                IERC20(auction.tokenAddres).transfer(auction.highestBidder,auction.highestBidPrice);
            }
            auction.highestBidder=msg.sender;
            auction.highestBidPrice=amount;
            auction.usdPrice=tokenUsdPrice;
            auction.tokenAddres=_erc20TokenAddress;

            emit EventJoinAuction(auction.tokenId,beforeHighestBidder,beforePrice,msg.sender,amount,block.timestamp);
        }else {
            //使用ETH参与竞拍,判断一下amount
            require(amount==msg.value,"amount!=value");
            (int256 ethFee,uint8 d) = getPricePair(address(0));
            uint256 miniPriceUsdPrice =(auction.startPrice*uint256(ethFee))/(10** d);
            uint256 auctionUsdAmount=(msg.value*uint256(ethFee))/(10** d);
            console.log("startPrice:",auction.startPrice);
            console.log("auctionUsdAmount:",auctionUsdAmount);
            console.log("miniPriceUsdPrice:",miniPriceUsdPrice);
            require(auctionUsdAmount>=miniPriceUsdPrice, "value<miniPriceUsdPrice");

            if(auction.highestBidder==address(0)){
                auction.highestBidder=msg.sender;
                auction.highestBidPrice=msg.value;
                auction.usdPrice=auctionUsdAmount;
            }else {
                (int256 beoforeTokenFee,uint8 decimals)=getPricePair(auction.tokenAddres);
                require(beoforeTokenFee>0,"beoforeTokenFee<=0");
                uint256 beforeTokenUsdPrice=(auction.highestBidPrice*uint256(beoforeTokenFee))/(10** decimals);
                require(auctionUsdAmount>beforeTokenUsdPrice, "auctionUsdAmount<beforeTokenUsdPrice");
                //退回上一个
                if(auction.tokenAddres==address(0)){
                    (bool success,) = payable(auction.highestBidder).call{value:auction.highestBidPrice}("");
                    require(success, "revert before highestBidPrice failed!");
                }else {
                    IERC20(auction.tokenAddres).transfer(auction.highestBidder,auction.highestBidPrice);
                }
                auction.highestBidder=msg.sender;
                auction.highestBidPrice=msg.value;
                auction.usdPrice=auctionUsdAmount;
            }
            //nofity
            emit EventJoinAuction(auction.tokenId,beforeHighestBidder,beforePrice,msg.sender,msg.value,block.timestamp);
        }
    }


    //3.拍卖结束-支付结算-转移拍品
    function endAuction() external existToken {
        require(msg.sender!=address(0),"not allowed process");
        require(msg.sender==auction.seller,"not permission");
        require(auction.ended==false,"auction.ended=true");
        require(block.timestamp>auction.startTime+auction.duration,"havent ending");
        //如果没人参与，直接结束，把NFT在退回给参与者
        if(auction.highestBidder==address(0)){
            auction.ended=true;
            //转回
            IERC721(auction.contractAddr).transferFrom(address(this),auction.seller,auction.tokenId);
            return;
        }
        //转移NFT所有权给最高出价人
        IERC721(auction.contractAddr).transferFrom(address(this),auction.highestBidder,auction.tokenId);
        //扣除手续费后金额转给NFT发起人
        uint256 rateFee=factoryInterface.getRateFee();
        uint256 fee= (auction.highestBidPrice*rateFee)/ONE;
        uint256 sellAmount=auction.highestBidPrice-fee;
        if(auction.tokenAddres==address(0)){
            //如果是eth本币
            (bool success,)=auction.seller.call{value: sellAmount }("");
            require(success, "Failed call to seller");
            (bool success1,)=payable(admin).call{value:fee}("");
            require(success1, "Failed call fee to owner");
        }else {
            //ERC20代币
            bool suc=IERC20(auction.tokenAddres).transfer(auction.seller,sellAmount);
            require(suc, "Failed to erc20 to seller");
            suc = IERC20(auction.tokenAddres).transfer(admin,fee);
            require(suc, "Failed to erc20 to owner");
        }
        emit EventEndAuction(auction.tokenId,auction.seller,auction.highestBidder,auction.highestBidPrice,block.timestamp);
    }

    //获取详细
    function getAuctionInfo() public view returns(Action memory) {
        return auction;
    }

    //获取币对价格
    function getPricePair(address pairAddress) public view virtual returns(int256,uint8){
        AggregatorV3Interface priceFeed = factoryInterface.getPriceFeed(pairAddress);
        (/*uint80 roundID*/,int256 price,/*uint startedAt*/,/*uint timeStamp*/,/*uint80 answeredInRound*/) = priceFeed.latestRoundData();
        return (price,priceFeed.decimals());
    }

    //升级权限
    function _authorizeUpgrade(address newImplementation) internal override {
        require(
            msg.sender == factoryAddress || msg.sender == admin,
            "Only factory or owner can upgrade"
        );
        emit EventUpgraded(newImplementation,block.timestamp);
    }
}
