MultiPoolSwapRouter deployed to: 0xa195ACcEB1945163160CD5703Ed43E4f78176a54

# FlareSwap: A Multi Liquidity Pool Swapping Platform Powered by Flare's FTSO

![FlareSwap Banner](https://cdn.discordapp.com/attachments/1364939654142623877/1366193345860341790/image.png?ex=68100e34&is=680ebcb4&hm=19a1cb7b40f811f7f86d188429655fa98cfaf2bd7aa3535d99717c391e6fc67d&)

## 🌟 Overview

FlareSwap is a decentralized cross-chain token exchange platform built for the Flare Hackathon. It leverages the power of Flare Time Series Oracle (FTSO) to provide accurate, real-time price feeds across multiple blockchains, enabling seamless token swaps between Ethereum, Arbitrum, Rootstock, and Flare networks.

### Why FTSO?

The Flare Time Series Oracle is at the heart of FlareSwap, providing:

- Decentralized price feeds with high accuracy
- Low latency updates (every second)
- Robust security through Flare's consensus mechanism
- Support for multiple assets across different blockchains

## 🔑 Key Features

- **FTSO-Powered Price Feeds**: Real-time price data for 19 cryptocurrencies updated every second
- **Cross-Chain Swaps**: Seamlessly swap tokens between Ethereum, Arbitrum, and Rootstock networks
- **Live FTSO Dashboard**: Dedicated page showing real-time FTSO price feeds with visual indicators for price movements
- **Secure Transaction Processing**: Verification of on-chain transactions before processing swaps
- **User-Friendly Interface**: Intuitive UI with real-time feedback and transaction status updates

## 🏗️ Architecture

FlareSwap consists of two main components:

### 1. Cross-Chain Swap Engine

The swap engine facilitates token exchanges between different blockchains:

- **Frontend**: React/Next.js interface for initiating swaps
- **Backend API Routes**: Process cross-chain transactions
- **Smart Contracts**: Handle token deposits and withdrawals

### 2. FTSO Integration

The FTSO integration provides real-time price data:

- **FTSO Consumer Contract**: Connects to Flare's FTSO system
- **Price Feed API**: Fetches and processes FTSO data
- **Live Dashboard**: Visualizes FTSO price feeds with real-time updates

## 🔧 Technical Stack

- **Frontend**: Next.js, React, TailwindCSS
- **Backend**: Next.js API Routes
- **Blockchain Interaction**: ethers.js
- **Networks**: Ethereum, Arbitrum, Rootstock, Flare (Coston2)
- **FTSO Integration**: Direct contract calls to FTSO Consumer

## 📋 Setup Instructions

### Prerequisites

- Node.js 16+
- Yarn or npm
- Access to Ethereum, Arbitrum, Rootstock, and Flare (Coston2) networks

### Installation

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/yourusername/flareswap.git
   cd flareswap
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Set up environment variables:
   \`\`\`
   # Create a .env file with the following variables
   ETHEREUM_RPC_URL=https://ethereum-rpc.example.com
   ETHEREUM_PRIVATE_KEY=your_ethereum_private_key
   
   ARBITRUM_RPC_URL=https://arbitrum-rpc.example.com
   ARBITRUM_PRIVATE_KEY=your_arbitrum_private_key
   
   ROOTSTOCK_RPC_URL=https://rootstock-rpc.example.com
   ROOTSTOCK_PRIVATE_KEY=your_rootstock_private_key
   
   COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
   FTSO_CONSUMER_ADDRESS=your_ftso_consumer_contract_address
   \`\`\`

4. Run the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🚀 Usage

### Cross-Chain Swaps

1. Connect your wallet
2. Select source and destination networks
3. Enter the amount to swap and destination address
4. Confirm the transaction
5. Monitor the swap progress in real-time

### FTSO Price Dashboard

1. Navigate to `/prices` to view the FTSO price dashboard
2. See real-time price updates for 19 cryptocurrencies
3. Monitor price movements with visual indicators

## 🔮 FTSO Integration Details

FlareSwap integrates with Flare's FTSO system through a dedicated consumer contract that provides price feeds for multiple assets:

### Supported FTSO Price Feeds

![IMG2](https://cdn.discordapp.com/attachments/1364939654142623877/1366193346900398211/image.png?ex=68100e34&is=680ebcb4&hm=f190e4070465def5990340b1642671e917e22ddf2fe55194e42c5dff3bd783be&)

### FTSO Data Flow

1. The FTSO Consumer contract aggregates price data from Flare's decentralized oracle network
2. Our API endpoint calls the `fetchAllFeeds()` function to retrieve the latest price data
3. The frontend polls this endpoint every second to display real-time updates
4. Price movements are visualized with up/down indicators based on previous values

### FTSO Technical Implementation

\`\`\`typescript
// Low-level call to FTSO Consumer contract
const iface = new ethers.Interface(FTSO_CONSUMER_ABI)
const callData = iface.encodeFunctionData("fetchAllFeeds", [])
const raw = await provider.call({ to: FTSO_ADDRESS, data: callData })

// Decode the response
const [rawSyms, rawPrices, rawTss] = iface.decodeFunctionResult("fetchAllFeeds", raw)

// Process symbols and prices
for (let i = 0; i < rawSyms.length; i++) {
  const symbol = parseBytes32String(rawSyms[i])
  const price = ethers.formatUnits(rawPrices[i], 18)
  const timestamp = Number(rawTss[i])
  
  // Use the price data for swaps or display
}
\`\`\`

## 🔄 Cross-Chain Swap Process

1. **Deposit**: User deposits tokens (USDC or native currency) to our deposit contract on the source chain
2. **Verification**: Backend verifies the transaction on the source chain
3. **Price Calculation**: FTSO price feeds determine the exchange rate
4. **Payout**: Equivalent tokens are sent to the user's address on the destination chain

## 🔜 Future Development

- **Additional Networks**: Integration with more blockchain networks
- **More Token Pairs**: Support for additional token swaps
- **Advanced FTSO Features**: Utilizing FTSO for more complex financial products
- **Liquidity Pools**: Creating FTSO-powered liquidity pools for better swap rates
- **Mobile App**: Developing a mobile interface for on-the-go swaps


FTSO For on-chain pricing queries:
FTSOConsumer deployed to: 0x2d13826359803522cCe7a4Cfa2c1b582303DD0B4

Fee Verification via FDC:
SwapWithFeeGuard deployed to: 0x6212cb549De37c25071cF506aB7E115D140D9e42

Dynamic Slippage via JSON API:
DynamicSlippageSwapper deployed to: 0x6F9679BdF5F180a139d01c598839a5df4860431b 
