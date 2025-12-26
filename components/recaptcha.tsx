'use client'

import { useEffect, useRef } from 'react'

interface ReCAPTCHAProps {
  siteKey: string
  onChange: (token: string | null) => void
  onError?: () => void
  theme?: 'light' | 'dark'
  size?: 'normal' | 'compact'
}

declare global {
  interface Window {
    grecaptcha: any
    recaptchaCallback?: () => void
  }
}

/**
 * ReCAPTCHA v2 Component
 * A user-friendly CAPTCHA that shows "I'm not a robot" checkbox
 */
export function ReCAPTCHA({ siteKey, onChange, onError, theme = 'light', size = 'normal' }: ReCAPTCHAProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<number | null>(null)

  useEffect(() => {
    // Load reCAPTCHA script
    if (!document.getElementById('recaptcha-script')) {
      const script = document.createElement('script')
      script.id = 'recaptcha-script'
      script.src = 'https://www.google.com/recaptcha/api.js?render=explicit'
      script.async = true
      script.defer = true
      document.body.appendChild(script)
    }

    // Wait for script to load
    const checkRecaptcha = setInterval(() => {
      if (window.grecaptcha && window.grecaptcha.render && containerRef.current) {
        clearInterval(checkRecaptcha)

        // Render reCAPTCHA
        try {
          widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
            sitekey: siteKey,
            theme: theme,
            size: size,
            callback: (token: string) => {
              onChange(token)
            },
            'expired-callback': () => {
              onChange(null)
            },
            'error-callback': () => {
              onError?.()
              onChange(null)
            },
          })
        } catch (error) {
          console.error('ReCAPTCHA render error:', error)
        }
      }
    }, 100)

    // Cleanup
    return () => {
      clearInterval(checkRecaptcha)
      if (widgetIdRef.current !== null && window.grecaptcha) {
        try {
          window.grecaptcha.reset(widgetIdRef.current)
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  }, [siteKey, theme, size, onChange, onError])

  return <div ref={containerRef} />
}

/**
 * Simple wrapper component with better error handling
 */
export function SimpleCaptcha({ onVerify }: { onVerify: (token: string | null) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

  if (!siteKey) {
    console.warn('RECAPTCHA_SITE_KEY not configured')
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
        ⚠️ CAPTCHA not configured. Set NEXT_PUBLIC_RECAPTCHA_SITE_KEY in .env file.
      </div>
    )
  }

  return (
    <ReCAPTCHA
      siteKey={siteKey}
      onChange={onVerify}
      onError={() => {
        console.error('CAPTCHA error occurred')
        onVerify(null)
      }}
    />
  )
}
