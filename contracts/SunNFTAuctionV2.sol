// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "./SunNFTAuction.sol";

contract SunNFTAuctionV2 is SunNFTAuction {
    uint256 newValue;

    function initializeV2() external{
        require(version == 1, "V2 already initialized");
        version=2;
    }

    //升级原有的获取喂价函数
    function getPricePair(address pairAddress) public view override returns(int256,uint8){
        return (int256(10000000000),8);
    }

    function setNewValue(uint256 value) external  {
        newValue=value;
    }

    function getNewValue() external view returns(uint256) {
        return newValue;
    }
}
