// 0x959e85561b3cc2E2AE9e9764f55499525E350f56
// USDC on Optimism
import { ethers } from "ethers";
import { arbProvider, optimismProvider } from "./providers";

// Deposit contract info
export const depositContractAddress = "0x959e85561b3cc2E2AE9e9764f55499525E350f56";
export const depositAbi = [
  // The 'bytes proof' parameter (currently redundant) could be used to enhance security.
  // Potential uses include:
  // - Verifying that the deposit was legitimately authorized by the sender (e.g., via a digital signature).
  // - Providing a Merkle proof that confirms the deposit is part of a larger, verified dataset.
  // - Supplying a zero-knowledge proof that validates specific conditions (like matching deposit parameters)
  //   without revealing sensitive information.
  // These approaches can help ensure that payouts from the backend are processed only when the deposit is valid.
  "event DepositProcessed(uint256 usdcAmount, address indexed depositor, address indexed recipient, bytes proof)",
];

// RBTC token contract info
export const arbTokenAddress = "0x912ce59144191c1204e64559fe8253a0e49e6548";
export const arbTokenAbi = [
  "function transfer(address recipient, uint256 amount) external returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

// Arb signer for payout (ensure your environment variable is set)
const ARB_PAYOUT_PRIVATE_KEY = process.env.ARB_PAYOUT_PRIVATE_KEY || "";
export const arbSigner = new ethers.Wallet(ARB_PAYOUT_PRIVATE_KEY, arbProvider);
export const arbTokenContract = new ethers.Contract(arbTokenAddress, arbTokenAbi, arbSigner);
