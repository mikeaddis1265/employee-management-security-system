import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkABAC } from "@/lib/access-control";
import { logUserActivity } from "@/lib/logger";
import { z } from "zod";
import type { AccessContext } from "@/lib/access-control";

const createLeaveSchema = z.object({
  leaveType: z.enum([
    "VACATION",
    "SICK_LEAVE",
    "PERSONAL",
    "MATERNITY",
    "PATERNITY",
    "UNPAID",
  ]),
  startDate: z.string(), // ISO date string
  endDate: z.string(), // ISO date string
  reason: z.string().min(10, "Reason must be at least 10 characters"),
});

/**
 * GET /api/leave
 * Get leave requests
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const status = searchParams.get("status");

    // Build where clause
    const where: any = {};

    // Employees can only see their own leave requests
    if (user.role === "EMPLOYEE") {
      where.employeeId = user.userId;
    } else if (userId) {
      // Managers can see their department, HR/Admin can see all
      if (user.role === "MANAGER") {
        const targetUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { department: true },
        });
        if (targetUser?.department !== user.department) {
          return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }
      }
      where.employeeId = userId;
    }

    if (status) {
      where.status = status;
    }

    const leaveRequests = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            username: true,
            email: true,
            department: true,
            role: true,
          },
        },
        approvedBy: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      leaveRequests: leaveRequests.map((request) => ({
        id: request.id,
        employeeId: request.employeeId,
        username: request.employee.username,
        email: request.employee.email,
        department: request.employee.department,
        role: request.employee.role,
        leaveType: request.leaveType,
        startDate: request.startDate,
        endDate: request.endDate,
        days: request.days,
        reason: request.reason,
        status: request.status,
        approvedBy: request.approvedBy?.username,
        approvedAt: request.approvedAt,
        rejectionReason: request.rejectionReason,
        createdAt: request.createdAt,
      })),
      count: leaveRequests.length,
    });
  } catch (error: any) {
    console.error("Get leave requests error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leave requests" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leave
 * Create leave request
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createLeaveSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { leaveType, startDate, endDate, reason } = validation.data;
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (start >= end) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 }
      );
    }

    // Calculate days
    const days =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Check ABAC rule: Only HR Managers can approve leave requests exceeding 10 days
    if (days > 10) {
      // This will be checked during approval, not creation
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: user.userId,
        leaveType,
        startDate: start,
        endDate: end,
        days,
        reason,
        status: "PENDING",
      },
      include: {
        employee: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    // Log leave request
    await logUserActivity({
      userId: user.userId,
      username: user.username,
      action: "leave_request_created",
      details: {
        leaveRequestId: leaveRequest.id,
        leaveType,
        days,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      leaveRequest,
    });
  } catch (error: any) {
    console.error("Create leave request error:", error);
    return NextResponse.json(
      { error: "Failed to create leave request" },
      { status: 500 }
    );
  }
}
