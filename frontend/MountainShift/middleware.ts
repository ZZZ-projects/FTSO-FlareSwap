// middlewear to stop someone from trying to break app functionality by flooding api routes integral to functionality - would rely distributed caching solution and premium api solutions in production?

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// in-memory maps to store timestamp (in ms) of last req per IP for each endpoint
const arbPricingMap = new Map<string, number>();
const shiftMap = new Map<string, number>();

export function middleware(req: NextRequest) {
  // determine IP
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const now = Date.now();
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith("/api/arb_pricing")) {
    // 5-second interval for arb_pricing endpoint
    const lastTime = arbPricingMap.get(ip) || 0;
    if (now - lastTime < 5000) {
      return new NextResponse("Too many requests – please wait 5 seconds.", { status: 429 });
    }
    arbPricingMap.set(ip, now);
  } else if (pathname.startsWith("/api/shift")) {
    // 3-second interval for shift endpoint.
    const lastTime = shiftMap.get(ip) || 0;
    if (now - lastTime < 3000) {
      return new NextResponse("Too many requests – please wait 3 seconds.", { status: 429 });
    }
    shiftMap.set(ip, now);
  }

  return NextResponse.next();
}

export const config = {
  // apply middleware to /api/arb_pricing and /api/shift routes
  matcher: ["/api/arb_pricing", "/api/shift"],
};
