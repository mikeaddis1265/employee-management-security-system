"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import ProtectedRoute from "@/components/protected-route";

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: "EMPLOYEE" | "MANAGER" | "HR" | "ADMIN";
  department: string;
  securityLevel: string;
  isLocked: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
}

interface AuditLogEntry {
  id: number;
  timestamp: string;
  username: string;
  action: string;
  details: any;
  ip?: string | null;
}

interface ResourceOption {
  id: number;
  name: string;
  owner: string;
  sensitivityLevel: string;
  createdAt?: string;
}

interface LogsResponse {
  logs: AuditLogEntry[];
  statistics?: {
    totalLogs: number;
    failedLogins: number;
    accessDenials: number;
    recentLogs: number;
  };
  count?: number;
}

const ROLE_OPTIONS: AdminUser["role"][] = [
  "EMPLOYEE",
  "MANAGER",
  "HR",
  "ADMIN",
];

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [logStats, setLogStats] = useState<LogsResponse["statistics"] | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState<string>("");
  const [newRole, setNewRole] = useState<AdminUser["role"]>("EMPLOYEE");
  const [assigning, setAssigning] = useState(false);

  const [selectedResource, setSelectedResource] = useState<string>("");
  const [selectedPermissionUser, setSelectedPermissionUser] =
    useState<string>("");
  const [permissionLevel, setPermissionLevel] = useState<"READ" | "WRITE">(
    "READ"
  );
  const [granting, setGranting] = useState(false);
  const [updatingSecurity, setUpdatingSecurity] = useState(false);

  const uniqueRoleCount = useMemo(
    () => new Set(users.map((u) => u.role)).size,
    [users]
  );

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [usersRes, logsRes, resourcesRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/logs?limit=5"),
        fetch("/api/resources?includeAll=true"),
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      } else {
        const error = await usersRes.json();
        toast.error(error.error || "Failed to load users");
      }

      if (logsRes.ok) {
        const data: LogsResponse & { success?: boolean } = await logsRes.json();
        setAuditLogs(data.logs || []);
        setLogStats(data.statistics || null);
      } else {
        const error = await logsRes.json();
        toast.error(error.error || "Failed to load logs");
      }

      if (resourcesRes.ok) {
        const data = await resourcesRes.json();
        setResources(
          (data.resources || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            owner: r.owner,
            sensitivityLevel: r.sensitivityLevel,
            createdAt: r.createdAt,
          }))
        );
      } else {
        const error = await resourcesRes.json();
        toast.error(error.error || "Failed to load resources");
      }
    } catch (error) {
      console.error("Admin dashboard error:", error);
      toast.error("Failed to load admin dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleSecurityLevelChange = async (
    userId: string,
    newLevel: AdminUser["securityLevel"]
  ) => {
    setUpdatingSecurity(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ securityLevel: newLevel }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to update security level");
        return;
      }

      toast.success("Security level updated");
      await fetchAdminData();
    } catch (error) {
      console.error("Update security level error:", error);
      toast.error("Failed to update security level");
    } finally {
      setUpdatingSecurity(false);
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUser) {
      toast.error("Please select a user");
      return;
    }

    setAssigning(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to update role");
        return;
      }

      toast.success("Role updated successfully");
      setSelectedUser("");
      await fetchAdminData();
    } catch (error) {
      console.error("Assign role error:", error);
      toast.error("Failed to update role");
    } finally {
      setAssigning(false);
    }
  };

  const handleGrantPermission = async () => {
    if (!selectedResource || !selectedPermissionUser) {
      toast.error("Please select resource and user");
      return;
    }

    const resourceId = parseInt(selectedResource, 10);
    if (Number.isNaN(resourceId)) {
      toast.error("Invalid resource selected");
      return;
    }

    setGranting(true);
    try {
      const res = await fetch(`/api/resources/${resourceId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selectedPermissionUser,
          permissionType: permissionLevel,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to grant permission");
        return;
      }

      toast.success("Permission granted");
      setSelectedResource("");
      setSelectedPermissionUser("");
      setPermissionLevel("READ");
    } catch (error) {
      console.error("Grant permission error:", error);
      toast.error("Failed to grant permission");
    } finally {
      setGranting(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRole="admin">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <p className="text-muted-foreground">
            Loading administration dashboard...
          </p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Administration Dashboard</h1>
          <p className="text-muted-foreground">
            Manage users, permissions, roles, and audit trail
          </p>
        </div>

        {/* Admin Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 border border-border rounded-lg bg-card space-y-2">
            <p className="text-sm text-muted-foreground">Total Users</p>
            <p className="text-3xl font-bold">
              {users.length.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Live from database
            </p>
          </div>
          <div className="p-6 border border-border rounded-lg bg-card space-y-2">
            <p className="text-sm text-muted-foreground">Active Roles</p>
            <p className="text-3xl font-bold">{uniqueRoleCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              EMPLOYEE / MANAGER / HR / ADMIN
            </p>
          </div>
          <div className="p-6 border border-border rounded-lg bg-card space-y-2">
            <p className="text-sm text-muted-foreground">Audit Events</p>
            <p className="text-3xl font-bold">
              {logStats?.totalLogs?.toLocaleString() ??
                auditLogs.length.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Tracked in logs table
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Assign Role Section */}
          <div className="p-6 border border-border rounded-lg bg-card space-y-4">
            <h2 className="text-xl font-bold">Assign Role to User</h2>

            <div>
              <label className="block text-sm font-medium mb-2">
                Select User
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Choose a user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">New Role</label>
              <select
                value={newRole}
                onChange={(e) =>
                  setNewRole(e.target.value as AdminUser["role"])
                }
                className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleAssignRole}
              disabled={assigning}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {assigning ? "Updating..." : "Assign Role"}
            </button>
          </div>

          {/* Grant Permission Section */}
          <div className="p-6 border border-border rounded-lg bg-card space-y-4">
            <h2 className="text-xl font-bold">Grant DAC Permission</h2>

            <div>
              <label className="block text-sm font-medium mb-2">Resource</label>
              <select
                value={selectedResource}
                onChange={(e) => setSelectedResource(e.target.value)}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select resource...</option>
                {resources.map((res) => (
                  <option key={res.id} value={res.id}>
                    {res.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Target User
              </label>
              <select
                value={selectedPermissionUser}
                onChange={(e) => setSelectedPermissionUser(e.target.value)}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.username}>
                    {user.username}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Permission Level
              </label>
              <select
                value={permissionLevel}
                onChange={(e) =>
                  setPermissionLevel(e.target.value as "READ" | "WRITE")
                }
                className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="READ">Read Only</option>
                <option value="WRITE">Read & Write</option>
              </select>
            </div>

            <button
              onClick={handleGrantPermission}
              disabled={granting}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {granting ? "Granting..." : "Grant Permission"}
            </button>
          </div>
        </div>

        {/* MAC Resource Overview */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Protected Resources (MAC)</h2>
          <p className="text-sm text-muted-foreground">
            Every resource is classified as PUBLIC, INTERNAL, or CONFIDENTIAL.
            Users must have a security level equal or higher than the resource
            to access it.
          </p>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full">
              <thead className="bg-secondary/30 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Sensitivity Level
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {resources.length > 0 ? (
                  resources.map((resource) => (
                    <tr
                      key={resource.id}
                      className="border-b border-border hover:bg-secondary/20"
                    >
                      <td className="px-6 py-4 text-sm font-medium">
                        {resource.name}
                      </td>
                      <td className="px-6 py-4 text-sm">{resource.owner}</td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                          {resource.sensitivityLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {resource.createdAt
                          ? new Date(resource.createdAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Link
                          href={`/resources/${resource.id}`}
                          className="text-primary hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-muted-foreground"
                    >
                      No resources found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Users Table */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Active Users</h2>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full">
              <thead className="bg-secondary/30 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Security Level
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? (
                  users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-border hover:bg-secondary/20"
                    >
                      <td className="px-6 py-4 text-sm font-medium">
                        {user.username}
                      </td>
                      <td className="px-6 py-4 text-sm">{user.email}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {user.department}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <select
                          value={user.securityLevel}
                          onChange={(e) =>
                            handleSecurityLevelChange(
                              user.id,
                              e.target.value as AdminUser["securityLevel"]
                            )
                          }
                          disabled={updatingSecurity}
                          className="px-2 py-1 border border-input rounded-lg bg-background text-sm"
                        >
                          <option value="PUBLIC">PUBLIC</option>
                          <option value="INTERNAL">INTERNAL</option>
                          <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        {user.isLocked ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                            <span className="w-2 h-2 bg-destructive rounded-full" />
                            Locked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                            <span className="w-2 h-2 bg-green-600 rounded-full" />
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-muted-foreground"
                    >
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Trail */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Recent Audit Trail</h2>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full">
              <thead className="bg-secondary/30 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-border hover:bg-secondary/20"
                    >
                      <td className="px-6 py-4 text-sm">
                        {new Date(log.timestamp).toLocaleString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium capitalize">
                        {log.action.replace(/_/g, " ")}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {log.username || "SYSTEM"}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground truncate max-w-xs">
                        {typeof log.details === "string"
                          ? log.details
                          : JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-muted-foreground"
                    >
                      No log entries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
