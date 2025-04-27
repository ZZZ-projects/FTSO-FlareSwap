// src/app/api/arb_balance/route.ts

import { NextResponse } from "next/server";
import { ethers }       from "ethers";
import "dotenv/config";

const RPC_URL = process.env.COSTON2_RPC_URL!;
if (!RPC_URL) {
  throw new Error("Missing COSTON2_RPC_URL in your .env");
}

const provider = new ethers.JsonRpcProvider(RPC_URL);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const addr = url.searchParams.get("address");
    if (!addr) {
      return NextResponse.json(
        { error: "Missing address query parameter" },
        { status: 400 }
      );
    }

    // fetch native ARB balance
    const raw = await provider.getBalance(addr);
    const arbBalance = ethers.formatUnits(raw, 18);

    return NextResponse.json({ arbBalance }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching ARB balance:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch ARB balance" },
      { status: 500 }
    );
  }
}

export {};
