import { ethers } from "ethers";

export const optimismProvider = new ethers.JsonRpcProvider(
  process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io"
);

export const arbProvider = new ethers.JsonRpcProvider(
  process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc"
);
