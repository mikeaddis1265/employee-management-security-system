"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import ResourceTable from "@/components/resource-table"
import StatCard from "@/components/stat-card"
import ProtectedRoute from "@/components/protected-route"
import { getAuthStatus } from "@/lib/auth-client"
import toast from "react-hot-toast"

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

function DashboardContent() {
  const router = useRouter()
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [userInfo, setUserInfo] = useState<any>(null)
  const [stats, setStats] = useState({
    totalResources: 0,
    accessDenials: 0,
  })
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newLevel, setNewLevel] = useState<"PUBLIC" | "INTERNAL" | "CONFIDENTIAL">("PUBLIC")
  const [newContent, setNewContent] = useState("{\n  \"example\": \"value\"\n}")
  const [creating, setCreating] = useState(false)

  const [uploadName, setUploadName] = useState("")
  const [uploadDescription, setUploadDescription] = useState("")
  const [uploadLevel, setUploadLevel] = useState<"PUBLIC" | "INTERNAL" | "CONFIDENTIAL">("PUBLIC")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch user info
        const authStatus = await getAuthStatus()
        if (authStatus.authenticated && authStatus.user) {
          setUserInfo(authStatus.user)
          
          // Redirect to role-specific dashboard
          const role = authStatus.user.role.toLowerCase()
          const normalizedRole = role.toLowerCase()
          
          if (normalizedRole === "admin") {
            router.replace("/admin")
            return
          } else if (normalizedRole === "manager") {
            router.replace("/dashboard/manager")
            return
          } else if (normalizedRole === "hr") {
            router.replace("/dashboard/hr")
            return
          }
          // Employee stays on default dashboard
        }

        // Fetch resources
        const res = await fetch("/api/resources")
        const data = await res.json()

        if (data.success) {
          setResources(data.resources || [])
          setStats({
            totalResources: data.count || 0,
            accessDenials: 0, // Could fetch from logs API
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

  const handleCreateResource = async () => {
    if (!newName.trim()) {
      toast.error("Resource name is required")
      return
    }

    let parsedContent: any = {}
    try {
      parsedContent = newContent ? JSON.parse(newContent) : {}
    } catch {
      toast.error("Content must be valid JSON")
      return
    }

    setCreating(true)
    try {
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          sensitivityLevel: newLevel,
          content: parsedContent,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to create resource")
      } else {
        toast.success("Resource created")
        // Refresh list
        setResources((prev) => [...prev, data.resource])
        setStats((s) => ({ ...s, totalResources: s.totalResources + 1 }))
        setNewName("")
        setNewDescription("")
        setNewContent("{\n  \"example\": \"value\"\n}")
        setNewLevel("PUBLIC")
      }
    } catch (error) {
      toast.error("Failed to create resource")
    } finally {
      setCreating(false)
    }
  }

  const handleUploadResource = async () => {
    if (!uploadName.trim()) {
      toast.error("Resource name is required")
      return
    }
    if (!uploadFile) {
      toast.error("Please select a file to upload")
      return
    }

    const formData = new FormData()
    formData.append("name", uploadName.trim())
    formData.append("description", uploadDescription.trim())
    formData.append("sensitivityLevel", uploadLevel)
    formData.append("file", uploadFile)

    setUploading(true)
    try {
      const res = await fetch("/api/resources/upload", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to upload resource")
      } else {
        toast.success("Resource uploaded successfully")
        setResources((prev) => [...prev, data.resource])
        setStats((s) => ({ ...s, totalResources: s.totalResources + 1 }))
        setUploadName("")
        setUploadDescription("")
        setUploadLevel("PUBLIC")
        setUploadFile(null)
      }
    } catch (error) {
      toast.error("Failed to upload resource")
    } finally {
      setUploading(false)
    }
  }

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
          <h1 className="text-4xl font-bold text-balance">Welcome to Your Dashboard</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-balance">Welcome to Your Dashboard</h1>
        <p className="text-muted-foreground">Here's your system overview and available resources</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Users" value="-" trend="" trendUp={true} />
        <StatCard label="Protected Resources" value={String(stats.totalResources)} trend="" trendUp={true} />
        <StatCard label="Access Denials" value={String(stats.accessDenials)} trend="" trendUp={false} />
        <StatCard label="Security Score" value="-" trend="" trendUp={true} />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 border border-border rounded-lg bg-card space-y-3">
          <h3 className="font-semibold">Your Access Level</h3>
          <p className="text-2xl font-bold text-primary capitalize">{userInfo?.role || "Employee"}</p>
          <p className="text-sm text-muted-foreground">You have access to {stats.totalResources} resources</p>
        </div>
        <div className="p-6 border border-border rounded-lg bg-card space-y-3">
          <h3 className="font-semibold">Department</h3>
          <p className="text-2xl font-bold">{userInfo?.department || "N/A"}</p>
          <p className="text-sm text-muted-foreground">Username: {userInfo?.username || "N/A"}</p>
        </div>
      </div>

      {/* Resource Actions + Listing */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        <div className="space-y-6 xl:col-span-2">
          {/* Create JSON Resource */}
          <div className="p-6 border border-border rounded-lg bg-card space-y-4">
            <h2 className="text-xl font-bold">Create Resource (JSON)</h2>
            <p className="text-sm text-muted-foreground">
              Quickly create logical resources with structured JSON content to demonstrate MAC, DAC, RBAC, RuBAC and
              ABAC scenarios.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Security Level (MAC)</label>
                <select
                  value={newLevel}
                  onChange={(e) => setNewLevel(e.target.value as "PUBLIC" | "INTERNAL" | "CONFIDENTIAL")}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="INTERNAL">INTERNAL</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Content (JSON)</label>
                <textarea
                  rows={6}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateResource}
                disabled={creating}
                className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Resource"}
              </button>
            </div>
          </div>

          {/* Upload File Resource */}
          <div className="p-6 border border-border rounded-lg bg-card space-y-4">
            <h2 className="text-xl font-bold">Upload Resource File</h2>
            <p className="text-sm text-muted-foreground">
              Upload actual documents (PDF, DOCX, images, etc.). The uploaded file path is stored in the resource
              content so you can demo file-based access control.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Security Level (MAC)</label>
                <select
                  value={uploadLevel}
                  onChange={(e) => setUploadLevel(e.target.value as "PUBLIC" | "INTERNAL" | "CONFIDENTIAL")}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="INTERNAL">INTERNAL</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Select File</label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleUploadResource}
                disabled={uploading}
                className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload Resource"}
              </button>
            </div>
          </div>
        </div>

        {/* Resource List */}
        <div className="xl:col-span-2 space-y-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">Your Resources</h2>
            <p className="text-muted-foreground">
              Resources currently accessible to your user after MAC, DAC, RBAC, RuBAC and ABAC checks.
            </p>
          </div>
          <Suspense fallback={<div className="p-4 text-center text-muted-foreground">Loading resources...</div>}>
            <ResourceTable data={formattedResources} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <ProtectedRoute requiredRole="user">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardContent />
      </div>
    </ProtectedRoute>
  )
}
