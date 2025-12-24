import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkABAC } from "@/lib/access-control";
import { logUserActivity } from "@/lib/logger";
import type { AccessContext } from "@/lib/access-control";

/**
 * PATCH /api/leave/[id]
 * Approve or reject leave request
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leaveId = parseInt(id);
    if (isNaN(leaveId)) {
      return NextResponse.json(
        { error: "Invalid leave request ID" },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { status, rejectionReason } = body;

    if (!["APPROVED", "REJECTED", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Get leave request
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: {
        employee: {
          select: {
            username: true,
            department: true,
            role: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      return NextResponse.json(
        { error: "Leave request not found" },
        { status: 404 }
      );
    }

    // Employees can only cancel their own requests
    if (status === "CANCELLED" && leaveRequest.employeeId === user.userId) {
      const updated = await prisma.leaveRequest.update({
        where: { id: leaveId },
        data: { status: "CANCELLED" },
      });

      await logUserActivity({
        userId: user.userId,
        username: user.username,
        action: "leave_request_cancelled",
        details: { leaveRequestId: leaveId },
      });

      return NextResponse.json({ success: true, leaveRequest: updated });
    }

    // Only HR/Admin can approve/reject
    if (status === "APPROVED" || status === "REJECTED") {
      if (user.role !== "HR" && user.role !== "ADMIN") {
        return NextResponse.json(
          {
            error:
              "Access denied - Only HR can approve or reject leave requests",
          },
          { status: 403 }
        );
      }

      // Check ABAC: Only HR Managers can approve leave requests exceeding 10 days
      if (status === "APPROVED" && leaveRequest.days > 10) {
        const accessContext: AccessContext = {
          userId: user.userId,
          username: user.username,
          role: user.role as any,
          department: user.department,
          securityLevel: user.securityLevel as any,
          timestamp: new Date(),
        };

        const leaveApproval = checkABAC(accessContext, "leave_approval");
        if (!leaveApproval.allowed) {
          return NextResponse.json(
            {
              error:
                "Access denied - Only HR Managers can approve leave requests exceeding 10 days",
            },
            { status: 403 }
          );
        }
      }

      const updateData: any = {
        status,
        approvedById: user.userId,
        approvedAt: new Date(),
      };

      if (status === "REJECTED" && rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }

      const updated = await prisma.leaveRequest.update({
        where: { id: leaveId },
        data: updateData,
      });

      await logUserActivity({
        userId: user.userId,
        username: user.username,
        action: `leave_request_${status.toLowerCase()}`,
        details: {
          leaveRequestId: leaveId,
          targetUserId: leaveRequest.userId,
          days: leaveRequest.days,
          rejectionReason: status === "REJECTED" ? rejectionReason : undefined,
        },
      });

      return NextResponse.json({ success: true, leaveRequest: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Update leave request error:", error);
    return NextResponse.json(
      { error: "Failed to update leave request" },
      { status: 500 }
    );
  }
}
