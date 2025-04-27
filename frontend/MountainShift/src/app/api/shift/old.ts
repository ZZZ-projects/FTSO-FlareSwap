/*
# interacting with ppshiftv2 contract (v2)
deployed at: 0xf0f994b4a8db86a46a1ed4f12263c795b26703ca

 min prices
eg min: 0.0038 eth

IF ANY API CALL FAILS, DO NOT USE IN CALCULATION

## dynamic minimum
user predicted amount must be >= computed value within 1% tolerance
(note: computed value now from consensus arb/usd price via trimmed mean of multiple feeds)

## user txn flow
- user signs txn (approval then depositUSDC)
- contract holds funds, logs params (flat 1% fee)
- backend validates logs vs rates from multiple sources then processes payout

# decision:
once tolerance check passes, backend sends arb (99% of lower value between computed arb (usdc/consensus) and user user trimmed mean arb at time of submission) to user's destination
*/

/*
# in/out setup
- in: user -> usdc on optimism
- out: arb on arbitrum

# arb payout
backend sends arb to destination after validations.
uses lower of:
  - backend computed trimmed mean arb 
  - user trimmed mean arb at time of submission
applies 1% fee (sends 99%)
*/

// ideally user cannot flood arb_pricing endpoint to stagnate or cause faults in this route.ts -> solution is to use diff api keys/ip for request from this endpoint

import { NextResponse } from "next/server";
import { ethers } from "ethers";
import BigNumber from "bignumber.js";

// updated abi with indexed params for event decoding
const depositAbi = [
  "event DepositProcessed(uint256 usdcAmount, address indexed depositor, address indexed recipient, bytes proof)"
];
const depositContractAddress = "0xf0f994B4A8dB86A46a1ed4f12263c795b26703Ca";

// optimism rpc for on-chain verification
// fallback: if process.env.OPTIMISM_RPC_URL is defined, it will be used. move to privately ran rpc/node in production maybe
const optimismProvider = new ethers.JsonRpcProvider(process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io");

// ==================== price fetchers ==================== //

// Chainlink on-chain arb/usd price (real feed, not api, not currently being used but maybe some future use??)
export async function fetchChainlinkPrice(): Promise<number> {
  const aggregatorAddress = "0xb2a8ba74cbca38508ba1632761b56c897060147c";
  const aggregatorABI = [
    { inputs: [], name: "latestRoundData", outputs: [{ name: "answer", type: "int256" }], stateMutability: "view", type: "function" },
    { inputs: [], name: "decimals", outputs: [{ name: "", type: "uint8" }], stateMutability: "view", type: "function" },
  ];
  console.log("perturb: fetching chainlink price...");
  const aggregatorContract = new ethers.Contract(aggregatorAddress, aggregatorABI, optimismProvider);
  const priceRaw = await aggregatorContract.latestRoundData();
  let decimals = 8;
  try {
    decimals = await aggregatorContract.decimals();
  } catch (e) {
    console.warn("invarient: chainlink decimals unavailable, default 8");
  }
  const chainlinkPrice = Number(priceRaw.answer) / Math.pow(10, decimals);
  console.log("chainlink price (convergent):", chainlinkPrice);
  return chainlinkPrice;
}

// fetch Binance ARB/USDC price
async function fetchBinancePrice(): Promise<BigNumber | null> {
  try {
    const url = "https://api.binance.com/api/v3/ticker/price?symbol=ARBUSDC";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Binance API request failed");

    const data = await res.json();
    console.log("Binance raw output:", data);

    if (!data || !data.price || isNaN(Number(data.price))) {
      throw new Error("Invalid Binance price data");
    }

    return new BigNumber(data.price);
  } catch (error: any) {
    console.error(`Binance price fetch failed: ${error.message}`);
    return null;
  }
}

// fetch Coingecko ARB/USD price (assuming usdc = usd is reasonable to assume since goingecko was reccomended)
async function fetchCoingeckoPrice(): Promise<BigNumber | null> {
  try {
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=arbitrum&vs_currencies=usd";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Coingecko API request failed");

    const data = await res.json();
    console.log("Coingecko raw output:", data);

    if (!data || typeof data !== "object" || !data.arbitrum || typeof data.arbitrum !== "object") {
      throw new Error("Invalid Coingecko API response");
    }

    const price = data.arbitrum.usd;
    if (typeof price !== "number" || isNaN(price)) {
      throw new Error("Invalid Coingecko price data");
    }

    return new BigNumber(price);
  } catch (error: any) {
    console.error(`Coingecko price fetch failed: ${error.message}`);
    return null;
  }
}

// Fetch CoinPaprika ARB/USD price
async function fetchCoinPaprikaPrice(): Promise<BigNumber | null> {
  try {
    const url = "https://api.coinpaprika.com/v1/tickers/arb-arbitrum";
    const res = await fetch(url);
    if (!res.ok) throw new Error("CoinPaprika API request failed");

    const data = await res.json();
    console.log("CoinPaprika raw output:", data);

    if (!data || !data.quotes || !data.quotes.USD || typeof data.quotes.USD.price !== "number") {
      throw new Error("Invalid CoinPaprika API response");
    }

    return new BigNumber(data.quotes.USD.price);
  } catch (error: any) {
    console.error(`CoinPaprika price fetch failed: ${error.message}`);
    return null;
  }
}

// Fetch OKX ARB/USDC price
async function fetchOKXPrice(): Promise<BigNumber | null> {
  try {
    const url = "https://www.okx.com/api/v5/market/ticker?instId=ARB-USDC";
    const res = await fetch(url);
    if (!res.ok) throw new Error("OKX API request failed");

    const data = await res.json();
    console.log("OKX raw output:", data);

    if (!data || !data.data || !Array.isArray(data.data) || !data.data[0] || !data.data[0].last) {
      throw new Error("Invalid OKX API response");
    }

    const price = new BigNumber(data.data[0].last);
    return price.isNaN() ? null : price;
  } catch (error: any) {
    console.error(`OKX price fetch failed: ${error.message}`);
    return null;
  }
}

// Fetch CoinMarketCap ARB/USD price (assuming usdc = usd)
async function fetchCoinMarketCapPrice(): Promise<BigNumber | null> {
  try {
    const apiKey = "f0e9fdf1-761a-4213-a32a-3140594f576b";
    const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=ARB';
    const res = await fetch(url, {
      headers: { 'X-CMC_PRO_API_KEY': apiKey }
    });
    const data = await res.json();
    console.log("coinmarketcap raw output:", data);

    if (!data || !data.data || !data.data.ARB || !data.data.ARB.quote || !data.data.ARB.quote.USD || typeof data.data.ARB.quote.USD.price !== "number") {
      throw new Error("Invalid CoinMarketCap API response");
    }

    return new BigNumber(data.data.ARB.quote.USD.price);
  } catch (error: any) {
    console.error(`CoinMarketCap price fetch failed: ${error.message}`);
    return null;
  }
}

// ==================== graceful fetching wrapper ==================== //

const lastKnownValues: {
  binance?: BigNumber;
  coingecko?: BigNumber;
  coinpaprika?: BigNumber;
  okx?: BigNumber;
  coinmarketcap?: BigNumber;
} = {};

async function getPriceGracefully(
  apiCall: () => Promise<BigNumber>,
  key: keyof typeof lastKnownValues,
  fallback: BigNumber
): Promise<BigNumber> {
  try {
    const price = await apiCall();
    lastKnownValues[key] = price;
    return price;
  } catch (error: any) {
    console.error(`error fetching ${key} price:`, error.message);
    if (lastKnownValues[key]) {
      console.warn(`using last known good value for ${key}: ${lastKnownValues[key]!.toFixed()}`);
      return lastKnownValues[key]!;
    } else {
      console.warn(`no last known good value for ${key}. using fallback: ${fallback.toFixed()}`);
      return fallback;
    }
  }
}

export async function getUniswapPriceGracefully(fallback: BigNumber): Promise<BigNumber> {
  return getPriceGracefully(fetchBinancePrice as any, "binance", fallback);
}

export async function getCoingeckoPriceGracefully(fallback: BigNumber): Promise<BigNumber> {
  return getPriceGracefully(fetchCoingeckoPrice as any, "coingecko", fallback);
}

export async function getCoinPaprikaPriceGracefully(fallback: BigNumber): Promise<BigNumber> {
  return getPriceGracefully(fetchCoinPaprikaPrice as any, "coinpaprika", fallback);
}

export async function getOKXPriceGracefully(fallback: BigNumber): Promise<BigNumber> {
  return getPriceGracefully(fetchOKXPrice as any, "okx", fallback);
}

export async function getCoinMarketCapPriceGracefully(fallback: BigNumber): Promise<BigNumber> {
  return getPriceGracefully(fetchCoinMarketCapPrice as any, "coinmarketcap", fallback);
}

// ==================== consensus calculation ==================== //

// compute trimmed mean (consensus) – discards lowest values (trimPercent of the array)
// (Note: this function is used both in the POST handler and the GET route)
function computeTrimmedMeanPrice(prices: BigNumber[], trimPercent: number): BigNumber {
  if (prices.length === 0) throw new Error("cannot compute mean of an empty array");
  const sorted = prices.slice().sort((a, b) => a.comparedTo(b));
  const trimCount = Math.floor(sorted.length * trimPercent);
  const trimmed = sorted.slice(trimCount);
  if (trimmed.length === 0) throw new Error("all values were trimmed, cannot compute mean");
  const sum = trimmed.reduce((acc, p) => acc.plus(p), new BigNumber(0));
  return sum.dividedBy(trimmed.length);
}

// ==================== dynamic tolerance (if needed) ==================== //

// 1% tolerance, capped at 0.1 arb (kept for reference though not actively used in current flow)
function calculateTolerance(computed: number): number {
  const percentageTolerance = computed * 0.01;
  const maxAbsoluteTolerance = 0.1;
  const tolerance = Math.min(percentageTolerance, maxAbsoluteTolerance);
  console.log("calculated tolerance:", tolerance);
  return tolerance;
}


// arbitrum provider & signer for payout
// fallback: if process.env.ARBITRUM_RPC_URL is defined, it will be used.
const arbProvider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc");
// arb payout private key (env)
const ARB_PAYOUT_PRIVATE_KEY = process.env.ARB_PAYOUT_PRIVATE_KEY || "";
const arbSigner = new ethers.Wallet(ARB_PAYOUT_PRIVATE_KEY, arbProvider);
// arb token contract (payout)
const arbTokenAddress = "0x912ce59144191c1204e64559fe8253a0e49e6548";
// minimal erc20 abi (transfer & decimals)
const arbTokenAbi = [
  "function transfer(address recipient, uint256 amount) external returns (bool)",
  "function decimals() view returns (uint8)",
];
const arbTokenContract = new ethers.Contract(arbTokenAddress, arbTokenAbi, arbSigner);

// ==================== main api route ==================== //

export async function POST(req: Request) {
  try {
    console.log("starting backend validation");
    const body = await req.json();
    console.log("received backend input:", body);
    const { txHash, usdcAmount, destination, predictedArbAmount } = body;

    // fetch txn receipt from optimism
    console.log("perturb: fetching txn receipt for hash:", txHash);
    const txReceipt = await optimismProvider.getTransactionReceipt(txHash);
    if (!txReceipt) {
      console.error("txn receipt not found");
      return NextResponse.json({ error: "txn not found" }, { status: 400 });
    }
    console.log("txn receipt:", txReceipt);

    // log all receipt logs for debugging
    console.log("all logs in receipt:");
    for (const log of txReceipt.logs) {
      console.log("log:", log);
    }

    // decode depositprocessed event
    console.log("decoding depositprocessed event...");
    const iface = new ethers.Interface(depositAbi);
    let depositEvent;
    for (const log of txReceipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === "DepositProcessed") {
          depositEvent = parsed;
          console.log("found depositprocessed event:", parsed);
          break;
        }
      } catch (e) {
        console.warn("failed to parse log:", e);
      }
    }
    if (!depositEvent) {
      console.error("depositprocessed event not found");
      return NextResponse.json({ error: "depositprocessed event not found" }, { status: 400 });
    }

    // removed redundant check for on-chain params vs user input (usdc amount & destination)

    // ==================== price consensus calculation ==================== //
    // fetch all prices in parallel
    const prices = await Promise.all([
      fetchBinancePrice(),
      fetchCoingeckoPrice(),
      fetchCoinPaprikaPrice(),
      fetchOKXPrice(),
      fetchCoinMarketCapPrice()
    ]);

    // filter out failed fetches
    const validPrices = prices.filter(p => p !== null) as BigNumber[];
    
    if (validPrices.length < 3) {
      throw new Error("Insufficient valid price data");
    }
    
    // compute trimmed mean (41% such that 2 biggest outliers excluded)
    const finalPrice = computeTrimmedMeanPrice(validPrices, 0.41);
    console.log("consensus arb/usd price:", finalPrice.toFixed());

    // ==================== arb amount calculation & payout ==================== //
    // compute predicted arb from on-chain deposit (usdc/consensus price)
    const computedPredictedArb = new BigNumber(usdcAmount).dividedBy(finalPrice);
    console.log("computed predicted arb (usdc/consensus):", computedPredictedArb.toFixed());
    console.log("user submitted predicted arb:", predictedArbAmount);

    // for payout, use lower of computed vs frontend then apply 1% fee
    const frontendPredictedArb = new BigNumber(predictedArbAmount);
    const lowerPredicted = computedPredictedArb.isLessThan(frontendPredictedArb)
      ? computedPredictedArb
      : frontendPredictedArb;
    const finalArbAmount = lowerPredicted.multipliedBy(0.99);
    console.log("final arb amount to send (before conversion):", finalArbAmount.toFixed());

    // convert final arb amount to token units (18 decimals)
    const finalArbAmountStr = finalArbAmount.toFixed(18);
    const finalArbUnits = ethers.parseUnits(finalArbAmountStr, 18);
    console.log("final arb amount in token units:", finalArbUnits.toString());

    // initiate arb token transfer to destination
    console.log("initiating arb transfer to", destination);
    const transferTx = await arbTokenContract.transfer(destination, finalArbUnits);
    console.log("arb transfer txn sent. hash:", transferTx.hash);
    const transferReceipt = await transferTx.wait();
    
    console.log("arb transfer confirmed. receipt:", transferReceipt);
    console.log("validations passed, arb payout sent");
    return NextResponse.json({ 
      success: true, 
      message: "validation passed, arb payout sent", 
      finalArb: finalArbAmountStr,
      finalTxHash: transferTx.hash
    });

  } catch (error: any) {
    console.error("error in backend validation:", error);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
export {};
