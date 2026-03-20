'use client'

import { QRCodeSVG } from 'qrcode.react'

interface QRCodeProps {
  value: string
  size?: number
  className?: string
}

export function QRCode({ value, size = 128, className }: QRCodeProps) {
  return (
    <QRCodeSVG 
      value={value} 
      size={size} 
      level="M"
      className={className}
    />
  )
}
