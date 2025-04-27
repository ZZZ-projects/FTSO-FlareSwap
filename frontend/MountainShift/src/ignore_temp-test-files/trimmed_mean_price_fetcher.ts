import { ethers } from "ethers";
import BigNumber from "bignumber.js";

// Fetch Chainlink on-chain ARB/USD price
async function fetchChainlinkPrice(): Promise<BigNumber> {
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

    console.log("Chainlink raw output:", roundData);
    console.log("Chainlink decimals:", decimals);

    if (!roundData || roundData.answer === undefined || isNaN(Number(roundData.answer))) {
      throw new Error("Invalid Chainlink API response");
    }

    return new BigNumber(roundData.answer.toString()).dividedBy(new BigNumber(10).pow(decimals));
  } catch (error) {
    throw new Error(`Chainlink price fetch failed: ${error.message}`);
  }
}

// Fetch Coingecko ARB/USD price
async function fetchCoingeckoPrice(): Promise<BigNumber> {
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
  } catch (error) {
    throw new Error(`Coingecko price fetch failed: ${error.message}`);
  }
}

// Fetch CoinPaprika ARB/USD price
async function fetchCoinPaprikaPrice(): Promise<BigNumber> {
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
  } catch (error) {
    throw new Error(`CoinPaprika price fetch failed: ${error.message}`);
  }
}

// Fetch OKX ARB/USDC price
async function fetchOKXPrice(): Promise<BigNumber> {
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
    return price.isNaN() ? new BigNumber(NaN) : price;
  } catch (error) {
    throw new Error(`OKX price fetch failed: ${error.message}`);
  }
}

// Fetch Binance ARB/USDC price
async function fetchBinancePrice(): Promise<BigNumber> {
  try {
    const url = "https://api.binance.com/api/v3/ticker/price?symbol=ARBUSDC";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Binance API request failed");

    const data = await res.json();
    console.log("Binance raw output:", data);

    if (!data || typeof data !== "object" || !data.price || typeof data.price !== "string") {
      throw new Error("Invalid Binance API response");
    }

    const price = new BigNumber(data.price);
    if (price.isNaN()) throw new Error("Invalid Binance price data");

    return price;
  } catch (error) {
    throw new Error(`Binance price fetch failed: ${error.message}`);
  }
}

// Fetch CoinMarketCap ARB/USD price
// CoinMarketCap API key: f0e9fdf1-761a-4213-a32a-3140594f576b
async function fetchCoinMarketCapPrice(): Promise<BigNumber> {
  try {
    const apiKey = "f0e9fdf1-761a-4213-a32a-3140594f576b";
    const url = "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=ARB";
    const res = await fetch(url, {
      headers: { "X-CMC_PRO_API_KEY": apiKey }
    });
    const data = await res.json();
    console.log("CoinMarketCap raw output:", data);

    if (!data || !data.data || !data.data.ARB || !data.data.ARB.quote || !data.data.ARB.quote.USD) {
      throw new Error("Invalid CoinMarketCap API response");
    }
    return new BigNumber(data.data.ARB.quote.USD.price);
  } catch (error) {
    throw new Error(`CoinMarketCap price fetch failed: ${error.message}`);
  }
}

// Compute trimmed mean - discard lowest x% of values and return mean
function computeTrimmedMeanPrice(prices: BigNumber[], trimPercent: number): BigNumber {
  if (!prices.length) throw new Error("Cannot compute mean of an empty array");

  const sorted = prices.slice().sort((a, b) => a.comparedTo(b));
  const trimCount = Math.floor(sorted.length * trimPercent);
  const trimmed = sorted.slice(trimCount);

  if (!trimmed.length) throw new Error("All values were trimmed, cannot compute mean");

  const sum = trimmed.reduce((acc, p) => acc.plus(p), new BigNumber(0));
  return sum.dividedBy(trimmed.length);
}

// Test function to fetch prices and compute final trimmed mean.
// This function fetches all prices from the different APIs.
async function testPrices() {
  try {
    const prices = await Promise.all([
      fetchChainlinkPrice(),
      fetchCoingeckoPrice(),
      fetchCoinPaprikaPrice(),
      fetchOKXPrice(),
      fetchBinancePrice(),
      fetchCoinMarketCapPrice()
    ]);

    console.log("Individual prices:");
    prices.forEach((p, i) => console.log(`Price ${i + 1}: ${p.toFixed()}`));

    const finalPrice = computeTrimmedMeanPrice(prices, 0.41);
    console.log("Final trimmed mean price:", finalPrice.toFixed());
  } catch (error) {
    console.error("Error testing prices:", error.message);
  }
}

testPrices();

export {
  fetchChainlinkPrice,
  fetchCoingeckoPrice,
  fetchCoinPaprikaPrice,
  fetchOKXPrice,
  fetchCoinMarketCapPrice,
  fetchBinancePrice,
  computeTrimmedMeanPrice
};
