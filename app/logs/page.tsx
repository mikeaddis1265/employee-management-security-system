"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import ProtectedRoute from "@/components/protected-route"
import toast from "react-hot-toast"

interface AuditLog {
  id: number
  timestamp: Date | string
  username: string
  action: string
  details: any
  status: "success" | "denied" | "failed"
  ipAddress: string
  resource: string
  isAnomaly: boolean
}

const statusColors: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  denied: "bg-red-100 text-red-800",
  failed: "bg-yellow-100 text-yellow-800",
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<"timestamp" | "username">("timestamp")

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch("/api/logs")
        const data = await res.json()

        if (data.success) {
          // Transform API logs to match our interface
          const transformedLogs: AuditLog[] = data.logs.map((log: any) => {
            const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details
            const action = log.action || 'unknown'
            
            // Determine status based on action
            let status: "success" | "denied" | "failed" = "success"
            if (action.includes('denied') || action.includes('failed')) {
              status = action.includes('denied') ? "denied" : "failed"
            }

            // Determine if anomaly (failed logins, access denials, etc.)
            const isAnomaly = action.includes('failed') || action.includes('denied') || action.includes('locked')

            return {
              id: log.id,
              timestamp: new Date(log.timestamp),
              username: log.username || 'SYSTEM',
              action: action,
              details: typeof details === 'object' ? JSON.stringify(details) : String(details),
              status,
              ipAddress: log.ip || 'unknown',
              resource: details?.resourceId ? `Resource ${details.resourceId}` : 'System',
              isAnomaly,
            }
          })

          setLogs(transformedLogs)
        } else {
          toast.error("Failed to load logs")
        }
      } catch (error) {
        console.error("Error fetching logs:", error)
        toast.error("Failed to load logs")
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [])

  const filtered = logs.filter((log) => {
    const actionMatch = filterAction === "all" || log.action.includes(filterAction.toLowerCase())
    const statusMatch = filterStatus === "all" || log.status === filterStatus
    const searchMatch =
      log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchTerm.toLowerCase())

    return actionMatch && statusMatch && searchMatch
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "timestamp") {
      const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime()
      const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime()
      return bTime - aTime
    }
    return a[sortBy].localeCompare(b[sortBy])
  })

  const anomalies = sorted.filter((log) => log.isAnomaly)

  if (loading) {
    return (
      <ProtectedRoute requiredRole="admin">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Activity Logs</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const handleExport = () => {
    const csv = [
      ["Timestamp", "User", "Action", "Details", "Status", "IP Address", "Resource"],
      ...sorted.map((log) => [
        format(log.timestamp, "yyyy-MM-dd HH:mm:ss"),
        log.username,
        log.action,
        log.details,
        log.status,
        log.ipAddress,
        log.resource,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
    toast.success("Logs exported successfully")
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Activity Logs</h1>
          <p className="text-muted-foreground">Complete audit trail with anomaly detection</p>
        </div>

        {/* Anomalies Alert */}
        {anomalies.length > 0 && (
          <div className="p-4 border-l-4 border-destructive bg-destructive/5 rounded">
            <p className="font-semibold text-destructive">Security Alert: {anomalies.length} Anomalies Detected</p>
            <p className="text-sm text-destructive/80">
              Unauthorized access attempts and suspicious activities have been recorded.
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by username, resource, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <button
            onClick={handleExport}
            className="px-4 py-2 border border-input rounded-lg hover:bg-secondary transition-colors font-medium"
          >
            Export
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Action</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Actions</option>
              <option value="accessed_resource">Resource Access</option>
              <option value="modified_permission">Permission Change</option>
              <option value="denied_access">Denied Access</option>
              <option value="failed_login">Failed Login</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="denied">Denied</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="timestamp">Date (Newest First)</option>
              <option value="username">Username</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full">
            <thead className="bg-secondary/30 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold"></th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Timestamp</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">User</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Action</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Resource</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Details</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length > 0 ? (
                sorted.map((log) => (
                  <tr
                    key={log.id}
                    className={`border-b border-border hover:bg-secondary/20 transition-colors ${log.isAnomaly ? "bg-destructive/5" : ""}`}
                  >
                    <td className="px-6 py-4">
                      {log.isAnomaly && (
                        <span className="text-xs font-bold text-destructive uppercase">Alert</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      {format(
                        log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp),
                        "MMM dd, HH:mm"
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">{log.username}</td>
                    <td className="px-6 py-4 text-sm capitalize">{log.action.replace(/_/g, " ")}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{log.resource}</td>
                    <td className="px-6 py-4 text-sm max-w-xs truncate text-muted-foreground">{log.details}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[log.status]}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{log.ipAddress}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                    No logs found matching your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="p-4 bg-secondary/20 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Showing {sorted.length} of {logs.length} total log entries • {anomalies.length} anomalies detected
          </p>
        </div>
      </div>
    </ProtectedRoute>
  )
}
