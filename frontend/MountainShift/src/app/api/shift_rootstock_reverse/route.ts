// src/app/api/shift_rootstock_reverse/route.ts

import { NextResponse } from "next/server";
import { ethers, type TransactionResponse } from "ethers";
import BigNumber from "bignumber.js";
// adjust this path to match your repo
import { depositAbi } from "../../../lib/blockchain/contractService";

// 1) Rootstock provider & payout wallet
const provider = new ethers.JsonRpcProvider(process.env.ROOTSTOCK_RPC_URL);
const payoutWallet = new ethers.Wallet(
  process.env.ROOTSTOCK_PRIVATE_KEY!,
  provider
);

// 2) Deposit contract address (where front end sent RBTC)
const depositContractAddress = "0xf0f994B4A8dB86A46a1eD4F12263c795b26703Ca";

// 3) USDC on RSK
const USDC_ADDRESS = "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85";
const USDC_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

// 4) Minimal interface so TS knows about transfer(...)
interface IERC20 {
  transfer(to: string, amount: bigint): Promise<TransactionResponse>;
  decimals(): Promise<number>;
}

export async function POST(req: Request) {
  try {
    const { txHash, rbtcAmount, destination, predictedUsdcAmount } =
      await req.json();

    if (
      !txHash ||
      parseFloat(rbtcAmount) <= 0 ||
      !ethers.isAddress(destination)
    ) {
      return NextResponse.json({ error: "invalid input" }, { status: 400 });
    }

    // fetch the on‐chain deposit receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return NextResponse.json({ error: "txn not found" }, { status: 400 });
    }

    // decode DepositProcessed event
    const iface = new ethers.Interface(depositAbi);
    let found = false;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed.name === "DepositProcessed") {
          found = true;
          break;
        }
      } catch {}
    }
    if (!found) {
      return NextResponse.json(
        { error: "DepositProcessed event not found" },
        { status: 400 }
      );
    }

    // fetch BTC→USDC price
    const priceRes = await fetch(new URL("/api/btc_pricing", req.url));
    const priceJson = await priceRes.json();
    if (priceJson.error) throw new Error(priceJson.error);
    const btcInUsdc = new BigNumber(priceJson.btcInUsdc);

    // compute payout = min(computed, user-predicted) * 0.99
    const computed = new BigNumber(rbtcAmount).multipliedBy(btcInUsdc);
    const userPred = new BigNumber(predictedUsdcAmount);
    const chosen = computed.isLessThan(userPred) ? computed : userPred;
    const finalUsdc = chosen.multipliedBy(0.99);

    // prepare USDC contract
    const baseUsdc = new ethers.Contract(
      USDC_ADDRESS,
      USDC_ABI,
      provider
    );
    // connect payout wallet, then tell TS this has IERC20 methods returning TransactionResponse
    const usdcWithSigner = (baseUsdc
      .connect(payoutWallet) as unknown) as IERC20;

    // amount in units
    const dec = await usdcWithSigner.decimals();
    const units = ethers.parseUnits(finalUsdc.toFixed(dec), dec);

    // send USDC and wait
    const transferTx = await usdcWithSigner.transfer(destination, units);
    const finalReceipt = await (transferTx as TransactionResponse).wait();

    return NextResponse.json({
      success: true,
      finalUsdc: finalUsdc.toFixed(dec),
      finalTxHash: transferTx.hash,
    });
  } catch (err: any) {
    console.error("shift_rootstock_reverse error:", err);
    return NextResponse.json(
      { error: err.message || "server error" },
      { status: 500 }
    );
  }
}

export {};
