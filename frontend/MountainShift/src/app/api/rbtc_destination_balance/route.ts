// src/app/api/rbtc_destination_balance/route.ts
import { NextRequest, NextResponse } from "next/server"
import { ethers } from "ethers"
import "dotenv/config"

const RPC_URL = process.env.ROOTSTOCK_RPC_URL!
if (!RPC_URL) {
  throw new Error("Missing ROOTSTOCK_RPC_URL in your .env")
}

const provider = new ethers.JsonRpcProvider(RPC_URL)

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")
  if (!address) {
    return NextResponse.json({ error: "Missing address param" }, { status: 400 })
  }
  if (!ethers.isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 })
  }

  try {
    // native RBTC balance (18 decimals)
    const raw = await provider.getBalance(address)
    const rbtcBalance = ethers.formatEther(raw)  // shorthand for formatUnits(raw, 18)

    return NextResponse.json({ rbtcBalance })
  } catch (e: any) {
    console.error("Error in rbtc_destination_balance:", e)
    return NextResponse.json(
      { error: e.message ?? "Failed to fetch RBTC balance" },
      { status: 500 }
    )
  }
}

export {}
