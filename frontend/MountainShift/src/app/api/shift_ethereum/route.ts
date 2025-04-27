// todo

import { NextResponse } from "next/server";
import { ethers } from "ethers";
import BigNumber from "bignumber.js";

// Import shared modules
import { optimismProvider } from "../../../lib/blockchain/providers";
import { depositAbi, depositContractAddress } from "../../../lib/blockchain/contractService";
import {
  getCoingeckoBTCPriceGracefully,
  getCoinMarketCapBTCPriceGracefully,
  getOKXBTCPriceGracefully,
} from "../../../lib/prices/btcFetchers";
import { computeTrimmedMeanPrice } from "../../../lib/prices/consensus";

export async function POST(req: Request) {
  try {
    console.log("starting backend validation");
    const body = await req.json();
    console.log("received backend input:", body);
    // Update field names to match the frontend
    const { txHash, amount, destination, predictedAmount } = body;

    // Check minimum deposit amount: must be at least 0.5 USDC.
    if (parseFloat(amount) < 0.5) {
      console.error("deposit amount below minimum threshold");
      return NextResponse.json(
        { error: "Deposit amount must be at least 0.5 USDC" },
        { status: 400 }
      );
    }

    // Fetch transaction receipt from Optimism.
    console.log("perturb: fetching txn receipt for hash:", txHash);
    const txReceipt = await optimismProvider.getTransactionReceipt(txHash);
    if (!txReceipt) {
      console.error("txn receipt not found");
      return NextResponse.json({ error: "txn not found" }, { status: 400 });
    }
    console.log("txn receipt:", txReceipt);

    // Log receipt logs for debugging.
    console.log("all logs in receipt:");
    for (const log of txReceipt.logs) {
      console.log("log:", log);
    }

    // Decode DepositProcessed event from receipt logs.
    console.log("decoding depositprocessed event...");
    const iface = new ethers.Interface(depositAbi);
    let depositEvent;
    for (const log of txReceipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === "DepositProcessed") {
          depositEvent = parsed;
          console.log("found depositprocessed event:", parsed);
          break;
        }
      } catch (e) {
        console.warn("failed to parse log:", e);
      }
    }
    if (!depositEvent) {
      console.error("depositprocessed event not found");
      return NextResponse.json(
        { error: "depositprocessed event not found" },
        { status: 400 }
      );
    }

    // ==================== Price Consensus Calculation ==================== //

    // Use a fallback value (here using 0, but you may want to set a nonzero fallback)
    const fallback = new BigNumber(0);

    // Fetch prices using the graceful helpers.
    const prices = await Promise.all([
      getCoingeckoBTCPriceGracefully(fallback),
      getCoinMarketCapBTCPriceGracefully(fallback),
      getOKXBTCPriceGracefully(fallback),
    ]);

    // Filter out any failed API calls (i.e. prices <= 0)
    const validPrices = prices.filter((p) => p.isGreaterThan(0));
    if (validPrices.length < 3) {
      throw new Error("insufficient valid price data");
    }

    // Compute the trimmed mean (41% trimmed so that outliers are excluded).
    const finalPrice = computeTrimmedMeanPrice(validPrices, 0.41);
    console.log("consensus rbtc/usd price:", finalPrice.toFixed());

    // ==================== RBTC Amount Calculation & Payout ==================== //

    // Calculate the predicted RBTC amount from the on-chain deposit:
    // Divide the USDC deposit amount by the consensus price.
    const computedPredictedRbtc = new BigNumber(amount).dividedBy(finalPrice);
    console.log("computed predicted rbtc (usdc/consensus):", computedPredictedRbtc.toFixed());
    console.log("user submitted predicted rbtc:", predictedAmount);

    // Choose the lower of the computed and user-submitted values, then apply a 1% fee (i.e. send 99%).
    const frontendPredictedRbtc = new BigNumber(predictedAmount);
    const lowerPredicted = computedPredictedRbtc.isLessThan(frontendPredictedRbtc)
      ? computedPredictedRbtc
      : frontendPredictedRbtc;
    const finalRbtcAmount = lowerPredicted.multipliedBy(0.99);
    console.log("final rbtc amount to send (before conversion):", finalRbtcAmount.toFixed());

    // Convert the final RBTC amount to wei (18 decimals).
    const finalRbtcAmountStr = finalRbtcAmount.toFixed(18);
    const finalRbtcUnits = ethers.parseUnits(finalRbtcAmountStr, 18);
    console.log("final rbtc amount in wei:", finalRbtcUnits.toString());

    // Initiate the RBTC transfer to the destination address using the ROOTSTOCK private key.
    console.log("initiating rbtc transfer to", destination);
    const rootstockProvider = new ethers.JsonRpcProvider(process.env.ROOTSTOCK_RPC_URL);
    const payoutWallet = new ethers.Wallet(process.env.ROOTSTOCK_PRIVATE_KEY!, rootstockProvider);
    const transferTx = await payoutWallet.sendTransaction({
      to: destination,
      value: finalRbtcUnits,
    });
    console.log("rbtc transfer txn sent. hash:", transferTx.hash);
    const transferReceipt = await transferTx.wait();
    console.log("rbtc transfer confirmed. receipt:", transferReceipt);
    console.log("validations passed, rbtc payout sent");

    // ------------------- Fetch Contract USDC Balance ------------------- //
    const usdcAddress = "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85";
    const usdcAbi = [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ];
    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, optimismProvider);
    let contractUsdcBalance = -1;
    try {
      // Normalize the deposit contract address and fetch its USDC balance.
      const normalizedDepositAddress = ethers.getAddress(depositContractAddress.toLowerCase());
      const rawUsdcBalance = await usdcContract.balanceOf(normalizedDepositAddress);
      const usdcDecimals = await usdcContract.decimals();
      contractUsdcBalance = parseFloat(ethers.formatUnits(rawUsdcBalance, usdcDecimals));
    } catch (err) {
      console.error("error fetching contract usdc balance, falling back to -1:", err);
      contractUsdcBalance = -1;
    }
    console.log("contract usdc balance:", contractUsdcBalance);

    // ------------------- Fetch Payout RBTC Balance ------------------- //
    let payoutRbtcBalance = -1;
    try {
      const payoutWalletAddress = payoutWallet.address;
      const rawPayoutRbtcBalance = await rootstockProvider.getBalance(payoutWalletAddress);
      payoutRbtcBalance = parseFloat(ethers.formatEther(rawPayoutRbtcBalance));
    } catch (err) {
      console.error("error fetching payout rbtc balance, falling back to -1:", err);
      payoutRbtcBalance = -1;
    }
    console.log("payout rbtc balance:", payoutRbtcBalance);

    // ==================== Database Logging Removed ==================== //

    return NextResponse.json({
      success: true,
      message: "validation passed, rbtc payout sent",
      finalRbtc: finalRbtcAmountStr,
      finalTxHash: transferTx.hash,
    });
  } catch (error: any) {
    console.error("error in backend validation:", error);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
export {};
