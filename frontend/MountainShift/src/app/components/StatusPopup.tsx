"use client"

import type React from "react"

interface StatusPopupProps {
  visible: boolean
  message: string
  status: "loading" | "success" | "error"
  txHash?: string
  finalAmount?: string
  onClose: () => void
  onReset: () => void
}

export const StatusPopup: React.FC<StatusPopupProps> = ({
  visible,
  message,
  status,
  txHash,
  finalAmount,
  onClose,
  onReset,
}) => {
  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-black/80 backdrop-blur-md border border-[#e6007a]/30 rounded-2xl p-6 shadow-lg shadow-[#e6007a]/10 max-w-md w-full mx-4">
        <div className="flex items-center mb-4">
          {status === "loading" && (
            <div className="w-6 h-6 mr-3 border-2 border-[#e6007a] border-t-transparent rounded-full animate-spin"></div>
          )}
          {status === "success" && (
            <div className="w-6 h-6 mr-3 rounded-full bg-[#e6007a]/20 flex items-center justify-center">
              <span className="text-[#e6007a]">✓</span>
            </div>
          )}
          {status === "error" && (
            <div className="w-6 h-6 mr-3 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-red-500">✕</span>
            </div>
          )}
          <h2 className="text-lg font-medium text-white">{message}</h2>
        </div>

        {txHash && (
          <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
            <p className="text-sm text-white/70 mb-1">Transaction Hash</p>
            <div className="flex items-center">
              <span className="text-white font-mono text-sm truncate">{txHash}</span>
              <a
                href={`https://arbiscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-[#e6007a] hover:text-[#ff4d94] transition-colors"
              >
                <span className="text-sm">↗</span>
              </a>
            </div>
          </div>
        )}

        {finalAmount && (
          <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
            <p className="text-sm text-white/70 mb-1">Amount</p>
            <p className="text-white font-medium">{finalAmount}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          {status === "error" && (
            <button
              onClick={onReset}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors border border-white/10"
            >
              Try Again
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gradient-to-r from-[#e6007a] to-[#ff4d94] text-white rounded-xl hover:opacity-90 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
