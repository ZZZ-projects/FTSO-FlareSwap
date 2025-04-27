"use client"

import { useState, useEffect } from "react"
import { ArrowUp, ArrowDown, RefreshCw } from "lucide-react"

interface PriceData {
  symbol: string
  price: string
  formattedPrice: string
  timestamp: number
  formattedTime: string
  found: boolean
}

interface PriceResponse {
  prices: PriceData[]
  allSymbols: string[]
  lastUpdated: string
}

export default function PricesPage() {
  const [priceData, setPriceData] = useState<PriceData[]>([])
  const [lastUpdated, setLastUpdated] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [previousPrices, setPreviousPrices] = useState<Record<string, string>>({})
  const [apiLogs, setApiLogs] = useState<string[]>([])

  // Function to fetch prices
  const fetchPrices = async () => {
    try {
      // Log the API request
      const apiUrl = "/api/ftso_prices" // Using underscore, not hyphen
      const logMessage = `Fetching from: ${apiUrl} at ${new Date().toISOString()}`
      setApiLogs((prev) => [logMessage, ...prev.slice(0, 9)]) // Keep last 10 logs

      const response = await fetch(apiUrl)

      if (!response.ok) {
        const errorMessage = `HTTP error! Status: ${response.status}, URL: ${apiUrl}`
        setApiLogs((prev) => [errorMessage, ...prev.slice(0, 9)])
        throw new Error(errorMessage)
      }

      const data: PriceResponse = await response.json()
      setApiLogs((prev) => [
        `Success! Got ${data.prices?.length || 0} prices at ${new Date().toISOString()}`,
        ...prev.slice(0, 9),
      ])

      // Save previous prices for comparison
      const prevPrices: Record<string, string> = {}
      priceData.forEach((item) => {
        prevPrices[item.symbol] = item.price
      })
      setPreviousPrices(prevPrices)

      // Update state with new data
      setPriceData(data.prices)
      setLastUpdated(data.lastUpdated)
      setLoading(false)
      setError(null)
    } catch (err: any) {
      console.error("Error fetching price data:", err)
      setApiLogs((prev) => [`Error: ${err.message}`, ...prev.slice(0, 9)])
      setError(err.message || "Failed to fetch price data")
      setLoading(false)
    }
  }

  // Initial fetch and set up interval
  useEffect(() => {
    fetchPrices()

    // Set up interval to fetch prices every second
    const intervalId = setInterval(fetchPrices, 1000)

    // Clean up interval on component unmount
    return () => clearInterval(intervalId)
  }, [])

  // Helper function to determine price change direction
  const getPriceDirection = (symbol: string, currentPrice: string): "up" | "down" | "none" => {
    const previous = previousPrices[symbol]
    if (!previous) return "none"

    const prevValue = Number.parseFloat(previous)
    const currValue = Number.parseFloat(currentPrice)

    if (currValue > prevValue) return "up"
    if (currValue < prevValue) return "down"
    return "none"
  }

  // Try alternative API endpoints
  const tryAlternativeEndpoint = (endpoint: string) => {
    setApiLogs((prev) => [`Trying alternative endpoint: ${endpoint}`, ...prev.slice(0, 9)])
    fetch(endpoint)
      .then((response) => {
        if (!response.ok) {
          setApiLogs((prev) => [
            `Alternative endpoint ${endpoint} failed with status ${response.status}`,
            ...prev.slice(0, 9),
          ])
          return null
        }
        return response.json()
      })
      .then((data) => {
        if (data) {
          setApiLogs((prev) => [`Alternative endpoint ${endpoint} succeeded!`, ...prev.slice(0, 9)])
        }
      })
      .catch((err) => {
        setApiLogs((prev) => [`Alternative endpoint ${endpoint} error: ${err.message}`, ...prev.slice(0, 9)])
      })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] text-white">
      {/* Particle Background Effect */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-[#e6007a]/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-20 w-80 h-80 bg-[#e6007a]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-[#e6007a]/15 rounded-full blur-3xl"></div>
      </div>

      <header className="sticky top-0 z-10 backdrop-blur-md bg-black/30 border-b border-[#e6007a]/20 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 bg-[#e6007a] rounded-full blur-sm opacity-70"></div>
            <div className="absolute inset-0 flex items-center justify-center font-bold text-white">F</div>
          </div>
          <span className="font-bold text-xl">Flare Swap</span>
        </div>
        <a
          href="/"
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center gap-2 transition-all border border-white/10"
        >
          Back to Swap
        </a>
      </header>

      <main className="container mx-auto py-12 px-4 relative z-0">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-[#e6007a] to-[#ff4d94]">
              Live FTSO Price Feed
            </h1>
            <p className="text-gray-400">Real-time price data from Flare Time Series Oracle</p>
          </div>

          <div className="bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-[#e6007a]/20 mb-6 shadow-lg shadow-[#e6007a]/5">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-white/90">Currency Prices</h2>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#e6007a]" />
                <span className="text-sm text-white/60">Updates every second</span>
              </div>
            </div>

            {loading && priceData.length === 0 ? (
              <div className="flex flex-col justify-center items-center py-12">
                <div className="flex items-center mb-6">
                  <div className="w-8 h-8 border-2 border-[#e6007a] border-t-transparent rounded-full animate-spin"></div>
                  <span className="ml-3 text-white/70">Loading price data...</span>
                </div>

                {/* Debug section */}
                <div className="w-full max-w-lg mt-4 bg-black/50 rounded-lg p-4 border border-white/10">
                  <h3 className="text-sm font-medium text-white/70 mb-2">API Request Logs:</h3>
                  <div className="text-xs font-mono text-white/60 max-h-40 overflow-y-auto">
                    {apiLogs.length > 0 ? (
                      apiLogs.map((log, i) => (
                        <div key={i} className="py-1 border-b border-white/5 last:border-0">
                          {log}
                        </div>
                      ))
                    ) : (
                      <div>No logs yet</div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => tryAlternativeEndpoint("/api/ftso_prices")}
                      className="text-xs px-2 py-1 bg-[#e6007a]/20 rounded-md text-[#e6007a]"
                    >
                      Try /api/ftso_prices
                    </button>
                    <button
                      onClick={() => tryAlternativeEndpoint("/api/ftso-prices")}
                      className="text-xs px-2 py-1 bg-[#e6007a]/20 rounded-md text-[#e6007a]"
                    >
                      Try /api/ftso-prices
                    </button>
                    <button
                      onClick={() => tryAlternativeEndpoint("/api/ftso/prices")}
                      className="text-xs px-2 py-1 bg-[#e6007a]/20 rounded-md text-[#e6007a]"
                    >
                      Try /api/ftso/prices
                    </button>
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <p className="text-red-400 text-center mb-4">{error}</p>

                {/* Debug section */}
                <div className="w-full bg-black/50 rounded-lg p-4 border border-white/10 mb-4">
                  <h3 className="text-sm font-medium text-white/70 mb-2">API Request Logs:</h3>
                  <div className="text-xs font-mono text-white/60 max-h-40 overflow-y-auto">
                    {apiLogs.length > 0 ? (
                      apiLogs.map((log, i) => (
                        <div key={i} className="py-1 border-b border-white/5 last:border-0">
                          {log}
                        </div>
                      ))
                    ) : (
                      <div>No logs yet</div>
                    )}
                  </div>
                </div>

                <div className="flex justify-center gap-2">
                  <button
                    onClick={fetchPrices}
                    className="px-4 py-2 bg-[#e6007a]/20 hover:bg-[#e6007a]/30 rounded-lg text-[#e6007a] transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {priceData.map((item) => {
                    const direction = getPriceDirection(item.symbol, item.price)
                    return (
                      <div
                        key={item.symbol}
                        className={`bg-white/5 rounded-xl p-4 border ${
                          item.found ? "border-white/10 hover:border-[#e6007a]/30" : "border-red-500/20"
                        } transition-colors`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-medium">{item.symbol}</h3>
                          {item.found ? (
                            <div
                              className={`text-xs px-2 py-1 rounded-full ${
                                direction === "up"
                                  ? "bg-green-500/20 text-green-400"
                                  : direction === "down"
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-gray-500/20 text-gray-400"
                              }`}
                            >
                              {direction === "up" ? (
                                <div className="flex items-center">
                                  <ArrowUp className="w-3 h-3 mr-1" />
                                  <span>Up</span>
                                </div>
                              ) : direction === "down" ? (
                                <div className="flex items-center">
                                  <ArrowDown className="w-3 h-3 mr-1" />
                                  <span>Down</span>
                                </div>
                              ) : (
                                <span>Stable</span>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400">Not Found</div>
                          )}
                        </div>
                        {item.found ? (
                          <>
                            <div className="text-2xl font-bold mb-1">
                              {Number.parseFloat(item.formattedPrice).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 6,
                              })}
                            </div>
                            <div className="text-xs text-white/50">
                              Last updated: {new Date(item.timestamp * 1000).toLocaleTimeString()}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-red-400/70 mt-2">Symbol not available in FTSO feed</div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="mt-6 text-center text-sm text-white/50">
                  Data refreshed at: {new Date(lastUpdated).toLocaleTimeString()}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
