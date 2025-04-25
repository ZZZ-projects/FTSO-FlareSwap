// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFtsoRegistry {
  /// @notice Every feed’s numeric ID + symbol
  function getSupportedIndicesAndSymbols()
    external
    view
    returns (uint256[] memory indices, string[] memory symbols);

  /// @notice For a given symbol, latest (price, timestamp, decimals)
  function getCurrentPriceWithDecimals(string calldata symbol)
    external
    view
    returns (
      uint256 price,
      uint256 timestamp,
      uint256 decimals
    );
}
