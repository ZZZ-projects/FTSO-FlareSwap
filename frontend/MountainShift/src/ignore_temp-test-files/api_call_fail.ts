import { fetchCoingeckoPrice, fetchCoinPaprikaPrice, fetchOKXPrice, fetchBinancePrice } from "./trimmed_mean_price_fetcher";
import BigNumber from "bignumber.js";

// In‑memory store for last known good prices.
const lastKnownValues: {
  coingecko?: BigNumber;
  coinpaprika?: BigNumber;
  okx?: BigNumber;
  binance?: BigNumber;
} = {};

/**
 * Wraps an API call. On success, updates the last known good value.
 * On error, returns the last known good value if available; otherwise returns the provided fallback.
 */
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
    console.error(`Error fetching ${key} price:`, error.message);
    if (lastKnownValues[key]) {
      console.warn(`Using last known good value for ${key}: ${lastKnownValues[key]!.toFixed()}`);
      return lastKnownValues[key]!;
    } else {
      console.warn(`No last known good value for ${key}. Using fallback: ${fallback.toFixed()}`);
      return fallback;
    }
  }
}

export async function getCoingeckoPriceGracefully(fallback: BigNumber): Promise<BigNumber> {
  return getPriceGracefully(() => fetchCoingeckoPrice(), "coingecko", fallback);
}

export async function getCoinPaprikaPriceGracefully(fallback: BigNumber): Promise<BigNumber> {
  return getPriceGracefully(() => fetchCoinPaprikaPrice(), "coinpaprika", fallback);
}

export async function getOKXPriceGracefully(fallback: BigNumber): Promise<BigNumber> {
  return getPriceGracefully(() => fetchOKXPrice(), "okx", fallback);
}

export async function getBinancePriceGracefully(fallback: BigNumber): Promise<BigNumber> {
  return getPriceGracefully(() => fetchBinancePrice(), "binance", fallback);
}

// For testing purposes, allow clearing stored values.
export function clearLastKnownValues(): void {
  lastKnownValues.coingecko = undefined;
  lastKnownValues.coinpaprika = undefined;
  lastKnownValues.okx = undefined;
  lastKnownValues.binance = undefined;
}
