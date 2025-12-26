"use client"
import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import ProtectedRoute from "@/components/protected-route"
import Link from "next/link"
import toast from "react-hot-toast"

interface EmployeeDetail {
  id: string
  username: string
  email: string
  department: string
  role: string
  securityLevel: string
  joinDate: string
  emailVerified: boolean
  mfaEnabled: boolean
  canRead: boolean
  canWrite: boolean
}

const levelColors: Record<string, string> = {
  public: "bg-green-100 text-green-800 border-green-300",
  internal: "bg-blue-100 text-blue-800 border-blue-300",
  confidential: "bg-red-100 text-red-800 border-red-300",
}

export default function EmployeeDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchEmployee() {
      try {
        const res = await fetch(`/api/employees/${id}`)
        const data = await res.json()

        if (data.success) {
          setEmployee(data.employee)
        } else {
          toast.error(data.error || "Failed to load employee")
        }
      } catch (error) {
        console.error("Error fetching employee:", error)
        toast.error("Failed to load employee")
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchEmployee()
    }
  }, [id])

  if (loading) {
    return (
      <ProtectedRoute requiredRole="user">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
            <p className="text-muted-foreground">Loading employee details...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!employee) {
    return (
      <ProtectedRoute requiredRole="user">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
            <h1 className="text-3xl font-bold text-destructive">404 - Employee Not Found</h1>
            <p className="text-muted-foreground">Employee record not found or you don't have access.</p>
            <Link href="/employees" className="text-primary hover:underline font-medium">
              Back to Employees
            </Link>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!employee.canRead) {
    return (
      <ProtectedRoute requiredRole="user">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
            <h1 className="text-3xl font-bold text-destructive">Access Denied</h1>
            <p className="text-muted-foreground">You don't have permission to view this employee record.</p>
            <Link href="/employees" className="text-primary hover:underline font-medium">
              Back to Employees
            </Link>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredRole="user">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <Link href="/employees" className="text-primary hover:underline text-sm font-medium">
          Back to Employees
        </Link>

        {/* Employee Card */}
        <div className="p-6 border border-border rounded-lg bg-card space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <div className="w-20 h-20 rounded-full border-2 border-primary bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-white font-bold text-2xl">
                  {employee.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold">{employee.username}</h1>
                <p className="text-lg text-primary font-medium capitalize">{employee.role.toLowerCase()}</p>
                <div className="flex gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${levelColors[employee.securityLevel.toLowerCase()] || levelColors.public}`}
                  >
                    {employee.securityLevel.toLowerCase()}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
                    {employee.securityLevel} Level
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <span className="text-green-800 text-sm">Read Access</span>
              </div>
              {employee.canWrite && (
                <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-green-800 text-sm">Write Access</span>
                </div>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-border">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{employee.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Department</p>
              <p className="font-medium">{employee.department}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Join Date</p>
              <p className="font-medium">{new Date(employee.joinDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <p className="font-medium capitalize">{employee.role.toLowerCase()}</p>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-6 border border-border rounded-lg bg-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Account Status</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email Verified</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${employee.emailVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {employee.emailVerified ? 'Verified' : 'Not Verified'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">MFA Enabled</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${employee.mfaEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {employee.mfaEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 border border-border rounded-lg bg-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Access Permissions</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Read Access</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${employee.canRead ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {employee.canRead ? 'Allowed' : 'Denied'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Write Access</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${employee.canWrite ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {employee.canWrite ? 'Allowed' : 'Denied'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
