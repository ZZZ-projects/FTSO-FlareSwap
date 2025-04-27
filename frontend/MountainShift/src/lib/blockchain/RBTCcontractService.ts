import { ethers } from "ethers";
import { arbProvider, optimismProvider } from "./providers";

// V2 Contract for Rootstock!!!  
// RBTC deposits tracked & logged for backend execution—NO direct swaps!!!  
// Users deposit RBTC, backend handles ARB payout post-validation.

// Deposit contract info
export const depositContractAddress = "0xf0f994B4A8dB86A46a1ed4f12263c795b26703Ca";
export const depositAbi = [
  // The 'bytes proof' parameter (currently redundant) could be used to enhance security.
  // Potential uses include:
  // - Verifying that the deposit was legitimately authorized by the sender (e.g., via a digital signature).
  // - Providing a Merkle proof that confirms the deposit is part of a larger, verified dataset.
  // - Supplying a zero-knowledge proof that validates specific conditions (like matching deposit parameters)
  //   without revealing sensitive information.
  // These approaches can help ensure that payouts from the backend are processed only when the deposit is valid.
  "event DepositProcessed(uint256 rbtcAmount, address indexed depositor, address indexed recipient, bytes proof)",
];

// RBTC token contract info
export const arbTokenAddress = "0x0000000000000000000000000000000001000006";
export const arbTokenAbi = [
  "function transfer(address recipient, uint256 amount) external returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

// Arb signer for payout (ensure your environment variable is set)
const ARB_PAYOUT_PRIVATE_KEY = process.env.ARB_PAYOUT_PRIVATE_KEY || "";
export const arbSigner = new ethers.Wallet(ARB_PAYOUT_PRIVATE_KEY, arbProvider);
export const arbTokenContract = new ethers.Contract(arbTokenAddress, arbTokenAbi, arbSigner);
