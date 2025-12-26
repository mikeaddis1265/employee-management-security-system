"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/protected-route";
import Link from "next/link";
import { getAuthStatus } from "@/lib/auth-client";
import toast from "react-hot-toast";

interface PayrollSummary {
  month: number;
  year: number;
  netPay: number;
  status: string;
}

interface LeaveSummary {
  id: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
}

interface AttendanceSummary {
  date: string;
  status: string;
  hoursWorked: number | null;
}

export default function SelfServicePage() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [payrollRecords, setPayrollRecords] = useState<PayrollSummary[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveSummary[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceSummary[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Get user info
        const authStatus = await getAuthStatus();
        if (authStatus.authenticated && authStatus.user) {
          setUserInfo(authStatus.user);
        }

        // Fetch payroll records (own records only)
        const payrollRes = await fetch("/api/payroll");
        if (payrollRes.ok) {
          const payrollData = await payrollRes.json();
          if (payrollData.success) {
            setPayrollRecords(payrollData.payroll.slice(0, 6) || []);
          }
        }

        // Fetch leave requests
        const leaveRes = await fetch("/api/leave");
        if (leaveRes.ok) {
          const leaveData = await leaveRes.json();
          if (leaveData.success) {
            setLeaveRequests(leaveData.leaveRequests.slice(0, 5) || []);
          }
        }

        // Fetch recent attendance
        const attendanceRes = await fetch(
          "/api/attendance?startDate=" +
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        );
        if (attendanceRes.ok) {
          const attendanceData = await attendanceRes.json();
          if (attendanceData.success) {
            setAttendanceRecords(attendanceData.attendance.slice(0, 10) || []);
          }
        }
      } catch (error) {
        console.error("Error fetching self-service data:", error);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <ProtectedRoute requiredRole="user">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="user">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Employee Self-Service Portal</h1>
          <p className="text-muted-foreground">
            Access your payroll, attendance, leave requests, and HR documents
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            href="/self-service/payroll"
            className="p-6 border border-border rounded-lg bg-card hover:shadow-lg transition-shadow"
          >
            <h3 className="font-bold mb-2">Payroll</h3>
            <p className="text-sm text-muted-foreground">
              {payrollRecords.length} recent records
            </p>
          </Link>

          <Link
            href="/self-service/attendance"
            className="p-6 border border-border rounded-lg bg-card hover:shadow-lg transition-shadow"
          >
            <h3 className="font-bold mb-2">Attendance</h3>
            <p className="text-sm text-muted-foreground">
              {attendanceRecords.length} recent entries
            </p>
          </Link>

          <Link
            href="/self-service/leave"
            className="p-6 border border-border rounded-lg bg-card hover:shadow-lg transition-shadow"
          >
            <h3 className="font-bold mb-2">Leave Requests</h3>
            <p className="text-sm text-muted-foreground">
              {leaveRequests.filter((l) => l.status === "PENDING").length}{" "}
              pending
            </p>
          </Link>

          <Link
            href="/self-service/documents"
            className="p-6 border border-border rounded-lg bg-card hover:shadow-lg transition-shadow"
          >
            <h3 className="font-bold mb-2">Documents</h3>
            <p className="text-sm text-muted-foreground">View & download</p>
          </Link>
        </div>

        {/* Recent Payroll */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Recent Payroll Records</h2>
            <Link
              href="/payroll"
              className="text-primary hover:underline text-sm font-medium"
            >
              View All →
            </Link>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-secondary/30 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Month/Year
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Net Pay
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {payrollRecords.length > 0 ? (
                  payrollRecords.map((record) => (
                    <tr
                      key={`${record.year}-${record.month}`}
                      className="border-b border-border hover:bg-secondary/20"
                    >
                      <td className="px-6 py-4 text-sm">
                        {new Date(
                          record.year,
                          record.month - 1
                        ).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        ${record.netPay.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            record.status === "PROCESSED"
                              ? "bg-green-100 text-green-800"
                              : record.status === "APPROVED"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-primary hover:underline text-sm font-medium">
                          Download
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-muted-foreground"
                    >
                      No payroll records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Leave Requests */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Recent Leave Requests</h2>
            <Link
              href="/leave"
              className="text-primary hover:underline text-sm font-medium"
            >
              View All →
            </Link>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-secondary/30 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Dates
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Days
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.length > 0 ? (
                  leaveRequests.map((request) => (
                    <tr
                      key={request.id}
                      className="border-b border-border hover:bg-secondary/20"
                    >
                      <td className="px-6 py-4 text-sm capitalize">
                        {request.leaveType.toLowerCase().replace("_", " ")}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {new Date(request.startDate).toLocaleDateString()} -{" "}
                        {new Date(request.endDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">{request.days} days</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            request.status === "APPROVED"
                              ? "bg-green-100 text-green-800"
                              : request.status === "REJECTED"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {request.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-muted-foreground"
                    >
                      No leave requests found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Attendance */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Recent Attendance</h2>
            <Link
              href="/attendance"
              className="text-primary hover:underline text-sm font-medium"
            >
              View All →
            </Link>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-secondary/30 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Hours Worked
                  </th>
                </tr>
              </thead>
              <tbody>
                {attendanceRecords.length > 0 ? (
                  attendanceRecords.map((record, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-border hover:bg-secondary/20"
                    >
                      <td className="px-6 py-4 text-sm">
                        {new Date(record.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                            record.status === "PRESENT"
                              ? "bg-green-100 text-green-800"
                              : record.status === "ABSENT"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {record.status.toLowerCase().replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {record.hoursWorked
                          ? `${record.hoursWorked.toFixed(1)} hrs`
                          : "N/A"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-8 text-center text-muted-foreground"
                    >
                      No attendance records found
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
