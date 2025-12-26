"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/protected-route";
import toast from "react-hot-toast";
import { getAuthStatus } from "@/lib/auth-client";

interface AttendanceRecord {
  id: number;
  username: string;
  email: string;
  department: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  hoursWorked: number | null;
  status: string;
  notes: string | null;
}

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const authStatus = await getAuthStatus();
        if (authStatus.authenticated && authStatus.user) {
          setUserInfo(authStatus.user);
        }

        // Fetch attendance records for last 30 days
        const startDate = new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000
        ).toISOString();
        const res = await fetch(`/api/attendance?startDate=${startDate}`);
        const data = await res.json();

        if (data.success) {
          setAttendance(data.attendance || []);
        } else {
          toast.error(data.error || "Failed to load attendance");
        }
      } catch (error) {
        console.error("Error fetching attendance:", error);
        toast.error("Failed to load attendance");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleCheckIn = async () => {
    try {
      const now = new Date().toISOString();
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          checkIn: now,
          status: "PRESENT",
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Checked in successfully!");
        setCheckInTime(now);
        // Refresh attendance
        const refreshRes = await fetch(
          `/api/attendance?startDate=${new Date(
            Date.now() - 30 * 24 * 60 * 60 * 1000
          ).toISOString()}`
        );
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setAttendance(refreshData.attendance || []);
        }
      } else {
        toast.error(data.error || "Failed to check in");
      }
    } catch (error) {
      toast.error("Failed to check in");
    }
  };

  const handleCheckOut = async () => {
    try {
      const now = new Date().toISOString();
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          checkOut: now,
          status: "PRESENT",
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Checked out successfully!");
        setCheckOutTime(now);
        // Refresh attendance
        const refreshRes = await fetch(
          `/api/attendance?startDate=${new Date(
            Date.now() - 30 * 24 * 60 * 60 * 1000
          ).toISOString()}`
        );
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setAttendance(refreshData.attendance || []);
        }
      } else {
        toast.error(data.error || "Failed to check out");
      }
    } catch (error) {
      toast.error("Failed to check out");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PRESENT":
        return "bg-green-100 text-green-800";
      case "ABSENT":
        return "bg-red-100 text-red-800";
      case "LATE":
        return "bg-yellow-100 text-yellow-800";
      case "HALF_DAY":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRole="user">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-muted-foreground">Loading attendance...</p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="user">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Time & Attendance Management</h1>
          <p className="text-muted-foreground">
            Track your work hours and attendance
          </p>
        </div>

        {/* Check In/Out Card */}
        <div className="p-6 border border-border rounded-lg bg-card space-y-4">
          <h2 className="text-xl font-bold">Today's Attendance</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background"
              />
            </div>
            <div>
              <button
                onClick={handleCheckIn}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Check In
              </button>
            </div>
            <div>
              <button
                onClick={handleCheckOut}
                className="w-full px-4 py-2 border border-input rounded-lg font-medium hover:bg-secondary transition-colors"
              >
                Check Out
              </button>
            </div>
          </div>
        </div>

        {/* Attendance Records */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Attendance History</h2>
            <button className="px-4 py-2 border border-input rounded-lg hover:bg-secondary transition-colors">
              Export
            </button>
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
                    Check In
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Check Out
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Hours Worked
                  </th>
                </tr>
              </thead>
              <tbody>
                {attendance.length > 0 ? (
                  attendance.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b border-border hover:bg-secondary/20"
                    >
                      <td className="px-6 py-4 text-sm">
                        {new Date(record.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                            record.status
                          )}`}
                        >
                          {record.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {record.checkIn
                          ? new Date(record.checkIn).toLocaleTimeString()
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {record.checkOut
                          ? new Date(record.checkOut).toLocaleTimeString()
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        {record.hoursWorked
                          ? `${record.hoursWorked.toFixed(1)} hrs`
                          : "N/A"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
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
