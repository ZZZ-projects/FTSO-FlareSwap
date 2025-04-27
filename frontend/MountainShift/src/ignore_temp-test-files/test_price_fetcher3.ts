import { ethers } from "ethers";
import BigNumber from "bignumber.js";

// chainlink on-chain arb/usd price (assuming okay to assume 1 USD ≈ 1 USDC) - Chainlink provides an aggregated price feed for ARB/USD, which is more relevant for general price tracking but not specifically tied to a direct trading pair between ARB and USDC so not using
async function fetchChainlinkPrice(): Promise<BigNumber> {
  const provider = new ethers.JsonRpcProvider('https://arb1.arbitrum.io/rpc');
  const aggregatorAddress = '0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6';
  const aggregatorABI = [
    {
      inputs: [],
      name: 'latestRoundData',
      outputs: [
        { name: 'roundId', type: 'uint80' },
        { name: 'answer', type: 'int256' },
        { name: 'startedAt', type: 'uint256' },
        { name: 'updatedAt', type: 'uint256' },
        { name: 'answeredInRound', type: 'uint80' }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [],
      name: 'decimals',
      outputs: [{ name: '', type: 'uint8' }],
      stateMutability: 'view',
      type: 'function'
    }
  ];

  const aggregatorContract = new ethers.Contract(aggregatorAddress, aggregatorABI, provider);
  const roundData = await aggregatorContract.latestRoundData();
  const decimals = await aggregatorContract.decimals();
  console.log("chainlink raw output:", roundData);
  console.log("chainlink decimals:", decimals);

  const answerBN = new BigNumber(roundData.answer.toString());
  const decimalsBN = new BigNumber(10).exponentiatedBy(Number(decimals));
  const normalizedPrice = answerBN.dividedBy(decimalsBN);
  return normalizedPrice;
}

// coingecko api price (USD)
async function fetchCoingeckoPrice(): Promise<BigNumber> {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=arbitrum&vs_currencies=usd';
  const res = await fetch(url);
  const data = await res.json();
  console.log("coingecko raw output:", data);
  return new BigNumber(data.arbitrum.usd);
}

// coinpaprika api price (USD)
async function fetchCoinPaprikaPrice(): Promise<BigNumber> {
  const url = 'https://api.coinpaprika.com/v1/tickers/arb-arbitrum';
  const res = await fetch(url);
  const data = await res.json();
  console.log("coinpaprika raw output:", data);
  return new BigNumber(data.quotes.USD.price);
}

// okx arb/usdc price (USDC)
async function fetchOKXPrice(): Promise<BigNumber> {
  const url = 'https://www.okx.com/api/v5/market/ticker?instId=ARB-USDC';
  const res = await fetch(url);
  const data = await res.json();
  console.log("okx raw output:", data);
  // Use BigNumber directly from the string returned by the API
  return new BigNumber(data.data[0].last);
}

// binance arb/usdc price (USDC)
async function fetchBinancePrice(): Promise<BigNumber> {
  const url = 'https://api.binance.com/api/v3/ticker/price?symbol=ARBUSDC';
  const res = await fetch(url);
  const data = await res.json();
  console.log("binance raw output:", data);
  return new BigNumber(data.price);
}

// cryptocompare arb/usd price (USD)
async function fetchCryptoComparePrice(): Promise<BigNumber> {
  const url = 'https://min-api.cryptocompare.com/data/price?fsym=ARB&tsyms=USD';
  const res = await fetch(url);
  const data = await res.json();
  console.log("cryptocompare raw output:", data);
  return new BigNumber(data.USD);
}

// coinmarketcap arb/usd price (USD) using provided API key
async function fetchCoinMarketCapPrice(): Promise<BigNumber> {
  const apiKey = "f0e9fdf1-761a-4213-a32a-3140594f576b";
  const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=ARB';
  const res = await fetch(url, {
    headers: { 'X-CMC_PRO_API_KEY': apiKey }
  });
  const data = await res.json();
  console.log("coinmarketcap raw output:", data);
  return new BigNumber(data.data.ARB.quote.USD.price);
}

// fetch prices from all and output only the 7 numbers as BigNumbers
async function testPrices() {
  try {
    const chainlinkPrice = await fetchChainlinkPrice();
    const coingeckoPrice = await fetchCoingeckoPrice();
    const coinpaprikaPrice = await fetchCoinPaprikaPrice();
    const okxPrice = await fetchOKXPrice();
    const binancePrice = await fetchBinancePrice();
    const cryptoComparePrice = await fetchCryptoComparePrice();
    const coinMarketCapPrice = await fetchCoinMarketCapPrice();

    console.log("chainlink price:", chainlinkPrice.toFixed());
    console.log("coingecko price:", coingeckoPrice.toFixed());
    console.log("coinpaprika price:", coinpaprikaPrice.toFixed());
    console.log("okx price:", okxPrice.toFixed());
    console.log("binance price:", binancePrice.toFixed());
    console.log("cryptocompare price:", cryptoComparePrice.toFixed());
    console.log("coinmarketcap price:", coinMarketCapPrice.toFixed());
  } catch (error) {
    console.error("error testing prices:", error);
  }
}

testPrices();
