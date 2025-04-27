// src/app/api/btc_pricing/route.ts

import { NextResponse } from "next/server";
import { ethers }       from "ethers";
import fs               from "fs";
import path             from "path";
import BigNumber        from "bignumber.js";
import "dotenv/config";

const RPC_URL          = process.env.COSTON2_RPC_URL!;
const CONSUMER_ADDRESS = process.env.FTSO_CONSUMER_ADDRESS!;

if (!RPC_URL || !CONSUMER_ADDRESS) {
  throw new Error("Missing COSTON2_RPC_URL or FTSO_CONSUMER_ADDRESS in your .env");
}

// Load ABI
const artifactPath = path.resolve(process.cwd(), "artifacts/FTSOConsumer.json");
const artifactJson = fs.readFileSync(artifactPath, "utf8");
const { abi: ABI } = JSON.parse(artifactJson) as { abi: any };

// Set up provider and interface
const provider = new ethers.JsonRpcProvider(RPC_URL);
const iface    = new ethers.Interface(ABI);

// Cache for fallback rate
let lastKnownRate: BigNumber | null = null;

export async function GET() {
  try {
    // 1) Encode & call fetchAllFeeds via eth_call
    const callData = iface.encodeFunctionData("fetchAllFeeds", []);
    const raw      = await provider.call({
      to:   CONSUMER_ADDRESS,
      data: callData
    });

    // 2) Decode the result
    const result    = iface.decodeFunctionResult("fetchAllFeeds", raw);
    const rawSyms   = result[0] as Uint8Array[];
    const rawPrices = result[1] as bigint[];
    // const rawTss    = result[2] as bigint[]; // unused here

    // Helper to decode bytes32 → string
    const decodeSym = (b: Uint8Array) =>
      ethers.toUtf8String(b)
        .replace(/\0+$/g, "")
        .trim();

    // 3) Find indices of testUSDC and testBTC
    const idxUSDC = rawSyms.findIndex((b) => decodeSym(b) === "testUSDC");
    const idxBTC  = rawSyms.findIndex((b) => decodeSym(b) === "testARB");
    if (idxUSDC < 0 || idxBTC < 0) {
      throw new Error("testUSDC or testARB not found in feed");
    }

    // 4) Convert to BigNumber.js for safe math
    const bnUSDC = new BigNumber(rawPrices[idxUSDC].toString());
    const bnBTC  = new BigNumber(rawPrices[idxBTC].toString());

    // 5) Compute BTC in USDC
    const btcInUsdc = bnBTC.dividedBy(bnUSDC).toFixed();

    // Cache the last successful rate
    lastKnownRate = new BigNumber(btcInUsdc);

    // 6) Return JSON
    return NextResponse.json(
      {
        testUSDC: bnUSDC.toFixed(),
        testARB:  bnBTC.toFixed(),
        btcInUsdc,
      },
      { status: 200 }
    );

  } catch (err: any) {
    console.error("FTSO price fetch error:", err);

    if (lastKnownRate) {
      // Fallback to last known rate
      return NextResponse.json(
        { btcInUsdc: lastKnownRate.toFixed(), fallback: true },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: err.message || "Failed to fetch prices" },
      { status: 500 }
    );
  }
}

export {};
