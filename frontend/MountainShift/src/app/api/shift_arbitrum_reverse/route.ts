// src/app/api/shift_arbitrum_reverse/route.ts

import { NextResponse } from "next/server"
import { ethers, type TransactionResponse } from "ethers"
import BigNumber from "bignumber.js"

// ─── Arbitrum provider & payout wallet ───────────────────────────────────────
const ARB_RPC = process.env.ARBITRUM_RPC_URL!
const ARB_KEY = process.env.ARBITRUM_PRIVATE_KEY!
if (!ARB_RPC || !ARB_KEY) {
  throw new Error("Missing ARBITRUM_RPC_URL or ARBITRUM_PRIVATE_KEY in .env")
}
const provider = new ethers.JsonRpcProvider(ARB_RPC)
const payoutWallet = new ethers.Wallet(ARB_KEY, provider)

// ─── Deposit contract address (where front-end sent the user's ARB) ──────────
const depositContractAddress = "0xf0f994B4A8dB86A46a1eD4F12263c795b26703Ca"

// ─── USDC on Arbitrum ────────────────────────────────────────────────────────
const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
const USDC_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
]

// ─── ARB token on Arbitrum ────────────────────────────────────────────────────
const ARB_TOKEN_ADDRESS = "0x912CE59144191C1204E64559FE8253a0e49E6548"
const ARB_TOKEN_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]

// ─── ERC20 Transfer event signature ───────────────────────────────────────────
const TRANSFER_EVENT = "Transfer(address,address,uint256)"

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
    const sourceAmount = body.rbtcAmount || body.sourceAmount || body.arbAmount
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

    // Log all receipt logs for debugging
    console.log("All logs in receipt:")
    for (const log of receipt.logs) {
      console.log("Log address:", log.address)
      console.log("Log topics:", log.topics)
    }

    // 2) Check for ARB token transfer to deposit address
    console.log("Checking for Transfer events in transaction logs...")
    let transferFound = false
    let transferAmount = BigInt(0)

    // Loop through logs to find Transfer event
    for (const log of receipt.logs) {
      try {
        // Check if this log is from the ARB token contract
        if (log.address.toLowerCase() === ARB_TOKEN_ADDRESS.toLowerCase()) {
          // The Transfer event has the signature: Transfer(address indexed from, address indexed to, uint256 value)
          // The first topic is the event signature hash
          const transferEventSignature = ethers.id(TRANSFER_EVENT)

          if (log.topics[0] === transferEventSignature) {
            // The second topic is the 'from' address (padded to 32 bytes)
            const from = ethers.dataSlice(log.topics[1], 12)

            // The third topic is the 'to' address (padded to 32 bytes)
            const to = ethers.dataSlice(log.topics[2], 12)

            // The data contains the amount
            const amount = ethers.toBigInt(log.data)

            console.log("Found Transfer event:", {
              from,
              to,
              amount: amount.toString(),
            })

            // Check if this is a transfer to our deposit address
            if (to.toLowerCase() === depositContractAddress.toLowerCase()) {
              transferFound = true
              transferAmount = amount
              break
            }
          }
        }
      } catch (e) {
        console.log("Error parsing log:", e)
        // Continue to next log
      }
    }

    if (!transferFound) {
      // If we didn't find a Transfer event, try using the Interface approach as a fallback
      console.log("Trying alternative method to find Transfer event...")

      const iface = new ethers.Interface(ARB_TOKEN_ABI)

      for (const log of receipt.logs) {
        try {
          if (log.address.toLowerCase() === ARB_TOKEN_ADDRESS.toLowerCase()) {
            const parsedLog = iface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            })

            if (parsedLog && parsedLog.name === "Transfer") {
              const [from, to, amount] = parsedLog.args

              console.log("Found Transfer event using Interface:", {
                from,
                to,
                amount: amount.toString(),
              })

              if (to.toLowerCase() === depositContractAddress.toLowerCase()) {
                transferFound = true
                transferAmount = amount
                break
              }
            }
          }
        } catch (e) {
          console.log("Error parsing log with Interface:", e)
        }
      }
    }

    if (!transferFound) {
      return NextResponse.json(
        {
          error: "ARB token transfer to deposit address not found in transaction logs",
          txHash,
          depositAddress: depositContractAddress,
        },
        { status: 400 },
      )
    }

    console.log("ARB token transfer confirmed, amount:", transferAmount.toString())

    // 3) fetch latest ARB pricing
    console.log("Fetching ARB pricing...")
    const priceRes = await fetch(new URL("/api/arb_pricing", req.url))
    const priceJson = await priceRes.json()
    if (priceJson.error) throw new Error(priceJson.error)

    // assume priceJson.arbInUsdc or find the key ending "InUsdc"
    const key = Object.keys(priceJson).find((k) => k.endsWith("InUsdc"))!
    const arbInUsdc = new BigNumber((priceJson as any)[key])
    console.log("ARB price in USDC:", arbInUsdc.toString())

    // 4) compute USDC owed
    const computed = new BigNumber(sourceAmount).multipliedBy(arbInUsdc)
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
    console.error("shift_arbitrum_reverse error:", err)
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
