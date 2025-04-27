// app/api/ftso/prices/route.ts (nested route)
import { NextResponse } from "next/server"
import { ethers } from "ethers"
import { Buffer } from "buffer"

// FTSO Consumer ABI - just the parts we need
const FTSO_CONSUMER_ABI = [
  "function fetchAllFeeds() external view returns (bytes32[] memory symbols, uint256[] memory prices, uint256[] memory timestamps)",
]

// Manual parseBytes32String implementation for ethers v6 compatibility
const parseBytes32String = (b32: string | any) => {
  const hex = b32.toString().slice(2)
  const buf = Buffer.from(hex, "hex")
  const z = buf.indexOf(0)
  return buf.slice(0, z >= 0 ? z : buf.length).toString("utf8")
}

export async function GET() {
  try {
    // Get environment variables
    const RPC_URL = process.env.COSTON2_RPC_URL
    const FTSO_ADDRESS = process.env.FTSO_CONSUMER_ADDRESS

    if (!RPC_URL || !FTSO_ADDRESS) {
      return NextResponse.json(
        { error: "Missing COSTON2_RPC_URL or FTSO_CONSUMER_ADDRESS environment variables" },
        { status: 500 },
      )
    }

    console.log("FTSO Nested API Route: Starting request with RPC:", RPC_URL.substring(0, 20) + "...")

    // 1) Setup
    const provider = new ethers.JsonRpcProvider(RPC_URL)

    // 2) Single eth_call to fetchAllFeeds()
    const iface = new ethers.Interface(FTSO_CONSUMER_ABI)
    const callData = iface.encodeFunctionData("fetchAllFeeds", [])
    const raw = await provider.call({ to: FTSO_ADDRESS, data: callData })

    // 3) Decode the 3 arrays
    const [rawSyms, rawPrices, rawTss] = iface.decodeFunctionResult("fetchAllFeeds", raw)

    // 4) Build a lookup: symbolString → index
    const idx: Record<string, number> = {}
    const allSymbols: string[] = []

    for (let i = 0; i < rawSyms.length; i++) {
      try {
        const s = parseBytes32String(rawSyms[i]).replace(/\0+$/g, "")
        idx[s] = i
        allSymbols.push(s)
      } catch (e) {
        console.error(`Error parsing symbol at index ${i}:`, e)
      }
    }

    // 5) Process all symbols
    const results = []

    // List of all symbols we want to include
    const wantedSymbols = [
      "C2FLR",
      "testXRP",
      "testLTC",
      "testXLM",
      "testDOGE",
      "testADA",
      "testALGO",
      "testBTC",
      "testETH",
      "testFIL",
      "testARB",
      "testAVAX",
      "testBNB",
      "testMATIC",
      "testSOL",
      "testUSDC",
      "testUSDT",
      "testXDC",
      "testPOL",
    ]

    for (const sym of wantedSymbols) {
      const i = idx[sym]
      if (i == null) {
        console.log(`Symbol "${sym}" not found`)
        // Still add to results with null values so frontend knows it was requested
        results.push({
          symbol: sym,
          price: "0",
          formattedPrice: "0.000000",
          timestamp: 0,
          formattedTime: new Date().toISOString(),
          found: false,
        })
      } else {
        const price = ethers.formatUnits(rawPrices[i], 18)
        const tsSeconds = Number(rawTss[i])

        results.push({
          symbol: sym,
          price,
          formattedPrice: Number.parseFloat(price).toFixed(6),
          timestamp: tsSeconds,
          formattedTime: new Date(tsSeconds * 1000).toISOString(),
          found: true,
        })
      }
    }

    return NextResponse.json({
      prices: results,
      allSymbols,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("FTSO price fetch error:", error)
    return NextResponse.json(
      {
        error: error.message || "Failed to fetch FTSO prices",
        details: error.stack,
      },
      { status: 500 },
    )
  }
}
