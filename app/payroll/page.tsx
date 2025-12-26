"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/protected-route";
import toast from "react-hot-toast";
import { getAuthStatus } from "@/lib/auth-client";

interface PayrollRecord {
  id: number;
  employee: string;
  email: string;
  department: string;
  role: string;
  month: number;
  year: number;
  baseSalary: number;
  bonus: number;
  deductions: number;
  netPay: number;
  status: "PENDING" | "APPROVED" | "PROCESSED" | "REJECTED";
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-blue-100 text-blue-800",
  PROCESSED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export default function PayrollPage() {
  const [filterStatus, setFilterStatus] = useState<
    "all" | "PENDING" | "APPROVED" | "PROCESSED"
  >("all");
  const [showSensitive, setShowSensitive] = useState(false);
  const [payrollData, setPayrollData] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    async function fetchData() {
      try {
        const auth = await getAuthStatus();
        if (auth.authenticated && auth.user) {
          setUserRole(auth.user.role.toLowerCase());
          setUsername(auth.user.username);
        }

        const res = await fetch("/api/payroll");
        const data = await res.json();

        if (data.success) {
          setPayrollData(data.payroll || []);
        } else {
          toast.error(data.error || "Failed to load payroll");
        }
      } catch (error) {
        console.error("Error fetching payroll:", error);
        toast.error("Failed to load payroll");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const isManagerial =
    userRole === "manager" || userRole === "hr" || userRole === "admin";

  const filtered = payrollData.filter((record) => {
    return filterStatus === "all" || record.status === filterStatus;
  });

  const handleExport = () => {
    toast.success("Payroll data exported as CSV");
  };

  const handleApprove = async (id: number) => {
    if (!isManagerial) {
      toast.error("You do not have permission to approve payroll");
      return;
    }
    try {
      const res = await fetch(`/api/payroll/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Payroll record approved");
        // Refresh data
        const refreshRes = await fetch("/api/payroll");
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setPayrollData(refreshData.payroll || []);
        }
      } else {
        toast.error(data.error || "Failed to approve");
      }
    } catch (error) {
      toast.error("Failed to approve payroll record");
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRole="user">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-muted-foreground">Loading payroll data...</p>
        </div>
      </ProtectedRoute>
    );
  }

  const employeeView = !isManagerial;

  return (
    <ProtectedRoute requiredRole="user">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">
            {employeeView ? "My Payroll" : "Payroll Management"}
          </h1>
          <p className="text-muted-foreground">
            {employeeView
              ? `Secure payroll records for ${username}`
              : "Confidential salary and compensation information"}
          </p>
        </div>

        {/* Security Alert */}
        <div className="p-4 border-l-4 border-destructive bg-destructive/5 rounded">
          <p className="font-semibold text-destructive">
            Confidential Data
          </p>
          <p className="text-sm text-destructive/80">
            {employeeView
              ? "You can only view your own payroll data. All access is logged."
              : "This page contains highly sensitive payroll information. All access is logged and monitored."}
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-4">
            {!employeeView && (
              <select
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(e.target.value as typeof filterStatus)
                }
                className="px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="PROCESSED">Processed</option>
              </select>
            )}

            <button
              onClick={() => setShowSensitive(!showSensitive)}
              className="px-4 py-2 border border-input rounded-lg bg-background hover:bg-secondary transition-colors font-medium"
            >
              {showSensitive ? "Hide" : "Show"} Sensitive
            </button>
          </div>

          {!employeeView && (
            <button
              onClick={handleExport}
              className="px-4 py-2 border border-input rounded-lg bg-background hover:bg-secondary transition-colors font-medium"
            >
              Export
            </button>
          )}
        </div>

        {/* Payroll Table */}
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full">
            <thead className="bg-secondary/30 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Role
                </th>
                {showSensitive && (
                  <>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Salary
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Bonus
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Deductions
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Net Pay
                    </th>
                  </>
                )}
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Classification
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Status
                </th>
                {isManagerial && (
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-border hover:bg-secondary/20 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium">
                      {record.employee}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {record.department}
                    </td>
                    <td className="px-6 py-4 text-sm capitalize">
                      {record.role.toLowerCase()}
                    </td>
                    {showSensitive && (
                      <>
                        <td className="px-6 py-4 text-sm font-mono">
                          ${record.baseSalary.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-green-600">
                          ${record.bonus.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-destructive">
                          -${record.deductions.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold">
                          ${record.netPay.toLocaleString()}
                        </td>
                      </>
                    )}
                    {!showSensitive && (
                      <>
                        <td
                          colSpan={4}
                          className="px-6 py-4 text-sm text-muted-foreground"
                        >
                          Sensitive data hidden
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-red-100 text-red-800 border-red-300">
                        CONFIDENTIAL
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          statusColors[record.status] || statusColors.PENDING
                        }`}
                      >
                        {record.status}
                      </span>
                    </td>
                    {isManagerial && (
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleApprove(record.id)}
                          disabled={
                            record.status === "PROCESSED" ||
                            record.status === "APPROVED"
                          }
                          className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Approve
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-8 text-center text-muted-foreground"
                  >
                    No payroll records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Stats */}
        {isManagerial && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 border border-border rounded-lg bg-card space-y-2">
              <p className="text-sm text-muted-foreground">Total Pending</p>
              <p className="text-3xl font-bold">
                {filtered.filter((r) => r.status === "PENDING").length}
              </p>
            </div>
            <div className="p-6 border border-border rounded-lg bg-card space-y-2">
              <p className="text-sm text-muted-foreground">Total Approved</p>
              <p className="text-3xl font-bold">
                {filtered.filter((r) => r.status === "APPROVED").length}
              </p>
            </div>
            <div className="p-6 border border-border rounded-lg bg-card space-y-2">
              <p className="text-sm text-muted-foreground">
                Total Processed
              </p>
              <p className="text-3xl font-bold">
                {filtered.filter((r) => r.status === "PROCESSED").length}
              </p>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
