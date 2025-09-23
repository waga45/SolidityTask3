// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
//SunNFT
contract SunNFT is Initializable,ERC721Upgradeable,ERC721URIStorageUpgradeable,UUPSUpgradeable,OwnableUpgradeable{
    //最大发行量
    uint256 public MaxSupply;
    //最基础URI
    string private BASE_URI;
    //当前ID
    uint256 public NEXT_ID;
    //公开铸造最低费用
    uint256 public MINT_PRICE;
    //用户tokenId记录
    using EnumerableSet for EnumerableSet.UintSet;
    mapping(address=>EnumerableSet.UintSet) private userToTokens;
    //事件
    event EventUpgraded(address newImplementation,uint256 timestamp);
    event EventMintSuccess(address to,uint256 tokenId,uint256 timestamp);
    event EventBatchMintSuccess(address to,uint256[] tokenIds,uint256 timestamp);


    function initialize(string memory _name,string memory _symbol,uint256 _maxSupply, uint256 _minMintPrice,string memory baseURI)public initializer {
        __ERC721_init(_name,_symbol);
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ERC721URIStorage_init();
        MaxSupply=_maxSupply;
        BASE_URI=baseURI;
        MINT_PRICE= _minMintPrice;
        NEXT_ID=0;
    }
    receive() external payable{}

    //0.铸造
    function mintNFT(address to,string memory uri) external onlyOwner{
        require(to!=address(0),"address not avlidate");
        require(NEXT_ID<=MaxSupply,"mint failed,max supply limited");
        uint256 tokenId=NEXT_ID;
        _safeMint(to,tokenId);
        _setTokenURI(tokenId,uri);
        userToTokens[msg.sender].add(tokenId);
        NEXT_ID+=1;
        emit EventMintSuccess(to,tokenId,block.timestamp);
    }

    //1.批量铸造
    function batchMintNFT(address to,string[] memory tokenUris) external onlyOwner{
        require(to!=address(0),"address not avlidate");
        require(NEXT_ID+tokenUris.length<=MaxSupply,"mintBatch failed,max supply limited");
        uint256[] memory ids=new uint256[](tokenUris.length);
        for (uint256 i=0;i<tokenUris.length;i++){
            uint256 tokenId=NEXT_ID;
            _safeMint(to,tokenId);
            _setTokenURI(tokenId,tokenUris[i]);
            userToTokens[to].add(tokenId);
            ids[i]=tokenId;
            NEXT_ID+=1;
        }
        emit EventBatchMintSuccess(to,ids,block.timestamp);
    }

    //2.用户自己花钱铸造
    function mintPublic(string memory uri) public payable{
        require(NEXT_ID<=MaxSupply,"mint failed,max supply limited");
        require(msg.value>0&&msg.value>=MINT_PRICE,"mint failed,price must be fulfil min_price");
        uint256 tokenId=NEXT_ID;
        _safeMint(msg.sender,tokenId);
        _setTokenURI(tokenId,uri);
        userToTokens[msg.sender].add(tokenId);
        NEXT_ID+=1;
        emit EventMintSuccess(msg.sender,tokenId,block.timestamp);
    }

    //3.设置最低铸造价
    function setMintPrice(uint256 price)public returns(bool){
        require(price>MINT_PRICE,"update minit price fail,must big than current price");
        MINT_PRICE = price;
        return true;
    }

    //4.查看归属
    function isOwnerTo(uint256 tokenId) public view returns(address){
        return super._ownerOf(tokenId);
    }

    //5.获取地址所有铸造的tokenId列表
    function getUserTokenIdList(address user) external view returns(uint256[] memory){
        return userToTokens[user].values();
    }

    //升级权限
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        emit EventUpgraded(newImplementation,block.timestamp);
    }

    //重写1
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721Upgradeable, ERC721URIStorageUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
    //重写2
    function tokenURI(uint256 tokenId) public view override(ERC721Upgradeable,ERC721URIStorageUpgradeable)  returns (string memory){
        return super.tokenURI(tokenId);
    }
}
