"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import ProtectedRoute from "@/components/protected-route"
import toast from "react-hot-toast"

interface Employee {
  id: string
  username: string
  email: string
  department: string
  role: string
  securityLevel: string
  createdAt: string
  emailVerified: boolean
  mfaEnabled: boolean
}

const levelColors: Record<string, string> = {
  public: "bg-green-100 text-green-800 border-green-300",
  internal: "bg-blue-100 text-blue-800 border-blue-300",
  confidential: "bg-red-100 text-red-800 border-red-300",
}

export default function EmployeesPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedLevel, setSelectedLevel] = useState<"all" | "PUBLIC" | "INTERNAL" | "CONFIDENTIAL">("all")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchEmployees() {
      try {
        const params = new URLSearchParams()
        if (searchTerm) params.append('search', searchTerm)
        if (selectedLevel !== 'all') params.append('role', selectedLevel)

        const res = await fetch(`/api/employees?${params.toString()}`)
        const data = await res.json()

        if (data.success) {
          setEmployees(data.employees || [])
        } else {
          toast.error("Failed to load employees")
        }
      } catch (error) {
        console.error("Error fetching employees:", error)
        toast.error("Failed to load employees")
      } finally {
        setLoading(false)
      }
    }

    fetchEmployees()
  }, [searchTerm, selectedLevel])

  const filtered = employees.filter((emp) => {
    const level = selectedLevel === "all" || emp.securityLevel === selectedLevel
    return level
  })

  const handleGrantAccess = (employeeId: string) => {
    toast.success(`Access request sent for employee ${employeeId}`)
  }

  if (loading) {
    return (
      <ProtectedRoute requiredRole="user">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Employees Directory</h1>
            <p className="text-muted-foreground">Loading employees...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredRole="user">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Employees Directory</h1>
          <p className="text-muted-foreground">Manage and view employee information with role-based access control</p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-end justify-between">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Search Employees</label>
            <input
              type="text"
              placeholder="Search by name, email, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Data Classification</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value as typeof selectedLevel)}
              className="px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Levels</option>
              <option value="PUBLIC">Public</option>
              <option value="INTERNAL">Internal</option>
              <option value="CONFIDENTIAL">Confidential</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-secondary"
              }`}
              aria-label="Grid view"
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-secondary"
              }`}
              aria-label="List view"
            >
              List
            </button>
          </div>
        </div>

        {/* Grid View */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((emp) => {
              const level = emp.securityLevel.toLowerCase()
              return (
                <div
                  key={emp.id}
                  className="p-6 border border-border rounded-lg bg-card hover:shadow-lg transition-shadow space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-full border-2 border-primary bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <span className="text-white font-bold text-lg">
                        {emp.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${levelColors[level] || levelColors.public}`}>
                      {level}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold">{emp.username}</h3>
                    <p className="text-sm text-muted-foreground capitalize">{emp.role.toLowerCase()}</p>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p className="text-muted-foreground">{emp.department}</p>
                    <p className="text-muted-foreground">{emp.email}</p>
                  </div>

                <div className="pt-4 flex gap-2 border-t border-border">
                  <Link
                    href={`/employees/${emp.id}`}
                    className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors text-center text-sm"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => handleGrantAccess(emp.id)}
                    className="flex-1 px-3 py-2 border border-input rounded-lg font-medium hover:bg-secondary transition-colors text-sm"
                  >
                    Grant
                  </button>
                </div>
                </div>
              )
            })}
          </div>
        )}

        {/* List View */}
        {viewMode === "list" && (
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full">
              <thead className="bg-secondary/30 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Department</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Role</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Classification</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr key={emp.id} className="border-b border-border hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full border border-primary bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                          <span className="text-white font-bold text-xs">
                            {emp.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium">{emp.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{emp.email}</td>
                    <td className="px-6 py-4 text-sm">{emp.department}</td>
                    <td className="px-6 py-4 text-sm font-medium capitalize">{emp.role.toLowerCase()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${levelColors[emp.securityLevel.toLowerCase()] || levelColors.public}`}>
                        {emp.securityLevel.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                        <span className="w-2 h-2 bg-green-600 rounded-full" />
                        active
                      </span>
                    </td>
                    <td className="px-6 py-4 flex gap-2">
                      <Link
                        href={`/employees/${emp.id}`}
                        className="text-primary hover:underline text-sm font-medium"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleGrantAccess(emp.id)}
                        className="text-primary hover:underline text-sm font-medium"
                      >
                        Grant
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No employees found matching your search</p>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
