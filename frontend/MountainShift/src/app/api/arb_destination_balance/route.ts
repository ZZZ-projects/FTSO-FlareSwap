// src/app/api/arb_pricing/route.ts

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

// load your compiled FTSOConsumer ABI
const artifactPath = path.resolve(process.cwd(), "artifacts/FTSOConsumer.json");
const { abi: ABI } = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as { abi: any };

const provider = new ethers.JsonRpcProvider(RPC_URL);
const iface    = new ethers.Interface(ABI);

// fallback cache
let lastKnownRate: BigNumber | null = null;

export async function GET() {
  try {
    // call fetchAllFeeds
    const callData = iface.encodeFunctionData("fetchAllFeeds", []);
    const raw      = await provider.call({ to: CONSUMER_ADDRESS, data: callData });

    // decode symbols & prices
    const result    = iface.decodeFunctionResult("fetchAllFeeds", raw);
    const rawSyms   = result[0] as Uint8Array[];
    const rawPrices = result[1] as bigint[];

    // helper to turn bytes32→string
    const decodeSym = (b: Uint8Array) =>
      ethers.toUtf8String(b).replace(/\0+$/g, "").trim();

    // find ARB
    const idx = rawSyms.findIndex((b) => decodeSym(b).endsWith("ARB"));
    if (idx < 0) throw new Error("No ARB feed in FTSOConsumer");

    // compute BigNumber price
    const bn = new BigNumber(rawPrices[idx].toString());
    lastKnownRate = bn;
    return NextResponse.json({ arbPrice: bn.toFixed() }, { status: 200 });
  } catch (err: any) {
    console.error("FTSO ARB price fetch error:", err);
    if (lastKnownRate) {
      return NextResponse.json(
        { arbPrice: lastKnownRate.toFixed(), fallback: true },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { error: err.message || "Failed to fetch ARB price" },
      { status: 500 }
    );
  }
}

export {};
