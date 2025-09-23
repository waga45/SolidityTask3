// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./ISunNFTAuction.sol";
import "./IAuctionFactory.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";


//工厂管理-负责创建
contract NFTAuctionFactory is Initializable,UUPSUpgradeable,IAuctionFactory{
    //记录  NFT合约地址-->{tokenId=>NFTAuction}
    mapping(address=>mapping(uint256=>address)) public auctionForNFT;
    address[] public allAuctions;
    address owner;
    //币对喂价
    mapping(address=>AggregatorV3Interface) chainPriceFeed;
    // 拍卖模板地址
    address public auctionTemplate;
    event EventUpgraded(address newImplementation,uint256 timestamp);
    event EventAuctionCreated(address auctionAddress,address nftAddress,uint256 tokenId,uint256 timestamp);
    //deploy

    function initialize(address _auctionTemplate) public initializer{
        __UUPSUpgradeable_init();
        owner=msg.sender;
        auctionTemplate=_auctionTemplate;
    }

    //创建拍卖场 anyone can invoke
    function createAuction(
        uint256 _duration,
        uint256 _miniPrice,
        address _nftAddress,
        uint256 _tokenId
    ) public returns(address){
        require(msg.sender!=address(0));
        require(_duration>=60, "_duration<60");
        require(_miniPrice>0,"_miniPrice<0");
        require(IERC721(_nftAddress).ownerOf(_tokenId)==msg.sender, "no permission");
        //是否已经授权
        require(
            IERC721(_nftAddress).isApprovedForAll(msg.sender, address(this)) ||
            IERC721(_nftAddress).getApproved(_tokenId) == address(this),
            "not approved nft"
        );
        //这里通过UUPS，所以不用最小代理
        ERC1967Proxy proxy=new ERC1967Proxy(auctionTemplate,"");
        ISunNFTAuction(address(proxy)).initialize(address(this),owner);
        //转移NFT所有权(当前_seller必须拥有所有全)
        IERC721(_nftAddress).transferFrom(msg.sender,address(proxy),_tokenId);
        //创建
        ISunNFTAuction(address(proxy)).createAuction(msg.sender,_duration, _miniPrice, _nftAddress, _tokenId);
        auctionForNFT[_nftAddress][_tokenId]=address(proxy);
        allAuctions.push(address(proxy));
        emit EventAuctionCreated(address(proxy),_nftAddress,_tokenId,block.timestamp);
        return address(proxy);
    }
    //添加设置币对
    function setChainPriceFeed(address pairAddress) external {
        require(pairAddress!=address(0));
        if (msg.sender != owner) revert OnlyOwner();
        chainPriceFeed[pairAddress]=AggregatorV3Interface(pairAddress);
    }

    //单独设置基ETH本币
    function setEthToUsdPriceFee(address ethToUsdAddress) external{
        if (msg.sender != owner) revert OnlyOwner();
        chainPriceFeed[address(0)]=AggregatorV3Interface(ethToUsdAddress);
    }

    //实现
    function getPriceFeed(address _pariAddress) external view returns(AggregatorV3Interface){
        return chainPriceFeed[_pariAddress];
    }
    function getRateFee() external pure  returns(uint256){
        return 1e16;
    }
    //拍卖合约地址
    function getAuction(address nftContractAddress,uint256 tokenId) external view returns(address){
        return auctionForNFT[nftContractAddress][tokenId];
    }
    //设置新模版，用户合约升级
    function updateTemplate(address newTemplate) external {
        if (msg.sender != owner) revert OnlyOwner();
        auctionTemplate = newTemplate; // 后续新部署的代理会使用这个新模板
    }

    //升级拍卖合约
    function upgradeAuction(address proxy,address newImplementation, bytes calldata data) external {
        if (msg.sender != owner) revert OnlyOwner();
        (bool success, bytes memory returnData) =proxy.call(
            abi.encodeWithSignature(
                "upgradeToAndCall(address,bytes)", newImplementation,data
            )
        );
        if (!success) {
            // 直接回滚并输出详细错误
            revert(string(returnData));
        }
    }
    //升级权限
    function _authorizeUpgrade(address newImplementation) internal override {
        if (msg.sender != owner) revert OnlyOwner();
        emit EventUpgraded(newImplementation,block.timestamp);
    }
}
