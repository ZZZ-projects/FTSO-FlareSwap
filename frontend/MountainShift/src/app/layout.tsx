import type React from "react"
import "./styles/custom.css"

export const metadata = {
  title: "Mountainswap Interface",
  description: "Swap USDC on Optimism for ARB on Arbitrum",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}

