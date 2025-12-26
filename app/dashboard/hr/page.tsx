"use client"

import { Suspense, useEffect, useState } from "react"
import ResourceTable from "@/components/resource-table"
import StatCard from "@/components/stat-card"
import ProtectedRoute from "@/components/protected-route"
import { getAuthStatus } from "@/lib/auth-client"
import toast from "react-hot-toast"
import Link from "next/link"

interface Resource {
  id: number
  name: string
  description?: string
  sensitivityLevel: string
  owner: string
  ownerRole: string
  content?: any
  createdAt: string
  canRead: boolean
  canWrite: boolean
}

function HRDashboardContent() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [userInfo, setUserInfo] = useState<any>(null)
  const [stats, setStats] = useState({
    totalResources: 0,
    accessDenials: 0,
    totalEmployees: 0,
    pendingLeaveRequests: 0,
    activeTrainings: 0,
  })

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch user info
        const authStatus = await getAuthStatus()
        if (authStatus.authenticated && authStatus.user) {
          setUserInfo(authStatus.user)
        }

        // Fetch resources
        const res = await fetch("/api/resources")
        const data = await res.json()

        if (data.success) {
          setResources(data.resources || [])
          setStats({
            totalResources: data.count || 0,
            accessDenials: 0,
            totalEmployees: 150, // Mock data
            pendingLeaveRequests: 8, // Mock data
            activeTrainings: 3, // Mock data
          })
        } else {
          toast.error("Failed to load resources")
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error)
        toast.error("Failed to load dashboard")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const formattedResources = resources.map((r) => ({
    id: String(r.id),
    name: r.name,
    level: r.sensitivityLevel.toLowerCase(),
    owner: r.owner,
    status: "active",
  }))

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-balance">HR Dashboard</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-balance">HR Dashboard</h1>
        <p className="text-muted-foreground">Manage employees, attendance, leave, and training</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link
          href="/employees"
          className="p-4 border border-border rounded-lg bg-card hover:bg-primary/5 hover:border-primary transition-colors"
        >
          <h3 className="font-semibold">Employees</h3>
          <p className="text-sm text-muted-foreground">{stats.totalEmployees} total</p>
        </Link>
        <Link
          href="/attendance"
          className="p-4 border border-border rounded-lg bg-card hover:bg-primary/5 hover:border-primary transition-colors"
        >
          <h3 className="font-semibold">Attendance</h3>
          <p className="text-sm text-muted-foreground">Track daily attendance</p>
        </Link>
        <Link
          href="/leave"
          className="p-4 border border-border rounded-lg bg-card hover:bg-primary/5 hover:border-primary transition-colors"
        >
          <h3 className="font-semibold">Leave Requests</h3>
          <p className="text-sm text-muted-foreground">{stats.pendingLeaveRequests} pending</p>
        </Link>
        <Link
          href="/training"
          className="p-4 border border-border rounded-lg bg-card hover:bg-primary/5 hover:border-primary transition-colors"
        >
          <h3 className="font-semibold">Training</h3>
          <p className="text-sm text-muted-foreground">{stats.activeTrainings} active</p>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Employees" value={String(stats.totalEmployees)} trend="" trendUp={true} />
        <StatCard label="Protected Resources" value={String(stats.totalResources)} trend="" trendUp={true} />
        <StatCard label="Pending Requests" value={String(stats.pendingLeaveRequests)} trend="" trendUp={false} />
        <StatCard label="Security Score" value="98%" trend="" trendUp={true} />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 border border-border rounded-lg bg-card space-y-3">
          <h3 className="font-semibold">Your Access Level</h3>
          <p className="text-2xl font-bold text-primary capitalize">{userInfo?.role || "HR"}</p>
          <p className="text-sm text-muted-foreground">You have access to {stats.totalResources} resources</p>
        </div>
        <div className="p-6 border border-border rounded-lg bg-card space-y-3">
          <h3 className="font-semibold">Department</h3>
          <p className="text-2xl font-bold">{userInfo?.department || "N/A"}</p>
          <p className="text-sm text-muted-foreground">Username: {userInfo?.username || "N/A"}</p>
        </div>
      </div>

      {/* Resources Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">Your Resources</h2>
          <p className="text-muted-foreground">Resources available to your role with proper permissions</p>
        </div>
        <Suspense fallback={<div className="p-4 text-center text-muted-foreground">Loading resources...</div>}>
          <ResourceTable data={formattedResources} />
        </Suspense>
      </div>
    </div>
  )
}

export default function HRDashboardPage() {
  return (
    <ProtectedRoute requiredRole="manager">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <HRDashboardContent />
      </div>
    </ProtectedRoute>
  )
}

