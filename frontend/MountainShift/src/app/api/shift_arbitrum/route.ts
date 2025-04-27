// src/app/api/shift_arbitrum/route.ts

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

// ─── Deposit contract address (where front-end sent the user's USDC) ──────────
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

    // Extract parameters
    const txHash = body.txHash
    const usdcAmount = body.usdcAmount
    const destination = body.destination
    const predictedRbtcAmount = body.predictedRbtcAmount || body.predictedArbAmount

    console.log("Received request:", {
      txHash,
      usdcAmount,
      destination,
      predictedRbtcAmount,
    })

    // validate
    if (!txHash || !usdcAmount || Number.parseFloat(usdcAmount) <= 0 || !ethers.isAddress(destination)) {
      return NextResponse.json(
        {
          error: "invalid input",
          received: { txHash, usdcAmount, destination, predictedRbtcAmount },
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

    // 2) Check for USDC token transfer to deposit address
    console.log("Checking for Transfer events in transaction logs...")
    let transferFound = false
    let transferAmount = BigInt(0)

    // Loop through logs to find Transfer event
    for (const log of receipt.logs) {
      try {
        // Check if this log is from the USDC token contract
        if (log.address.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
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

      const iface = new ethers.Interface(USDC_ABI)

      for (const log of receipt.logs) {
        try {
          if (log.address.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
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
          error: "USDC token transfer to deposit address not found in transaction logs",
          txHash,
          depositAddress: depositContractAddress,
        },
        { status: 400 },
      )
    }

    console.log("USDC token transfer confirmed, amount:", transferAmount.toString())

    // 3) fetch latest ARB pricing
    console.log("Fetching ARB pricing...")
    const priceRes = await fetch(new URL("/api/arb_pricing", req.url))
    const priceJson = await priceRes.json()
    if (priceJson.error) throw new Error(priceJson.error)

    // assume priceJson.arbInUsdc or find the key ending "InUsdc"
    const key = Object.keys(priceJson).find((k) => k.endsWith("InUsdc"))!
    const arbInUsdc = new BigNumber((priceJson as any)[key])
    console.log("ARB price in USDC:", arbInUsdc.toString())

    // 4) compute ARB owed
    // For USDC → ARB, we divide USDC by ARB price
    const usdcDec = await new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider).decimals()
    const usdcDecimalNumber = Number(usdcDec)
    const usdcAmountFormatted = ethers.formatUnits(transferAmount, usdcDec)

    console.log("USDC amount formatted:", usdcAmountFormatted)

    const computed = new BigNumber(usdcAmountFormatted).dividedBy(arbInUsdc)
    const userPred = new BigNumber(predictedRbtcAmount)

    // Use the lower of computed vs user predicted
    const chosen = computed.isLessThan(userPred) ? computed : userPred
    const finalArb = chosen.multipliedBy(0.99) // Apply 1% fee
    console.log("Final ARB amount to send:", finalArb.toString())

    // 5) send ARB back to user
    console.log("Preparing ARB transfer to:", destination)
    const baseArb = new ethers.Contract(ARB_TOKEN_ADDRESS, ARB_TOKEN_ABI, provider)
    const arbWithSigner = baseArb.connect(payoutWallet) as unknown as IERC20

    // Check ARB balance of payout wallet
    const payoutWalletAddress = await payoutWallet.getAddress()
    const arbBalance = await arbWithSigner.balanceOf(payoutWalletAddress)
    const arbDec = await arbWithSigner.decimals()
    const arbDecimalNumber = Number(arbDec)

    console.log("Payout wallet address:", payoutWalletAddress)
    console.log("ARB balance of payout wallet:", ethers.formatUnits(arbBalance, arbDec))

    const units = ethers.parseUnits(finalArb.toFixed(arbDecimalNumber), arbDec)
    console.log("ARB units to send:", units.toString())

    // Check if payout wallet has enough ARB
    if (arbBalance < units) {
      console.error("Insufficient ARB balance in payout wallet")
      return NextResponse.json(
        {
          error: "Insufficient ARB balance in payout wallet",
          required: ethers.formatUnits(units, arbDec),
          available: ethers.formatUnits(arbBalance, arbDec),
          walletAddress: payoutWalletAddress,
        },
        { status: 500 },
      )
    }

    console.log("Sending ARB transaction...")
    const transferTx = await arbWithSigner.transfer(destination, units)
    console.log("ARB transaction sent, hash:", transferTx.hash)

    const txRcpt2 = await (transferTx as TransactionResponse).wait()
    console.log("ARB transaction confirmed, block:", txRcpt2?.blockNumber)

    return NextResponse.json({
      success: true,
      finalAmount: finalArb.toFixed(arbDecimalNumber),
      finalTxHash: transferTx.hash,
    })
  } catch (err: any) {
    console.error("shift_arbitrum error:", err)
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
