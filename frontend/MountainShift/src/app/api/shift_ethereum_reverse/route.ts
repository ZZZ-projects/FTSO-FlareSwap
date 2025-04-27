// src/app/api/shift_ethereum_reverse/route.ts

import { NextResponse } from "next/server"
import { ethers, type TransactionResponse } from "ethers"
import BigNumber from "bignumber.js"

// ─── Ethereum provider & payout wallet ───────────────────────────────────────
const ETH_RPC = process.env.ETHEREUM_RPC_URL!
const ETH_KEY = process.env.ETHEREUM_PRIVATE_KEY!
if (!ETH_RPC || !ETH_KEY) {
  throw new Error("Missing ETHEREUM_RPC_URL or ETHEREUM_PRIVATE_KEY in .env")
}
const provider = new ethers.JsonRpcProvider(ETH_RPC)
const payoutWallet = new ethers.Wallet(ETH_KEY, provider)

// ─── Deposit contract address (where front-end sent the user's ETH) ──────────
const depositContractAddress = "0xf0f994B4A8dB86A46a1eD4F12263c795b26703Ca"

// ─── USDC on Ethereum ────────────────────────────────────────────────────────
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const USDC_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
]

// ─── Minimal ERC20 interface for TS ───────────────────────────────────────────
interface IERC20 {
  transfer(to: string, amount: bigint): Promise<TransactionResponse>
  decimals(): Promise<number>
  balanceOf(account: string): Promise<bigint>
}

export async function POST(req: Request) {
  try {
    // Parse request body
    const body = await req.json()

    // Extract parameters with fallbacks for different naming conventions
    const txHash = body.txHash
    const sourceAmount = body.rbtcAmount || body.sourceAmount || body.ethAmount
    const destination = body.destination
    const predictedUsdcAmount = body.predictedUsdcAmount

    console.log("Received request:", {
      txHash,
      sourceAmount,
      destination,
      predictedUsdcAmount,
    })

    // validate
    if (!txHash || !sourceAmount || Number.parseFloat(sourceAmount) <= 0 || !ethers.isAddress(destination)) {
      return NextResponse.json(
        {
          error: "invalid input",
          received: { txHash, sourceAmount, destination, predictedUsdcAmount },
        },
        { status: 400 },
      )
    }

    // 1) fetch deposit receipt
    console.log("Fetching transaction receipt for:", txHash)
    const receipt = await provider.getTransactionReceipt(txHash)
    if (!receipt) {
      return NextResponse.json({ error: "txn not found" }, { status: 400 })
    }
    console.log("Transaction receipt found, block number:", receipt.blockNumber)

    // 2) Check for ETH transfer to deposit address
    console.log("Checking for ETH transfer in transaction...")
    
    // For ETH transfers, we need to check the transaction itself
    const tx = await provider.getTransaction(txHash)
    if (!tx) {
      return NextResponse.json({ error: "transaction not found" }, { status: 400 })
    }
    
    // Check if this is a transfer to our deposit address
    if (tx.to?.toLowerCase() !== depositContractAddress.toLowerCase()) {
      return NextResponse.json(
        {
          error: "ETH transfer to deposit address not found",
          txHash,
          depositAddress: depositContractAddress,
          actualTo: tx.to,
        },
        { status: 400 },
      )
    }
    
    const transferAmount = tx.value
    console.log("ETH transfer confirmed, amount:", transferAmount.toString())

    // 3) fetch latest ETH pricing
    console.log("Fetching ETH pricing...")
    const priceRes = await fetch(new URL("/api/eth_pricing", req.url))
    const priceJson = await priceRes.json()
    if (priceJson.error) throw new Error(priceJson.error)

    // assume priceJson.ethInUsdc or find the key ending "InUsdc"
    const key = Object.keys(priceJson).find((k) => k.endsWith("InUsdc"))!
    const ethInUsdc = new BigNumber((priceJson as any)[key])
    console.log("ETH price in USDC:", ethInUsdc.toString())

    // 4) compute USDC owed
    const ethAmountFormatted = ethers.formatEther(transferAmount)
    console.log("ETH amount formatted:", ethAmountFormatted)
    
    const computed = new BigNumber(ethAmountFormatted).multipliedBy(ethInUsdc)
    const userPred = new BigNumber(predictedUsdcAmount)
    const chosen = computed.isLessThan(userPred) ? computed : userPred
    const finalUsdc = chosen.multipliedBy(0.99)
    console.log("Final USDC amount to send:", finalUsdc.toString())

    // 5) send USDC back to user
    console.log("Preparing USDC transfer to:", destination)
    const baseUsdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider)
    const usdcWithSigner = baseUsdc.connect(payoutWallet) as unknown as IERC20

    // Check USDC balance of payout wallet
    const payoutWalletAddress = await payoutWallet.getAddress()
    const usdcBalance = await usdcWithSigner.balanceOf(payoutWalletAddress)
    const dec = await usdcWithSigner.decimals()
    const decimalNumber = Number(dec)

    console.log("Payout wallet address:", payoutWalletAddress)
    console.log("USDC balance of payout wallet:", ethers.formatUnits(usdcBalance, dec))

    const units = ethers.parseUnits(finalUsdc.toFixed(decimalNumber), dec)
    console.log("USDC units to send:", units.toString())

    // Check if payout wallet has enough USDC
    if (usdcBalance < units) {
      console.error("Insufficient USDC balance in payout wallet")
      return NextResponse.json(
        {
          error: "Insufficient USDC balance in payout wallet",
          required: ethers.formatUnits(units, dec),
          available: ethers.formatUnits(usdcBalance, dec),
          walletAddress: payoutWalletAddress,
        },
        { status: 500 },
      )
    }

    console.log("Sending USDC transaction...")
    const transferTx = await usdcWithSigner.transfer(destination, units)
    console.log("USDC transaction sent, hash:", transferTx.hash)

    const txRcpt2 = await (transferTx as TransactionResponse).wait()
    console.log("USDC transaction confirmed, block:", txRcpt2?.blockNumber)

    return NextResponse.json({
      success: true,
      finalUsdc: finalUsdc.toFixed(decimalNumber),
      finalTxHash: transferTx.hash,
    })
  } catch (err: any) {
    console.error("shift_ethereum_reverse error:", err)
    return NextResponse.json(
      {
        error: err.message || "server error",
        stack: err.stack,
        shortMessage: err.shortMessage || null,
        reason: err.reason || null,
      },
      { status: 500 },
    )
  }
}
