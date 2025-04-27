import { ethers } from "ethers"
import BigNumber from "bignumber.js"

// chainlink on-chain arb/usd price (assuming okay to assume 1 USD ≈ 1 USDC)
async function fetchChainlinkPrice() {
  const provider = new ethers.JsonRpcProvider('https://arb1.arbitrum.io/rpc')
  const aggregatorAddress = '0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6'
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
  ]

  const aggregatorContract = new ethers.Contract(aggregatorAddress, aggregatorABI, provider)
  const roundData = await aggregatorContract.latestRoundData()
  const decimals = await aggregatorContract.decimals()
  console.log("chainlink raw output:", roundData)
  console.log("chainlink decimals:", decimals)

  // use bignumber.js to avoid precision loss
  const answerBN = new BigNumber(roundData.answer.toString())
  const decimalsBN = new BigNumber(10).exponentiatedBy(Number(decimals))
  const normalizedPrice = answerBN.dividedBy(decimalsBN)
  return normalizedPrice.toNumber()
}

// coingecko api price (USD)
async function fetchCoingeckoPrice() {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=arbitrum&vs_currencies=usd'
  const res = await fetch(url)
  const data = await res.json()
  console.log("coingecko raw output:", data)
  return data.arbitrum.usd
}

// coinpaprika api price (USD)
async function fetchCoinPaprikaPrice() {
  const url = 'https://api.coinpaprika.com/v1/tickers/arb-arbitrum'
  const res = await fetch(url)
  const data = await res.json()
  console.log("coinpaprika raw output:", data)
  return data.quotes.USD.price
}

// okx arb/usdc price (USDC)
async function fetchOKXPrice() {
  const url = 'https://www.okx.com/api/v5/market/ticker?instId=ARB-USDC'
  const res = await fetch(url)
  const data = await res.json()
  console.log("okx raw output:", data)
  return parseFloat(data.data[0].last)
}

// binance arb/usdc price (USDC)
async function fetchBinancePrice() {
  const url = 'https://api.binance.com/api/v3/ticker/price?symbol=ARBUSDC'
  const res = await fetch(url)
  const data = await res.json()
  console.log("binance raw output:", data)
  return parseFloat(data.price)
}

// fetch prices from all and output only the 5 numbers
async function testPrices() {
  try {
    const chainlinkPrice = await fetchChainlinkPrice()
    const coingeckoPrice = await fetchCoingeckoPrice()
    const coinpaprikaPrice = await fetchCoinPaprikaPrice()
    const okxPrice = await fetchOKXPrice()
    const binancePrice = await fetchBinancePrice()

    console.log("chainlink price:", chainlinkPrice)
    console.log("coingecko price:", coingeckoPrice)
    console.log("coinpaprika price:", coinpaprikaPrice)
    console.log("okx price:", okxPrice)
    console.log("binance price:", binancePrice)
  } catch (error) {
    console.error("error testing prices:", error)
  }
}

testPrices()


// tl;dr okx price and binance prices are rounding quite early, so will generally dominate a concensus (median value) driven approach. If these are rounding upwards -> may incur losses. Bad. Will adjust to a lower bound or trimmed mean appraoch. Next will add proper bignumber usage across all and deploy proper approach  