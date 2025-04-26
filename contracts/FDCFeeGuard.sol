 // SPDX-License-Identifier: MIT
 pragma solidity ^0.8.25;

 import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
 import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston/ContractRegistry.sol";
 import {IPayment}         from "@flarenetwork/flare-periphery-contracts/coston/IPayment.sol";

 interface ISwapRouter {
   function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut) external;
 }

 contract SwapWithFeeGuard {
     ISwapRouter public immutable router;

     constructor(ISwapRouter _router) {
         router = _router;
     }

     function swapWithFee(
         address tokenIn,
         address tokenOut,
         uint256 amountIn,
         uint256 minOut,
         IPayment.Proof calldata paymentProof,
         uint256 feeAmount
     ) external {
         require(_verifyPayment(paymentProof, feeAmount), "Fee proof invalid");

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        IERC20(tokenIn).approve(address(router), amountIn);

         router.swap(tokenIn, tokenOut, amountIn, minOut);
     }

     function _verifyPayment(IPayment.Proof calldata proof, uint256 expectedAmount) internal view returns (bool) {
         if (!ContractRegistry.getFdcVerification().verifyPayment(proof)) return false;
         return proof.data.responseBody.spentAmount == int256(expectedAmount);
     }
 }
