 // SPDX-License-Identifier: MIT
 pragma solidity ^0.8.25;

 import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
 import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston/ContractRegistry.sol";
 import {IJsonApi}        from "@flarenetwork/flare-periphery-contracts/coston/IJsonApi.sol";

 interface ISwapRouter {
   function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut) external;
 }

 contract DynamicSlippageSwapper {
     ISwapRouter public immutable router;

     constructor(ISwapRouter _router) {
         router = _router;
     }

     function swapWithDynamicSlippage(
         address tokenIn,
         address tokenOut,
         uint256 amountIn,
         IJsonApi.Proof calldata data
     ) external {
         require(_verifyJson(data), "Bad JSON proof");

         uint256 maxSlippageBps = abi.decode(data.data.responseBody.abi_encoded_data, (uint256));
         uint256 currentRate   = _getOnChainRate(tokenIn, tokenOut);
         uint256 minOut        = (amountIn * currentRate * (10_000 - maxSlippageBps)) / 10_000;

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        IERC20(tokenIn).approve(address(router), amountIn);

         router.swap(tokenIn, tokenOut, amountIn, minOut);
     }

     function _verifyJson(IJsonApi.Proof calldata proof) internal view returns (bool) {
         return ContractRegistry.auxiliaryGetIJsonApiVerification().verifyJsonApi(proof);
     }

     function _getOnChainRate(address, address) internal view returns (uint256) {
         return 1e18; // placeholder
     }
 }
