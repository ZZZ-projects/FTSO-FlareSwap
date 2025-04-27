// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import { IPriceSubmitter } from "./interfaces/IPriceSubmitter.sol";
import { IFtsoRegistry }   from "./interfaces/IFtsoRegistry.sol";

contract FTSOConsumer is Ownable, Pausable {
    /// @notice Address of the FTSO price submitter on Coston 2
    address private constant PRICE_SUBMITTER =
        0x1000000000000000000000000000000000000003;

    /// @notice Maximum age of a price update before it is considered stale
    uint256 public constant MAX_STALE = 5 minutes;

    /// @notice Emitted after a successful batch fetch
    event PriceBatchFetched(
        bytes32[] symbols,
        uint256[] prices,
        uint256[] timestamps
    );

    /// @dev Helper to fetch the registry instance
    function _registry() internal view returns (IFtsoRegistry) {
        return IFtsoRegistry(
            IPriceSubmitter(PRICE_SUBMITTER).getFtsoRegistry()
        );
    }

    /**
     * @notice Fetch all supported FTSO price feeds, revert if any are stale or zero,
     *         and normalize all prices to 18 decimals.
     * @dev This function is non‐view so it can emit an event; it honors `whenNotPaused`.
     * @return symbols   Array of asset symbols (as `bytes32`)  
     * @return prices    Array of prices, each scaled to 18 decimals  
     * @return timestamps Array of UNIX timestamps for each price  
     */
    function fetchAllFeeds()
        external
        whenNotPaused
        returns (
            bytes32[] memory symbols,
            uint256[] memory prices,
            uint256[] memory timestamps
        )
    {
        // 1) Get the list of supported symbols
        (uint256[] memory indices, string[] memory syms) =
            _registry().getSupportedIndicesAndSymbols();
        uint256 n = indices.length;

        symbols    = new bytes32[](n);
        prices     = new uint256[](n);
        timestamps = new uint256[](n);

        // 2) Loop and pull each price
        for (uint256 i = 0; i < n; i++) {
            (uint256 rawPrice, uint256 ts, uint256 dec) =
                _registry().getCurrentPriceWithDecimals(syms[i]);

            require(rawPrice > 0, "FTSOConsumer: zero price");
            require(
                block.timestamp - ts <= MAX_STALE,
                "FTSOConsumer: stale price"
            );

            // normalize to 18 decimals
            prices[i] = rawPrice * (10**(18 - dec));
            timestamps[i] = ts;

            // convert symbol string to bytes32 (must be ≤32 bytes)
            symbols[i] = bytes32(bytes(syms[i]));
        }

        emit PriceBatchFetched(symbols, prices, timestamps);
    }

    /// @notice Pause price‐reading (for emergency or maintenance)
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause once everything is back to normal
    function unpause() external onlyOwner {
        _unpause();
    }
}
