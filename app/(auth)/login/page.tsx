"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import toast from "react-hot-toast"

const loginSchema = z.object({
  username: z.string().min(3, "Username required"),
  password: z.string().min(6, "Password required"),
  otp: z.string().optional(),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showMFA, setShowMFA] = useState(false)
  const [lockoutWarning, setLockoutWarning] = useState(false)
  const [attemptCount, setAttemptCount] = useState(0)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loginNotice, setLoginNotice] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      toast.loading(showMFA ? "Verifying OTP..." : "Logging in...")

      // Store credentials on first submission for MFA resubmission
      if (!showMFA) {
        setUsername(data.username)
        setPassword(data.password)
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: showMFA ? username : data.username,
          password: showMFA ? password : data.password,
          mfaToken: data.otp || undefined,
        }),
      })

      const result = await response.json()
      toast.dismiss()
      setLoginNotice(null)

      // Check if MFA is required (this can be returned with status 200)
      if (result.mfaRequired && !showMFA) {
        setShowMFA(true)
        toast.success("MFA enabled - Enter your OTP code")
        setValue("otp", "")
        return
      }

      if (!response.ok) {
        if (response.status === 403 && result.message) {
          setLoginNotice(result.message)
          toast.error(result.message, { duration: 5000 })
          return
        }

        if (result.error === "Account is locked" || result.error === "Account locked") {
          toast.error(result.message || "Account locked due to too many failed attempts")
          setLockoutWarning(true)
          return
        }

        if (result.error === "Email not verified") {
          toast.error(result.message || "Please verify your email before logging in", {
            duration: 5000,
          })
          return
        }

        if (result.error === "Invalid MFA token" && showMFA) {
          toast.error("Invalid OTP code. Please try again.")
          setValue("otp", "")
          return
        }

        const newCount = attemptCount + 1
        setAttemptCount(newCount)
        if (newCount >= 2) {
          setLockoutWarning(true)
        }

        toast.error(result.error || "Login failed. Check credentials.")
        // Reset MFA if error
        if (showMFA) {
          setShowMFA(false)
        }
        return
      }

      // Login successful - redirect based on role
      toast.success("Login successful! Redirecting...")
      const userRole = result.user?.role?.toLowerCase() || "employee"
      
      // Redirect based on role - handle both enum case (ADMIN, MANAGER, HR, EMPLOYEE) and lowercase
      let redirectPath = "/dashboard"
      const normalizedRole = userRole.toLowerCase()
      
      if (normalizedRole === "admin") {
        redirectPath = "/admin"
      } else if (normalizedRole === "manager") {
        redirectPath = "/dashboard/manager"
      } else if (normalizedRole === "hr") {
        redirectPath = "/dashboard/hr"
      } else {
        // Employee or other roles go to default dashboard
        redirectPath = "/dashboard"
      }
      
      setTimeout(() => (window.location.href = redirectPath), 1500)
    } catch (error) {
      toast.dismiss()
      setLoginNotice(null)
      toast.error("Login failed. Please try again.")
      const newCount = attemptCount + 1
      setAttemptCount(newCount)
      if (newCount >= 2) {
        setLockoutWarning(true)
      }
      if (showMFA) {
        setShowMFA(false)
      }
    }
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Welcome Back</h1>
        <p className="text-muted-foreground">Sign in to your BSC account</p>
      </div>

      {loginNotice && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-900">
          <p className="font-semibold">Login Restricted</p>
          <p>{loginNotice}</p>
        </div>
      )}

      {lockoutWarning && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg animate-pulse">
          <div className="text-sm text-destructive">
            <strong>Security Warning:</strong> Multiple failed attempts detected. Your account will lock after{" "}
            {3 - attemptCount} more attempt{3 - attemptCount !== 1 ? "s" : ""}.
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Username */}
        <div>
          <label className="block text-sm font-medium mb-2">Username or Email</label>
          <input
            {...register("username")}
            type="text"
            placeholder="username"
            className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            autoComplete="username"
          />
          {errors.username && <p className="text-xs text-destructive mt-1">{errors.username.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium mb-2">Password</label>
          <div className="relative">
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary pr-10 transition-colors"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle password visibility"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
        </div>

        {/* MFA/OTP Field */}
        {showMFA && (
          <div className="space-y-4 p-4 bg-primary/5 rounded-lg border border-primary/30 animate-in fade-in">
            <label className="block text-sm font-medium">Two-Factor Authentication Code</label>
            <input
              {...register("otp", {
                required: showMFA ? "OTP code is required" : false,
                pattern: {
                  value: /^\d{6}$/,
                  message: "OTP must be 6 digits",
                },
              })}
              type="text"
              placeholder="000000"
              maxLength={6}
              inputMode="numeric"
              className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary text-center tracking-widest text-lg font-bold"
              autoComplete="one-time-code"
            />
            {errors.otp && (
              <p className="text-xs text-destructive mt-1">{errors.otp.message}</p>
            )}
            <p className="text-xs text-muted-foreground">Enter the 6-digit code from your authenticator app</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (showMFA ? "Verifying..." : "Signing in...") : showMFA ? "Verify Code" : "Sign In"}
        </button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <Link href="#" className="text-primary hover:underline hover:text-primary/80 transition-colors">
          Forgot password?
        </Link>
        <Link href="#" className="text-primary hover:underline hover:text-primary/80 transition-colors">
          Need help?
        </Link>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link
          href="/register"
          className="text-primary hover:underline font-medium hover:text-primary/80 transition-colors"
        >
          Register
        </Link>
      </p>
    </div>
  )
}
