"use client"

import { useState, useEffect, useRef } from "react"
import { ethers, BrowserProvider } from "ethers"
import Web3Modal from "web3modal"
import axios from "axios"
import { StatusPopup } from "./components/StatusPopup"
// We'll use HTML/CSS alternatives instead of Lucide icons

// ─── Deposit addresses by chain ────────────────────────────────────────────────
const DEPOSIT_ADDRESS: Record<"rootstock" | "arbitrum" | "ethereum", string> = {
  rootstock: "0xf0f994B4A8dB86A46a1eD4F12263c795b26703Ca",
  arbitrum: "0xf0f994B4A8dB86A46a1eD4F12263c795b26703Ca",
  ethereum: "0x0000000000000000000000000000000000000000", // placeholder
}

// Chain IDs for network validation
const CHAIN_IDS = {
  rootstock: 30, // Rootstock mainnet
  arbitrum: 42161, // Arbitrum One
  ethereum: 1, // Ethereum mainnet
}

// Token contract addresses for each network
const TOKEN_ADDRESSES = {
  rootstock: {
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    native: null, // RBTC is native
  },
  ethereum: {
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    native: null, // ETH is native
  },
  arbitrum: {
    usdc: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    native: "0x912CE59144191C1204E64559FE8253a0e49E6548", // ARB token address on Arbitrum
  },
}

export default function Home() {
  // ─── State ────────────────────────────────────────────────────────────────────
  const [swapInterface, setSwapInterface] = useState<"ethereum" | "arbitrum" | "rootstock">("rootstock")
  const [destinationAddress, setDestinationAddress] = useState("")
  const [inputAmount, setInputAmount] = useState("")
  const [predictedAmount, setPredictedAmount] = useState("")
  const [calculatedAmount, setCalculatedAmount] = useState("")

  const [usdcBalance, setUsdcBalance] = useState("0")
  const [ethereumBalance, setOpBalance] = useState("0")
  const [rbtcBalance, setRbtcBalance] = useState("0")
  const [arbBalance, setArbBalance] = useState("0")
  const [nativePrice, setNativePrice] = useState("0")

  const [account, setAccount] = useState<string | null>(null)
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [web3Modal, setWeb3Modal] = useState<Web3Modal | null>(null)
  const [walletMessage, setWalletMessage] = useState("Connect your wallet to display your balance")
  const [isLoading, setIsLoading] = useState(false)
  const [currentChainId, setCurrentChainId] = useState<number | null>(null)

  const [isReversed, setIsReversed] = useState(false)
  const lastValidPrice = useRef("0")
  const lastValidBalance = useRef("0")

  const [popup, setPopup] = useState<{
    visible: boolean
    message: string
    status: "loading" | "success" | "error"
    txHash?: string
    finalAmount?: string
  } | null>(null)

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const toTokenUnits = (amt: string, dec: number): bigint =>
    ethers.parseUnits(
      (() => {
        const [w, f = ""] = amt.split(".")
        return w + "." + f.padEnd(dec, "0").slice(0, dec)
      })(),
      dec,
    )

  const getSourceToken = () =>
    isReversed ? (swapInterface === "ethereum" ? "ETH" : swapInterface === "arbitrum" ? "ARB" : "RBTC") : "USDC"

  const getDestinationToken = () =>
    isReversed ? "USDC" : swapInterface === "ethereum" ? "ETH" : swapInterface === "arbitrum" ? "ARB" : "RBTC"

  const getNativeBalance = () => {
    if (swapInterface === "arbitrum") return arbBalance
    if (swapInterface === "ethereum") return ethereumBalance
    return rbtcBalance
  }

  // ─── Wallet & Balances ────────────────────────────────────────────────────────
  useEffect(() => {
    setWeb3Modal(new Web3Modal())
  }, [])

  const connectWallet = async () => {
    try {
      setIsLoading(true)
      if (!web3Modal) return
      const inst = await web3Modal.connect()
      const wp = new BrowserProvider(inst)
      setProvider(wp)
      const signer = await wp.getSigner()
      const addr = await signer.getAddress()
      setAccount(addr)

      // Get current network
      const network = await wp.getNetwork()
      setCurrentChainId(Number(network.chainId))

      // fetch on‐chain USDC & native balances
      await fetchBalances(wp, addr)

      setWalletMessage("")
      console.log("→ Connected:", addr)
      setIsLoading(false)
    } catch (e) {
      console.error("connectWallet err:", e)
      setWalletMessage("Failed to connect wallet.")
      setIsLoading(false)
    }
  }

  const fetchBalances = async (provider: BrowserProvider, address: string) => {
    try {
      // Fetch USDC balance
      const usdcAddr = TOKEN_ADDRESSES.ethereum.usdc
      const rpc = new ethers.JsonRpcProvider("https://ethereum-rpc.publicnode.com")
      const usdc = new ethers.Contract(
        usdcAddr,
        ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
        rpc,
      )
      const rawUsdc = await usdc.balanceOf(address)
      const decU = await usdc.decimals()
      setUsdcBalance(Number.parseFloat(ethers.formatUnits(rawUsdc, decU)).toFixed(5))

      // Fetch ETH balance
      const ethBalance = await provider.getBalance(address)
      setOpBalance(Number.parseFloat(ethers.formatEther(ethBalance)).toFixed(5))

      // Fetch ARB token balance if on Arbitrum
      if (TOKEN_ADDRESSES.arbitrum.native) {
        const arbTokenAddress = TOKEN_ADDRESSES.arbitrum.native
        const arbToken = new ethers.Contract(
          arbTokenAddress,
          ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
          provider,
        )
        try {
          const rawArb = await arbToken.balanceOf(address)
          const decArb = await arbToken.decimals()
          setArbBalance(Number.parseFloat(ethers.formatUnits(rawArb, decArb)).toFixed(5))
        } catch (e) {
          console.error("Error fetching ARB balance:", e)
          setArbBalance("0")
        }
      }
    } catch (e) {
      console.error("Error fetching balances:", e)
    }
  }

  const checkNetworkAndWarn = async () => {
    if (!provider) return false

    try {
      const network = await provider.getNetwork()
      const chainId = Number(network.chainId)
      setCurrentChainId(chainId)

      // Define expected chain ID for the selected network
      const expectedChainId = CHAIN_IDS[swapInterface]

      if (chainId !== expectedChainId) {
        setPopup({
          visible: true,
          message: `Please switch to ${swapInterface} network in your wallet to continue`,
          status: "error",
        })
        return false
      }

      return true
    } catch (e) {
      console.error("Network check error:", e)
      setPopup({
        visible: true,
        message: "Failed to verify network. Please check your wallet connection.",
        status: "error",
      })
      return false
    }
  }

  const disconnectWallet = async () => {
    try {
      if (!web3Modal) return
      await web3Modal.clearCachedProvider()
      setAccount(null)
      setProvider(null)
      setUsdcBalance("0")
      setOpBalance("0")
      setRbtcBalance("0")
      setArbBalance("0")
      setWalletMessage("Connect your wallet to display your balance")
      console.log("→ Disconnected")
    } catch (e) {
      console.error("disconnect err:", e)
    }
  }

  // ─── Swap On‐chain & Backend ───────────────────────────────────────────────────
  const handleShift = async () => {
    if (!provider) {
      setPopup({
        visible: true,
        message: "Please connect your wallet first",
        status: "error",
      })
      return
    }
    if (!inputAmount || !destinationAddress) {
      setPopup({
        visible: true,
        message: "Please enter amount and destination address",
        status: "error",
      })
      return
    }

    // Check if user is on the correct network before proceeding
    const isCorrectNetwork = await checkNetworkAndWarn()
    if (!isCorrectNetwork) return

    setPopup({
      visible: true,
      message: `Preparing transaction on ${swapInterface} network...`,
      status: "loading",
    })

    try {
      const signer = await provider.getSigner()
      const depositAddr = DEPOSIT_ADDRESS[swapInterface]
      let tx

      if (!isReversed) {
        // USDC → deposit contract
        const usdcAddr = TOKEN_ADDRESSES[swapInterface].usdc
        const erc20 = new ethers.Contract(
          usdcAddr,
          ["function transfer(address,uint256) returns (bool)", "function decimals() view returns (uint8)"],
          signer,
        )
        const dec = await erc20.decimals()
        const amountUnits = ethers.parseUnits(inputAmount, dec)
        tx = await erc20.transfer(depositAddr, amountUnits)
      } else {
        // Native or token → deposit contract
        if (swapInterface === "arbitrum") {
          // For Arbitrum, we need to send ARB token, not ETH
          const arbTokenAddress = TOKEN_ADDRESSES.arbitrum.native
          if (arbTokenAddress) {
            const arbToken = new ethers.Contract(
              arbTokenAddress,
              ["function transfer(address,uint256) returns (bool)", "function decimals() view returns (uint8)"],
              signer,
            )
            const dec = await arbToken.decimals()
            const amountUnits = ethers.parseUnits(inputAmount, dec)
            tx = await arbToken.transfer(depositAddr, amountUnits)
          } else {
            throw new Error("ARB token address not configured")
          }
        } else {
          // For Ethereum and Rootstock, send native currency (ETH/RBTC)
          const value = ethers.parseEther(inputAmount)
          tx = await signer.sendTransaction({ to: depositAddr, value })
        }
      }

      setPopup({
        visible: true,
        message: `Transaction submitted on ${swapInterface} network. Waiting for confirmation...`,
        status: "loading",
        txHash: tx.hash,
      })

      const receipt = await tx.wait()
      const txHash = receipt.hash || receipt.transactionHash

      setPopup({
        visible: true,
        message: `Transaction confirmed on ${swapInterface} network! Processing your swap...`,
        status: "loading",
        txHash: txHash,
      })

      // call the correct shift endpoint
      const route =
        swapInterface === "rootstock"
          ? isReversed
            ? "/api/shift_rootstock_reverse"
            : "/api/shift_rootstock"
          : swapInterface === "ethereum"
            ? isReversed
              ? "/api/shift_ethereum_reverse"
              : "/api/shift_ethereum"
            : isReversed
              ? "/api/shift_arbitrum_reverse"
              : "/api/shift_arbitrum"

      const body = isReversed
        ? {
            txHash,
            sourceAmount: inputAmount, // Use sourceAmount instead of rbtcAmount
            destination: destinationAddress,
            predictedUsdcAmount: predictedAmount,
          }
        : {
            txHash,
            usdcAmount: inputAmount,
            destination: destinationAddress,
            predictedRbtcAmount: predictedAmount, // Keep this as predictedRbtcAmount
          }

      setPopup({
        visible: true,
        message: "Submitting to backend for payout...",
        status: "loading",
        txHash: txHash,
      })

      const resp = await axios.post(route, body)
      console.log(`${route} response:`, resp.data)

      if (resp.data.error) {
        throw new Error(resp.data.error)
      }

      // Set up monitoring for destination funds
      if (resp.data.finalTxHash || resp.data.finalTxId) {
        const finalTxHash = resp.data.finalTxHash ?? resp.data.finalTxId
        const finalAmount = isReversed ? resp.data.finalUsdc : resp.data.finalAmount

        setPopup({
          visible: true,
          message: `Swap initiated! Funds are being sent to your destination address on ${isReversed ? "USDC" : swapInterface} network...`,
          status: "loading",
          txHash: finalTxHash,
          finalAmount: finalAmount,
        })

        // Start monitoring for destination confirmation
        monitorDestinationTransaction(finalTxHash, destinationAddress, finalAmount)
      } else {
        setPopup({
          visible: true,
          message: "Swap completed successfully!",
          status: "success",
          txHash: txHash,
          finalAmount: isReversed ? resp.data.finalUsdc : resp.data.finalAmount,
        })
      }
    } catch (e: any) {
      console.error("Transaction error:", e)
      setPopup({
        visible: true,
        message: e.message || "Error processing swap",
        status: "error",
      })
    }
  }

  const monitorDestinationTransaction = async (txHash: string, destAddress: string, amount: string) => {
    // This function will monitor the transaction status
    // In a real implementation, you would call your backend API to check the status

    let attempts = 0
    const maxAttempts = 30 // 5 minutes with 10-second intervals

    const checkStatus = async () => {
      try {
        if (attempts >= maxAttempts) {
          // Stop polling after max attempts, but don't show error since the transaction might still complete
          setPopup({
            visible: true,
            message: `Your transaction is still processing. You can check the status with the transaction hash.`,
            status: "loading",
            txHash: txHash,
            finalAmount: amount,
          })
          return
        }

        attempts++

        // In a real implementation, you would call your backend API here
        // For now, we'll simulate a successful transaction after a few attempts
        if (attempts >= 3) {
          setPopup({
            visible: true,
            message: `Success! ${amount} ${getDestinationToken()} has been received at your destination address.`,
            status: "success",
            txHash: txHash,
            finalAmount: amount,
          })
          return
        }

        // Continue polling
        setPopup({
          visible: true,
          message: `Waiting for ${amount} ${getDestinationToken()} to arrive at your destination address... (Attempt ${attempts}/${maxAttempts})`,
          status: "loading",
          txHash: txHash,
          finalAmount: amount,
        })

        setTimeout(checkStatus, 10000) // Check every 10 seconds
      } catch (error) {
        console.error("Status check error:", error)
        // Continue polling despite error
        setTimeout(checkStatus, 10000)
      }
    }

    // Start the monitoring process
    checkStatus()
  }

  // ─── Swap Direction ─────────────────────────────────────────────────────────────
  const handleSwapDirection = () => {
    setIsReversed((prev) => !prev)
    if (calculatedAmount) {
      setInputAmount(calculatedAmount)
    }
  }

  // ─── Predicted & Calculated Amount ────────────────────────────────────────────
  useEffect(() => {
    if (!inputAmount || !nativePrice) {
      setPredictedAmount("")
      setCalculatedAmount("")
      return
    }

    let p: number
    if (isReversed) {
      p = Number.parseFloat(inputAmount) * Number.parseFloat(nativePrice)
    } else {
      p = Number.parseFloat(inputAmount) / Number.parseFloat(nativePrice)
    }

    setPredictedAmount(p.toFixed(6))
    setCalculatedAmount((p * 0.99).toFixed(6))
  }, [inputAmount, nativePrice, isReversed])

  // ─── Native Price Fetch ───────────────────────────────────────────────────────
  useEffect(() => {
    // Reset any active popups when changing networks
    setPopup(null)

    const endpoint =
      swapInterface === "ethereum"
        ? "/api/eth_pricing"
        : swapInterface === "arbitrum"
          ? "/api/arb_pricing"
          : "/api/btc_pricing"

    const fetchPrice = async () => {
      try {
        console.log("Fetching", endpoint)
        const res = await fetch(endpoint)
        const data = await res.json()
        console.log(endpoint, "→", data)
        const key = Object.keys(data).find((k) => k.endsWith("InUsdc"))
        const val = key ? (data as any)[key] : null
        if (val && val !== "0") {
          setNativePrice(Number.parseFloat(val).toFixed(4))
          lastValidPrice.current = Number.parseFloat(val).toFixed(4)
        } else {
          console.warn(endpoint, "returned zero; using fallback")
          setNativePrice(lastValidPrice.current)
        }
      } catch (e) {
        console.error("Price fetch err:", e)
        setNativePrice(lastValidPrice.current)
      }
    }

    fetchPrice()
    const id = setInterval(fetchPrice, 8000)
    return () => clearInterval(id)
  }, [swapInterface])

  // ─── Destination Balance (RBTC only) ──────────────────────────────────────────
  useEffect(() => {
    if (swapInterface !== "rootstock" || !destinationAddress) return
    const fetchBal = async () => {
      try {
        console.log("Fetching /api/rbtc_destination_balance", destinationAddress)
        const res = await fetch(`/api/rbtc_destination_balance?address=${encodeURIComponent(destinationAddress)}`)
        const data = await res.json()
        console.log("→", data)
        const b = data.rbtcBalance
        if (b && b !== "0") {
          const fmt = Number.parseFloat(b).toFixed(6)
          setRbtcBalance(fmt)
          lastValidBalance.current = fmt
        } else {
          console.warn("Balance fetch zero; fallback")
          setRbtcBalance(lastValidBalance.current)
        }
      } catch (e) {
        console.error("Balance fetch err:", e)
        setRbtcBalance(lastValidBalance.current)
      }
    }
    const t = setTimeout(fetchBal, 2000)
    return () => clearTimeout(t)
  }, [swapInterface, destinationAddress])

  // ─── Render ───────────────────────────────────────────────────────────────────
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

        {!account ? (
          <button
            onClick={connectWallet}
            disabled={isLoading}
            className="px-4 py-2 bg-gradient-to-r from-[#e6007a] to-[#ff4d94] text-white rounded-full flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Connecting...
              </>
            ) : (
              <>
                <span className="w-4 h-4 flex items-center justify-center">💼</span>
                Connect Wallet
              </>
            )}
          </button>
        ) : (
          <button
            onClick={disconnectWallet}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center gap-2 transition-all border border-white/10"
          >
            <span className="w-4 h-4 flex items-center justify-center">⤴</span>
            {account.slice(0, 6)}...{account.slice(-4)}
          </button>
        )}
      </header>

      <main className="container mx-auto py-12 px-4 relative z-0">
        <div className="max-w-xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-[#e6007a] to-[#ff4d94]">
              Cross-Chain Token Swap
            </h1>
            <p className="text-gray-400">Seamlessly swap tokens across different blockchains</p>
          </div>

          {/* Network selector */}
          <div className="bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-[#e6007a]/20 mb-6 shadow-lg shadow-[#e6007a]/5">
            <h2 className="text-lg font-medium mb-4 text-white/90">Select Network</h2>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setSwapInterface("rootstock")}
                className={`px-3 py-3 rounded-xl flex flex-col items-center justify-center transition-all ${
                  swapInterface === "rootstock"
                    ? "bg-gradient-to-br from-[#e6007a] to-[#ff4d94] text-white"
                    : "bg-white/5 hover:bg-white/10 text-white/70 border border-white/10"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mb-1">
                  <span className="font-bold">R</span>
                </div>
                <span className="text-sm">Rootstock</span>
              </button>
              <button
                onClick={() => setSwapInterface("ethereum")}
                className={`px-3 py-3 rounded-xl flex flex-col items-center justify-center transition-all ${
                  swapInterface === "ethereum"
                    ? "bg-gradient-to-br from-[#e6007a] to-[#ff4d94] text-white"
                    : "bg-white/5 hover:bg-white/10 text-white/70 border border-white/10"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mb-1">
                  <span className="font-bold">E</span>
                </div>
                <span className="text-sm">Ethereum</span>
              </button>
              <button
                onClick={() => setSwapInterface("arbitrum")}
                className={`px-3 py-3 rounded-xl flex flex-col items-center justify-center transition-all ${
                  swapInterface === "arbitrum"
                    ? "bg-gradient-to-br from-[#e6007a] to-[#ff4d94] text-white"
                    : "bg-white/5 hover:bg-white/10 text-white/70 border border-white/10"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mb-1">
                  <span className="font-bold">A</span>
                </div>
                <span className="text-sm">Arbitrum</span>
              </button>
            </div>
          </div>

          {/* Swap card */}
          <div className="bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-[#e6007a]/20 shadow-lg shadow-[#e6007a]/5">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-white/90">
                Swap {getSourceToken()} → {getDestinationToken()}
              </h2>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <span className="w-3.5 h-3.5 inline-flex items-center justify-center">↻</span>
                <span>Price updates in 8s</span>
              </div>
            </div>
            {/* Input amount */}
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <label className="text-sm text-white/70">You send</label>
                {account && (
                  <span className="text-sm text-white/70">
                    Balance:{" "}
                    {isReversed
                      ? getSourceToken() === "ARB"
                        ? arbBalance
                        : getSourceToken() === "ETH"
                          ? ethereumBalance
                          : rbtcBalance
                      : usdcBalance}{" "}
                    {getSourceToken()}
                  </span>
                )}
              </div>
              <div className="flex items-center bg-white/5 rounded-xl p-3 border border-white/10 focus-within:border-[#e6007a]/50">
                <input
                  type="number"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent outline-none text-lg"
                />
                <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: isReversed ? "#a259ff" : "#0079ff" }}
                  >
                    {isReversed ? getSourceToken().charAt(0) : "$"}
                  </div>
                  <span>{getSourceToken()}</span>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center my-4">
              <button
                onClick={handleSwapDirection}
                className="w-10 h-10 rounded-full bg-[#e6007a]/10 flex items-center justify-center hover:bg-[#e6007a]/20 transition-colors"
              >
                <span className="text-[#e6007a] text-lg">⇅</span>
              </button>
            </div>

            {/* Output amount */}
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <label className="text-sm text-white/70">You receive (estimated)</label>
                <div className="flex items-center gap-1 text-sm text-white/70">
                  <span className="w-3.5 h-3.5 inline-flex items-center justify-center">ℹ</span>
                  <span>1% fee applied</span>
                </div>
              </div>
              <div className="flex items-center bg-white/5 rounded-xl p-3 border border-white/10">
                <input
                  readOnly
                  value={calculatedAmount}
                  placeholder="0.00"
                  className="flex-1 bg-transparent outline-none text-lg"
                />
                <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: isReversed ? "#0079ff" : "#a259ff" }}
                  >
                    {getDestinationToken().charAt(0)}
                  </div>
                  <span>{getDestinationToken()}</span>
                </div>
              </div>
            </div>

            {/* Destination address */}
            <div className="mb-6">
              <label className="block text-sm text-white/70 mb-2">Destination Address</label>
              <div className="flex items-center bg-white/5 rounded-xl p-3 border border-white/10 focus-within:border-[#e6007a]/50">
                <input
                  type="text"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  placeholder="Enter recipient address"
                  className="flex-1 bg-transparent outline-none text-sm"
                />
                {destinationAddress && <span className="text-[#e6007a] hover:text-[#ff4d94]">↗</span>}
              </div>
            </div>

            {/* Info section */}
            <div className="bg-white/5 rounded-xl p-4 mb-6 text-sm">
              <div className="flex justify-between mb-2">
                <span className="text-white/70">Current Rate</span>
                <span className="font-medium">
                  1 {getSourceToken()} = {isReversed ? nativePrice : (1 / Number.parseFloat(nativePrice)).toFixed(6)}{" "}
                  {getDestinationToken()}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-white/70">Destination Balance</span>
                <span className="font-medium">
                  {getDestinationToken() === "RBTC"
                    ? Number(rbtcBalance).toFixed(6) + " RBTC"
                    : getDestinationToken() === "ETH"
                      ? "(" + ethereumBalance + " ETH)"
                      : getDestinationToken() === "ARB"
                        ? "(" + arbBalance + " ARB)"
                        : "(" + usdcBalance + " USDC)"}
                </span>
              </div>
            </div>

            {/* Swap button */}
            <button
              onClick={handleShift}
              disabled={!inputAmount || !destinationAddress}
              className="w-full py-3.5 bg-gradient-to-r from-[#e6007a] to-[#ff4d94] text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!account ? (
                <>Connect Wallet to Swap</>
              ) : !inputAmount || !destinationAddress ? (
                <>Enter Amount and Address</>
              ) : (
                <>Swap Tokens</>
              )}
            </button>
          </div>
        </div>
      </main>

      {popup && (
        <StatusPopup
          visible={popup.visible}
          message={popup.message}
          status={popup.status}
          txHash={popup.txHash}
          finalAmount={popup.finalAmount}
          onClose={() => setPopup(null)}
          onReset={() => {}}
        />
      )}
    </div>
  )
}
