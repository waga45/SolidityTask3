// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface ISunNFTAuction {
    function initialize(address _factory,address _admin) external;
    function createAuction(address _seller,uint256 _duration,uint256 _miniPrice,address _nftAddress,uint256 _tokenId) external;
}
