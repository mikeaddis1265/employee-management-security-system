"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/protected-route";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const leaveRequestSchema = z.object({
  leaveType: z.enum([
    "VACATION",
    "SICK_LEAVE",
    "PERSONAL",
    "MATERNITY",
    "PATERNITY",
    "UNPAID",
  ]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
});

type LeaveRequestForm = z.infer<typeof leaveRequestSchema>;

interface LeaveRequest {
  id: number;
  username: string;
  email: string;
  department: string;
  role: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export default function LeavePage() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LeaveRequestForm>({
    resolver: zodResolver(leaveRequestSchema),
  });

  useEffect(() => {
    async function fetchData() {
      try {
        // Get user role from auth
        const authRes = await fetch("/api/profile/update");
        const authData = await authRes.json();
        if (authData.success && authData.user) {
          setUserRole(authData.user.role);
        }

        // Fetch leave requests
        const res = await fetch("/api/leave");
        const data = await res.json();

        if (data.success) {
          setLeaveRequests(data.leaveRequests || []);
        } else {
          toast.error(data.error || "Failed to load leave requests");
        }
      } catch (error) {
        console.error("Error fetching leave requests:", error);
        toast.error("Failed to load leave requests");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const onSubmit = async (data: LeaveRequestForm) => {
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();
      if (result.success) {
        toast.success("Leave request submitted successfully!");
        setShowForm(false);
        reset();
        // Refresh leave requests
        const refreshRes = await fetch("/api/leave");
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setLeaveRequests(refreshData.leaveRequests || []);
        }
      } else {
        toast.error(result.error || "Failed to submit leave request");
      }
    } catch (error) {
      toast.error("Failed to submit leave request");
    }
  };

  const handleApprove = async (id: number) => {
    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Leave request approved");
        // Refresh
        const refreshRes = await fetch("/api/leave");
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setLeaveRequests(refreshData.leaveRequests || []);
        }
      } else {
        toast.error(data.error || "Failed to approve");
      }
    } catch (error) {
      toast.error("Failed to approve leave request");
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;

    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED", rejectionReason: reason }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Leave request rejected");
        // Refresh
        const refreshRes = await fetch("/api/leave");
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setLeaveRequests(refreshData.leaveRequests || []);
        }
      } else {
        toast.error(data.error || "Failed to reject");
      }
    } catch (error) {
      toast.error("Failed to reject leave request");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-green-100 text-green-800";
      case "REJECTED":
        return "bg-red-100 text-red-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "CANCELLED":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Only HR and ADMIN can approve/reject; others can only see their own status
  const canApprove = userRole === "HR" || userRole === "ADMIN";

  if (loading) {
    return (
      <ProtectedRoute requiredRole="user">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-muted-foreground">Loading leave requests...</p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="user">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Leave Management</h1>
            <p className="text-muted-foreground">
              Request and manage leave requests
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            New Request
          </button>
        </div>

        {/* Leave Request Form */}
        {showForm && (
          <div className="p-6 border border-border rounded-lg bg-card space-y-4">
            <h2 className="text-xl font-bold">Submit Leave Request</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Leave Type
                  </label>
                  <select
                    {...register("leaveType")}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                  >
                    <option value="VACATION">Vacation</option>
                    <option value="SICK_LEAVE">Sick Leave</option>
                    <option value="PERSONAL">Personal</option>
                    <option value="MATERNITY">Maternity</option>
                    <option value="PATERNITY">Paternity</option>
                    <option value="UNPAID">Unpaid</option>
                  </select>
                  {errors.leaveType && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.leaveType.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Start Date
                  </label>
                  <input
                    {...register("startDate")}
                    type="date"
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                  />
                  {errors.startDate && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.startDate.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    End Date
                  </label>
                  <input
                    {...register("endDate")}
                    type="date"
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                  />
                  {errors.endDate && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.endDate.message}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">
                    Reason
                  </label>
                  <textarea
                    {...register("reason")}
                    rows={3}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                    placeholder="Please provide a detailed reason for your leave request..."
                  />
                  {errors.reason && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.reason.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    reset();
                  }}
                  className="px-4 py-2 border border-input rounded-lg font-medium hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Leave Requests Table */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Leave Requests</h2>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-secondary/30 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Employee
                  </th>
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
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Status
                  </th>
                  {canApprove && (
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {leaveRequests.length > 0 ? (
                  leaveRequests.map((request) => (
                    <tr
                      key={request.id}
                      className="border-b border-border hover:bg-secondary/20"
                    >
                      <td className="px-6 py-4 text-sm font-medium">
                        {request.username}
                      </td>
                      <td className="px-6 py-4 text-sm capitalize">
                        {request.leaveType.toLowerCase().replace("_", " ")}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {new Date(request.startDate).toLocaleDateString()} -{" "}
                        {new Date(request.endDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">{request.days} days</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs truncate">
                        {request.reason}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                            request.status
                          )}`}
                        >
                          {request.status}
                        </span>
                      </td>
                      {canApprove && request.status === "PENDING" && (
                        <td className="px-6 py-4 flex gap-2">
                          <button
                            onClick={() => handleApprove(request.id)}
                            className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(request.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors"
                          >
                            Reject
                          </button>
                        </td>
                      )}
                      {canApprove && request.status !== "PENDING" && (
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {request.approvedBy || "N/A"}
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={canApprove ? 7 : 6}
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
      </div>
    </ProtectedRoute>
  );
}
