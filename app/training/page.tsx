"use client"

import ProtectedRoute from "@/components/protected-route"
import Link from "next/link"

export default function TrainingPage() {
  return (
    <ProtectedRoute requiredRole="hr">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <h1 className="text-3xl font-bold text-destructive">Access Denied</h1>
          <p className="text-muted-foreground max-w-md">Training management is restricted to HR personnel.</p>
          <Link href="/dashboard" className="text-primary hover:underline font-medium">
            Return to Dashboard
          </Link>
        </div>
      </div>
    </ProtectedRoute>
  )
}
