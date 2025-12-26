"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-6">
      <h1 className="text-3xl font-bold text-destructive">Something went wrong!</h1>
      <p className="text-muted-foreground max-w-md mx-auto">
        An error occurred while processing your request. Try again or contact support.
      </p>
      <button
        onClick={() => reset()}
        className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
      >
        Try Again
      </button>
    </div>
  )
}
