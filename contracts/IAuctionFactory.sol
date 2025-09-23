// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
error OnlyOwner();
error OnlyFactory();
interface IAuctionFactory {
    function getPriceFeed(address pairAddress) external view returns(AggregatorV3Interface);
    function getRateFee() external pure returns(uint256);
}
