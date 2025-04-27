// FOR USING OFF CHAIN API's IN ADDITION TO FTSO?????

import BigNumber from "bignumber.js";
import { ethers } from "ethers";

// Fetch Chainlink on-chain ARB/USD price
export async function fetchChainlinkPrice(): Promise<BigNumber> {
  try {
    const provider = new ethers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
    const aggregatorAddress = "0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6";

    const aggregatorABI = [
      {
        inputs: [],
        name: "latestRoundData",
        outputs: [
          { name: "roundId", type: "uint80" },
          { name: "answer", type: "int256" },
          { name: "startedAt", type: "uint256" },
          { name: "updatedAt", type: "uint256" },
          { name: "answeredInRound", type: "uint80" }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", type: "uint8" }],
        stateMutability: "view",
        type: "function"
      }
    ];

    const aggregatorContract = new ethers.Contract(aggregatorAddress, aggregatorABI, provider);
    const roundData = await aggregatorContract.latestRoundData();
    const decimals = await aggregatorContract.decimals();

    if (!roundData || roundData.answer === undefined || isNaN(Number(roundData.answer))) {
      throw new Error("Invalid Chainlink API response");
    }

    return new BigNumber(roundData.answer.toString()).dividedBy(new BigNumber(10).pow(decimals));
  } catch (error: any) {
    throw new Error(`Chainlink price fetch failed: ${error.message}`);
  }
}

// Fetch Coingecko ARB/USD price
export async function fetchCoingeckoPrice(): Promise<BigNumber> {
  const url = "https://api.coingecko.com/api/v3/simple/price?ids=arbitrum&vs_currencies=usd";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Coingecko API request failed");
  const data = await res.json();
  const price = parseFloat(data.arbitrum?.usd);
  if (isNaN(price)) throw new Error("invalid coingecko price");
  return new BigNumber(price);
}

// Fetch CoinPaprika ARB/USD price
export async function fetchCoinPaprikaPrice(): Promise<BigNumber> {
  const url = "https://api.coinpaprika.com/v1/tickers/arb-arbitrum";
  const res = await fetch(url);
  if (!res.ok) throw new Error("CoinPaprika API request failed");
  const data = await res.json();
  const price = parseFloat(data.quotes?.USD?.price);
  if (isNaN(price)) throw new Error("invalid coinpaprika price");
  return new BigNumber(price);
}

// Fetch OKX ARB/USDC price
export async function fetchOKXPrice(): Promise<BigNumber> {
  const url = "https://www.okx.com/api/v5/market/ticker?instId=ARB-USDT";
  const res = await fetch(url);
  if (!res.ok) throw new Error("OKX API request failed");
  const data = await res.json();
  const price = parseFloat(data?.data?.[0]?.last);
  if (isNaN(price)) throw new Error("invalid okx price");
  return new BigNumber(price);
}

// Fetch Binance ARB/USDC price
export async function fetchBinancePrice(): Promise<BigNumber> {
  const url = "https://api.binance.com/api/v3/ticker/price?symbol=ARBUSDC";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Binance API request failed");
  const data = await res.json();
  const price = parseFloat(data?.price);
  if (isNaN(price)) throw new Error("invalid binance price");
  return new BigNumber(price);
}

// Fetch CoinMarketCap ARB/USD price using the provided API key
export async function fetchCoinMarketCapPrice(): Promise<BigNumber> {
  const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=ARB';
  const res = await fetch(url, {
    headers: { 'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY || '' }
  });
  if (!res.ok) throw new Error("CoinMarketCap API request failed");
  const data = await res.json();
  const price = parseFloat(data?.data?.ARB?.quote?.USD?.price);
  if (isNaN(price)) throw new Error("invalid coinmarketcap price");
  return new BigNumber(price);
}

// Compute trimmed mean – discard lowest x% and return the mean.
export function computeTrimmedMeanPrice(prices: BigNumber[], trimPercent: number): BigNumber {
  if (!prices.length) throw new Error("Cannot compute mean of an empty array");

  const sorted = prices.slice().sort((a, b) => a.comparedTo(b));
  const trimCount = Math.floor(sorted.length * trimPercent);
  const trimmed = sorted.slice(trimCount);

  if (!trimmed.length) throw new Error("All values were trimmed, cannot compute mean");

  const sum = trimmed.reduce((acc, p) => acc.plus(p), new BigNumber(0));
  return sum.dividedBy(trimmed.length);
}
