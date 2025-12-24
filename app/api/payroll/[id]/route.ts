import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkABAC } from "@/lib/access-control";
import { logUserActivity } from "@/lib/logger";
import type { AccessContext } from "@/lib/access-control";

/**
 * GET /api/payroll/[id]
 * Get specific payroll record
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const payrollId = parseInt(id);
    if (isNaN(payrollId)) {
      return NextResponse.json(
        { error: "Invalid payroll ID" },
        { status: 400 }
      );
    }

    const payrollRecord = await prisma.payrollRecord.findUnique({
      where: { id: payrollId },
      include: {
        user: {
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
    });

    if (!payrollRecord) {
      return NextResponse.json(
        { error: "Payroll record not found" },
        { status: 404 }
      );
    }

    // Access control: Employees can only see their own
    if (user.role === "EMPLOYEE" && payrollRecord.userId !== user.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // HR/Finance/Admin access check
    if (user.role !== "EMPLOYEE") {
      const accessContext: AccessContext = {
        userId: user.userId,
        username: user.username,
        role: user.role as any,
        department: user.department,
        securityLevel: user.securityLevel as any,
        timestamp: new Date(),
      };

      const payrollAccess = checkABAC(accessContext, "payroll_access");
      if (!payrollAccess.allowed) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    return NextResponse.json({
      success: true,
      payroll: payrollRecord,
    });
  } catch (error: any) {
    console.error("Get payroll error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payroll" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/payroll/[id]
 * Update payroll record (approve/process)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const payrollId = parseInt(id);
    if (isNaN(payrollId)) {
      return NextResponse.json(
        { error: "Invalid payroll ID" },
        { status: 400 }
      );
    }

    // Only HR/Finance/Admin can approve
    const accessContext: AccessContext = {
      userId: user.userId,
      username: user.username,
      role: user.role as any,
      department: user.department,
      securityLevel: user.securityLevel as any,
      timestamp: new Date(),
    };

    const payrollAccess = checkABAC(accessContext, "payroll_access");
    if (!payrollAccess.allowed) {
      return NextResponse.json(
        { error: "Access denied - HR/Finance access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status } = body;

    if (!["APPROVED", "PROCESSED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updateData: any = {
      status,
    };

    if (status === "APPROVED" || status === "PROCESSED") {
      updateData.approvedById = user.userId;
      updateData.approvedAt = new Date();
    }

    const payrollRecord = await prisma.payrollRecord.update({
      where: { id: payrollId },
      data: updateData,
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    // Log approval
    await logUserActivity({
      userId: user.userId,
      username: user.username,
      action: "payroll_updated",
      details: {
        payrollId,
        status,
        targetUserId: payrollRecord.userId,
      },
    });

    return NextResponse.json({
      success: true,
      payroll: payrollRecord,
    });
  } catch (error: any) {
    console.error("Update payroll error:", error);
    return NextResponse.json(
      { error: "Failed to update payroll" },
      { status: 500 }
    );
  }
}
