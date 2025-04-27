import { ethers } from "ethers";
import BigNumber from "bignumber.js";


// --------------------------
// Method 2: CoinGecko BTC/USD
// --------------------------
async function fetchCoingeckoBTCPrice(): Promise<BigNumber> {
  try {
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Coingecko API request failed");
    const data = await res.json();
    const price = data.bitcoin?.usd;
    return price ? new BigNumber(price) : new BigNumber(-1);
  } catch (error) {
    console.error("CoinGecko BTC price fetch failed:", error.message);
    return new BigNumber(-1);
  }
}

// --------------------------
// Method 3: CoinMarketCap BTC/USD
// --------------------------
async function fetchCoinMarketCapBTCPrice(): Promise<BigNumber> {
  try {
    const apiKey = "f0e9fdf1-761a-4213-a32a-3140594f576b"; // Replace with your API key if needed.
    const url = "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC";
    const res = await fetch(url, {
      headers: { "X-CMC_PRO_API_KEY": apiKey }
    });
    const data = await res.json();
    const price = data.data?.BTC?.quote?.USD?.price;
    return price ? new BigNumber(price) : new BigNumber(-1);
  } catch (error) {
    console.error("CoinMarketCap BTC price fetch failed:", error.message);
    return new BigNumber(-1);
  }
}

// --------------------------
// Method 4: Binance BTC/USDT
// --------------------------
async function fetchBinanceBTCPrice(): Promise<BigNumber> {
  try {
    const url = " ";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Binance API request failed");
    const data = await res.json();
    const price = data.price;
    return price ? new BigNumber(price) : new BigNumber(-1);
  } catch (error) {
    console.error("Binance BTC price fetch failed:", error.message);
    return new BigNumber(-1);
  }
}

// --------------------------
// Method 5: OKX BTC/USDT
// --------------------------
async function fetchOKXBTCPrice(): Promise<BigNumber> {
  try {
    const url = "https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT";
    const res = await fetch(url);
    if (!res.ok) throw new Error("OKX API request failed");
    const data = await res.json();
    const price = data?.data?.[0]?.last;
    return price ? new BigNumber(price) : new BigNumber(-1);
  } catch (error) {
    console.error("OKX BTC price fetch failed:", error.message);
    return new BigNumber(-1);
  }
}

// --------------------------
// Compute trimmed mean by discarding the lowest trimPercent of valid prices
// --------------------------
function computeTrimmedMeanBTCPrice(prices: BigNumber[], trimPercent: number): BigNumber {
  const validPrices = prices.filter(p => !p.isEqualTo(-1));
  if (!validPrices.length) return new BigNumber(-1);
  const sorted = validPrices.sort((a, b) => a.comparedTo(b));
  const trimCount = Math.floor(sorted.length * trimPercent);
  const trimmed = sorted.slice(trimCount);
  return trimmed.length ? trimmed.reduce((acc, p) => acc.plus(p), new BigNumber(0)).dividedBy(trimmed.length) : new BigNumber(-1);
}

// --------------------------
// Test function: fetch all prices and compute trimmed mean
// --------------------------
async function testBTCPrices() {
  const prices = await Promise.all([
    fetchCoingeckoBTCPrice(),
    fetchCoinMarketCapBTCPrice(),
    fetchBinanceBTCPrice(),
    fetchOKXBTCPrice()
  ]);
  
  console.log("BTC Prices (in USD):");
  prices.forEach((p, i) => console.log(`Source ${i + 1}: ${p.toFixed()}`));
  
  const finalPrice = computeTrimmedMeanBTCPrice(prices, 0.26);
  console.log("Final trimmed mean BTC price (in USD):", finalPrice.toFixed());
}

testBTCPrices();

export {
  fetchCoingeckoBTCPrice,
  fetchCoinMarketCapBTCPrice,
  fetchBinanceBTCPrice,
  fetchOKXBTCPrice,
  computeTrimmedMeanBTCPrice
};
