import { ethers } from "ethers"

// chainlink on-chain arb/usd price (real feed) - USD not USDC (I think its fine to use USD and assume its the same as USDC, but can reduce to two and maybe look for other USDC feeds if preferable?)
async function fetchChainlinkPrice() {
  const provider = new ethers.JsonRpcProvider('https://arb1.arbitrum.io/rpc') // public arb rpc
  const aggregatorAddress = '0xb2a8ba74cbca38508ba1632761b56c897060147c' // arb/usd chainlink feed

  // min abi for latest price & decimals
  const aggregatorABI = [
    { inputs: [], name: 'latestRoundData', outputs: [{ name: 'answer', type: 'int256' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
  ]

  const aggregatorContract = new ethers.Contract(aggregatorAddress, aggregatorABI, provider)
  const priceRaw = await aggregatorContract.latestRoundData()
  const decimals = await aggregatorContract.decimals() // get actual decimals
  console.log("chainlink raw output:", priceRaw)
  console.log("chainlink decimals:", decimals)
  // normalize and return as num
  return Number(priceRaw.answer) / Math.pow(10, Number(decimals))
}

// coingecko api price - USD 
async function fetchCoingeckoPrice() {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=arbitrum&vs_currencies=usd'
  const res = await fetch(url)
  const data = await res.json()
  console.log("coingecko raw output:", data)
  return data.arbitrum.usd
}

// coinpaprika api price - USD
async function fetchCoinPaprikaPrice() {
  const url = 'https://api.coinpaprika.com/v1/tickers/arb-arbitrum'
  const res = await fetch(url)
  const data = await res.json()
  console.log("coinpaprika raw output:", data)
  return data.quotes.USD.price
}

// okx arb/usdc price via okx api - USDC
async function fetchOKXPrice() {
  const url = 'https://www.okx.com/api/v5/market/ticker?instId=ARB-USDC'
  const res = await fetch(url)
  const data = await res.json()
  console.log("okx raw output:", data)
  return parseFloat(data.data[0].last)
}

// binance arb/usdc price via binance api - USDC
async function fetchBinancePrice() {
  const url = 'https://api.binance.com/api/v3/ticker/price?symbol=ARBUSDC'
  const res = await fetch(url)
  if (!res.ok) throw new Error('binance price fetch failed')
  const data = await res.json()
  console.log("binance raw output:", data)
  return parseFloat(data.price)
}

// fetch prices from all
async function testPrices() {
  try {
    const chainlinkPrice = await fetchChainlinkPrice()
    console.log("chainlink price:", chainlinkPrice)

    const coingeckoPrice = await fetchCoingeckoPrice()
    console.log("coingecko price:", coingeckoPrice)

    const coinpaprikaPrice = await fetchCoinPaprikaPrice()
    console.log("coinpaprika price:", coinpaprikaPrice)

    const okxPrice = await fetchOKXPrice()
    console.log("okx price:", okxPrice)

    const binancePrice = await fetchBinancePrice()
    console.log("binance price:", binancePrice)
  } catch (error) {
    console.error("error testing prices:", error)
  }
}

testPrices()
