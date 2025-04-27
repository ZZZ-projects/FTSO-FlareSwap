// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPriceSubmitter {
  /// @notice Returns the address of the FTSO registry contract
  function getFtsoRegistry() external view returns (address);
}
