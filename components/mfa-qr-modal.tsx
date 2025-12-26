"use client"

import QRCode from "qrcode.react"

interface MFAQRModalProps {
  open: boolean
  onClose: () => void
  secret: string
}

export default function MFAQRModal({ open, onClose, secret }: MFAQRModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 space-y-6">
        <h2 className="text-2xl font-bold">Setup Two-Factor Authentication</h2>

        <div className="p-4 bg-background rounded-lg flex justify-center">
          <QRCode value={`otpauth://totp/EMS?secret=${secret}`} size={200} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Manual Entry Code:</p>
          <p className="font-mono bg-secondary/20 p-3 rounded-lg text-center break-all">{secret}</p>
        </div>

        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">Important:</span> Save this code. You'll need it to recover your
            account if you lose access to your authenticator.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
