// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Any on-chain pool you add must implement this interface.
interface ILiquidityPool {
    /// @return amount of tokenOut you’d receive for swapping amountIn of tokenIn
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256);

    /// @return actual amount of tokenOut received
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minOut
    ) external returns (uint256);
}

contract MultiPoolSwapRouter {
    ILiquidityPool[] public pools;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Add a new pool to consider in routing
    function addPool(ILiquidityPool pool) external onlyOwner {
        pools.push(pool);
    }

    /// @notice Finds the best pool by output quote, then executes the swap there.
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minOut
    ) external {
        uint256 n = pools.length;
        require(n > 0, "No pools registered");

        // 1) find best pool
        uint256 bestOut = 0;
        uint256 bestIdx = 0;
        for (uint256 i = 0; i < n; i++) {
            uint256 out = pools[i].getAmountOut(tokenIn, tokenOut, amountIn);
            if (out > bestOut) {
                bestOut = out;
                bestIdx = i;
            }
        }
        require(bestOut >= minOut, "Insufficient output");

        ILiquidityPool chosen = pools[bestIdx];

        // 2) pull in tokens & approve pool
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(address(chosen), amountIn);

        // 3) execute swap
        uint256 amountOut = chosen.swap(tokenIn, tokenOut, amountIn, minOut);

        // 4) return output
        IERC20(tokenOut).transfer(msg.sender, amountOut);
    }
}
