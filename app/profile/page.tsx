"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import toast from "react-hot-toast"
import ProtectedRoute from "@/components/protected-route"
import { QRCodeSVG } from "qrcode.react"

const profileSchema = z
  .object({
    email: z.string().email("Invalid email"),
    department: z.string().min(2, "Department required"),
    level: z.enum(["junior", "mid", "senior", "lead"]),
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.newPassword && !data.currentPassword) return false
      if (data.newPassword && data.newPassword !== data.confirmPassword) return false
      return true
    },
    { message: "Passwords must match", path: ["confirmPassword"] },
  )

type ProfileFormData = z.infer<typeof profileSchema>

export default function ProfilePage() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<any>(null)
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [showMFAQR, setShowMFAQR] = useState(false)
  const [mfaData, setMfaData] = useState<{ secret: string; otpauthUrl: string } | null>(null)
  const [mfaToken, setMfaToken] = useState("")
  const [enablingMFA, setEnablingMFA] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  })

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile/update")
        const data = await res.json()

        if (data.success && data.user) {
          setUserData(data.user)
          setMfaEnabled(data.user.mfaEnabled || false)
          reset({
            email: data.user.email,
            department: data.user.department,
            level: "mid", // This field doesn't exist in the backend
          })
        }

        // Fetch MFA status
        const mfaRes = await fetch("/api/profile/mfa")
        const mfaData = await mfaRes.json()
        if (mfaData.success) {
          setMfaEnabled(mfaData.mfaEnabled)
          if (mfaData.mfa && !mfaData.mfaEnabled) {
            setMfaData(mfaData.mfa)
          }
        }
      } catch (error) {
        console.error("Error fetching profile:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [reset])

  const handleCopyApiKey = async () => {
    const apiKey = "sk_live_51a2b3c4d5e6f7g8h9i0j"
    await navigator.clipboard.writeText(apiKey)
    setCopied(true)
    toast.success("API key copied!")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleEnableMFA = async () => {
    try {
      // Fetch MFA secret if not already available
      if (!mfaData) {
        const res = await fetch("/api/profile/mfa")
        const data = await res.json()
        if (data.success && data.mfa) {
          setMfaData(data.mfa)
          setShowMFAQR(true)
        }
      } else {
        setShowMFAQR(true)
      }
    } catch (error) {
      toast.error("Failed to load MFA setup")
    }
  }

  const handleVerifyMFA = async () => {
    if (!mfaToken || mfaToken.length !== 6) {
      toast.error("Please enter a 6-digit code")
      return
    }

    setEnablingMFA(true)
    try {
      const res = await fetch("/api/profile/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: mfaToken }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success("MFA enabled successfully!")
        setMfaEnabled(true)
        setShowMFAQR(false)
        setMfaToken("")
        setMfaData(null)
      } else {
        toast.error(data.error || "Failed to enable MFA")
      }
    } catch (error) {
      toast.error("Failed to enable MFA")
    } finally {
      setEnablingMFA(false)
    }
  }

  const handleDisableMFA = async () => {
    if (!confirm("Are you sure you want to disable MFA? This will reduce your account security.")) {
      return
    }

    try {
      const res = await fetch("/api/profile/mfa", {
        method: "DELETE",
      })

      const data = await res.json()

      if (data.success) {
        toast.success("MFA disabled successfully")
        setMfaEnabled(false)
      } else {
        toast.error(data.error || "Failed to disable MFA")
      }
    } catch (error) {
      toast.error("Failed to disable MFA")
    }
  }

  const onSubmit = async (data: ProfileFormData) => {
    const hasProfileChanges =
      !!userData &&
      (data.email !== userData.email || data.department !== userData.department)
    const wantsPasswordChange = !!data.newPassword || !!data.confirmPassword

    if (hasProfileChanges && !data.currentPassword) {
      toast.error("Enter your current password to update profile information.")
      return
    }

    if (wantsPasswordChange) {
      if (!data.currentPassword) {
        toast.error("Enter your current password to change it.")
        return
      }
      if (!data.newPassword || !data.confirmPassword) {
        toast.error("Provide and confirm your new password.")
        return
      }
      if (data.newPassword !== data.confirmPassword) {
        toast.error("New passwords do not match.")
        return
      }
    }

    if (!hasProfileChanges && !wantsPasswordChange) {
      toast.error("Nothing to update.")
      return
    }

    let toastId: string | undefined

    try {
      toastId = toast.loading("Applying changes...")

      // Apply profile updates if needed
      if (hasProfileChanges) {
        const res = await fetch("/api/profile/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.email,
            department: data.department,
            currentPassword: data.currentPassword,
          }),
        })

        const result = await res.json()
        if (!result.success) {
          throw new Error(result.error || "Failed to update profile")
        }

        setUserData((prev: any) => ({
          ...prev,
          email: data.email,
          department: data.department,
        }))
      }

      // Apply password change if requested
      if (wantsPasswordChange) {
        const passwordRes = await fetch("/api/profile/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: data.currentPassword,
            newPassword: data.newPassword,
            confirmPassword: data.confirmPassword,
          }),
        })

        const passwordResult = await passwordRes.json()
        if (!passwordResult.success) {
          throw new Error(passwordResult.error || "Failed to change password")
        }
      }

      toast.dismiss(toastId)
      toast.success(
        wantsPasswordChange && hasProfileChanges
          ? "Profile and password updated!"
          : wantsPasswordChange
          ? "Password changed successfully!"
          : "Profile updated successfully!"
      )

      reset({
        email: data.email,
        department: data.department,
        level: data.level,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } catch (error: any) {
      if (toastId) toast.dismiss(toastId)
      toast.error(error?.message || "Failed to update profile")
    }
  }

  return (
    <ProtectedRoute requiredRole="user">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Profile Settings</h1>
            <p className="text-muted-foreground">Manage your account, security, and preferences</p>
          </div>

          {/* Profile Card */}
          <div className="p-6 border border-border rounded-lg bg-card space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xl">JD</span>
              </div>
              <div>
                <h2 className="font-bold text-lg">{userData?.username || "User"}</h2>
                <p className="text-sm text-muted-foreground">{userData?.email || "Loading..."}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {userData?.createdAt ? `Member since ${new Date(userData.createdAt).toLocaleDateString()}` : "Loading..."}
                </p>
              </div>
            </div>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Account Information */}
            <div className="space-y-4 p-6 border border-border rounded-lg bg-card">
              <h3 className="font-bold text-lg">Account Information</h3>

              <div>
                <label className="block text-sm font-medium mb-2">Email Address</label>
                <input
                  {...register("email")}
                  type="email"
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Department</label>
                <input
                  {...register("department")}
                  type="text"
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {errors.department && <p className="text-xs text-destructive mt-1">{errors.department.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Experience Level</label>
                <select
                  {...register("level")}
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="junior">Junior</option>
                  <option value="mid">Mid</option>
                  <option value="senior">Senior</option>
                  <option value="lead">Lead</option>
                </select>
              </div>
            </div>

            {/* Change Password Section */}
            <div className="space-y-4 p-6 border border-border rounded-lg bg-card">
              <h3 className="font-bold text-lg">Security Settings</h3>

              <div>
                <label className="block text-sm font-medium mb-2">Current Password</label>
                <div className="relative">
                  <input
                    {...register("currentPassword")}
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground"
                    aria-label="Toggle password visibility"
                  >
                    {showCurrentPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">New Password</label>
                <div className="relative">
                  <input
                    {...register("newPassword")}
                    type={showNewPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground"
                    aria-label="Toggle password visibility"
                  >
                    {showNewPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                <div className="relative">
                  <input
                    {...register("confirmPassword")}
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground"
                    aria-label="Toggle password visibility"
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive mt-1">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>

            {/* MFA Section */}
            <div className="space-y-4 p-6 border border-border rounded-lg bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">Two-Factor Authentication</h3>
                  <p className="text-sm text-muted-foreground">
                    {mfaEnabled
                      ? "MFA is enabled. Your account is protected with two-factor authentication."
                      : "Add an extra layer of security to your account"}
                  </p>
                </div>
                {mfaEnabled ? (
                  <button
                    type="button"
                    onClick={handleDisableMFA}
                    className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
                  >
                    Disable MFA
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnableMFA}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Enable MFA
                  </button>
                )}
              </div>

              {/* MFA QR Code Modal */}
              {showMFAQR && mfaData && (
                <div className="mt-4 p-4 border border-primary/30 rounded-lg bg-primary/5 space-y-4">
                  <div className="text-center">
                    <p className="text-sm font-medium mb-3">Scan this QR code with your authenticator app</p>
                    <div className="p-4 bg-background rounded-lg inline-block">
                      <QRCodeSVG value={mfaData.otpauthUrl} size={200} level="M" includeMargin />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Or enter this code manually:</p>
                    <p className="font-mono text-center bg-secondary/20 p-3 rounded-lg break-all text-sm">
                      {mfaData.secret}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Enter 6-digit code to verify:</label>
                    <input
                      type="text"
                      value={mfaToken}
                      onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary text-center tracking-widest text-lg font-bold"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleVerifyMFA}
                      disabled={mfaToken.length !== 6 || enablingMFA}
                      className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {enablingMFA ? "Verifying..." : "Verify & Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMFAQR(false)
                        setMfaToken("")
                      }}
                      className="px-4 py-2 border border-input rounded-lg hover:bg-secondary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <span className="font-semibold">Important:</span> Save your MFA secret key in a safe place.
                      You'll need it to recover your account if you lose access to your authenticator.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* API Key Section */}
            <div className="space-y-4 p-6 border border-border rounded-lg bg-card">
              <h3 className="font-bold text-lg">API Access</h3>
              <p className="text-sm text-muted-foreground">Use this key to access the EMS API programmatically</p>

              <div>
                <label className="block text-sm font-medium mb-2">Your API Key</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value="sk_live_51a2b3c4d5e6f7g8h9i0j"
                    readOnly
                    className="flex-1 px-4 py-2 border border-input rounded-lg bg-background focus:outline-none font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleCopyApiKey}
                    className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors font-medium text-sm"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving changes..." : "Save Changes"}
            </button>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  )
}
