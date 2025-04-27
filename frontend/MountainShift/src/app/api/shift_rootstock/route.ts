// src/app/api/shift_rootstock/route.ts

import { NextResponse } from "next/server"
import { ethers, type TransactionResponse } from "ethers"
import BigNumber from "bignumber.js"

// ─── Rootstock provider & payout wallet ───────────────────────────────────────
const ROOTSTOCK_RPC = process.env.ROOTSTOCK_RPC_URL!
const ROOTSTOCK_KEY = process.env.ROOTSTOCK_PRIVATE_KEY!
if (!ROOTSTOCK_RPC || !ROOTSTOCK_KEY) {
  throw new Error("Missing ROOTSTOCK_RPC_URL or ROOTSTOCK_PRIVATE_KEY in .env")
}
const provider = new ethers.JsonRpcProvider(ROOTSTOCK_RPC)
const payoutWallet = new ethers.Wallet(ROOTSTOCK_KEY, provider)

// ─── Deposit contract address (where front-end sent the user's USDC) ──────────
const depositContractAddress = "0xf0f994B4A8dB86A46a1eD4F12263c795b26703Ca"

// ─── USDC on Rootstock ────────────────────────────────────────────────────────
const USDC_ADDRESS = "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"
const USDC_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
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
    const predictedRbtcAmount = body.predictedRbtcAmount

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

    // 3) fetch latest BTC pricing
    console.log("Fetching BTC pricing...")
    const priceRes = await fetch(new URL("/api/btc_pricing", req.url))
    const priceJson = await priceRes.json()
    if (priceJson.error) throw new Error(priceJson.error)

    // assume priceJson.btcInUsdc or find the key ending "InUsdc"
    const key = Object.keys(priceJson).find((k) => k.endsWith("InUsdc"))!
    const btcInUsdc = new BigNumber((priceJson as any)[key])
    console.log("BTC price in USDC:", btcInUsdc.toString())

    // 4) compute RBTC owed
    // For USDC → RBTC, we divide USDC by BTC price
    const usdcDec = await new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider).decimals()
    const usdcDecimalNumber = Number(usdcDec)
    const usdcAmountFormatted = ethers.formatUnits(transferAmount, usdcDec)

    console.log("USDC amount formatted:", usdcAmountFormatted)

    const computed = new BigNumber(usdcAmountFormatted).dividedBy(btcInUsdc)
    const userPred = new BigNumber(predictedRbtcAmount)

    // Use the lower of computed vs user predicted
    const chosen = computed.isLessThan(userPred) ? computed : userPred
    const finalRbtc = chosen.multipliedBy(0.99) // Apply 1% fee
    console.log("Final RBTC amount to send:", finalRbtc.toString())

    // 5) send RBTC back to user
    console.log("Preparing RBTC transfer to:", destination)

    // Check RBTC balance of payout wallet
    const payoutWalletAddress = await payoutWallet.getAddress()
    const rbtcBalance = await provider.getBalance(payoutWalletAddress)

    console.log("Payout wallet address:", payoutWalletAddress)
    console.log("RBTC balance of payout wallet:", ethers.formatEther(rbtcBalance))

    const units = ethers.parseEther(finalRbtc.toString())
    console.log("RBTC units to send:", units.toString())

    // Check if payout wallet has enough RBTC
    if (rbtcBalance < units) {
      console.error("Insufficient RBTC balance in payout wallet")
      return NextResponse.json(
        {
          error: "Insufficient RBTC balance in payout wallet",
          required: ethers.formatEther(units),
          available: ethers.formatEther(rbtcBalance),
          walletAddress: payoutWalletAddress,
        },
        { status: 500 },
      )
    }

    console.log("Sending RBTC transaction...")
    const transferTx = await payoutWallet.sendTransaction({
      to: destination,
      value: units,
    })
    console.log("RBTC transaction sent, hash:", transferTx.hash)

    const txRcpt2 = await transferTx.wait()
    console.log("RBTC transaction confirmed, block:", txRcpt2?.blockNumber)

    return NextResponse.json({
      success: true,
      finalRbtc: finalRbtc.toString(),
      finalTxHash: transferTx.hash,
    })
  } catch (err: any) {
    console.error("shift_rootstock error:", err)
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
