import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkABAC } from "@/lib/access-control";
import { logUserActivity } from "@/lib/logger";
import { z } from "zod";
import type { AccessContext } from "@/lib/access-control";

const createPayrollSchema = z.object({
  userId: z.string(),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
  baseSalary: z.number().min(0),
  bonus: z.number().min(0).optional(),
  deductions: z.number().min(0).optional(),
});

/**
 * GET /api/payroll
 * Get payroll records (HR/Finance/Admin only, or own records for employees)
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    // Get client IP
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded
      ? forwarded.split(",")[0]
      : request.headers.get("x-real-ip") || "unknown";

    // Check access using ABAC
    const accessContext: AccessContext = {
      userId: user.userId,
      username: user.username,
      role: user.role as any,
      department: user.department,
      securityLevel: user.securityLevel as any,
      ip,
      timestamp: new Date(),
    };

    // Employees can only see their own payroll
    if (user.role === "EMPLOYEE") {
      if (userId && userId !== user.userId) {
        return NextResponse.json(
          { error: "Access denied - You can only view your own payroll" },
          { status: 403 }
        );
      }
    } else {
      // HR/Finance/Admin can access payroll (ABAC check)
      const payrollAccess = checkABAC(accessContext, "payroll_access");
      if (!payrollAccess.allowed) {
        await logUserActivity({
          userId: user.userId,
          username: user.username,
          ip,
          action: "payroll_access_denied",
          details: { reason: payrollAccess.reason },
        });
        return NextResponse.json(
          { error: payrollAccess.reason },
          { status: 403 }
        );
      }
    }

    // Build where clause
    const where: any = {};
    if (userId) {
      where.userId = userId;
    } else if (user.role === "EMPLOYEE") {
      where.userId = user.userId;
    }
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);

    const payrollRecords = await prisma.payrollRecord.findMany({
      where,
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
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    // Log access
    await logUserActivity({
      userId: user.userId,
      username: user.username,
      ip,
      action: "payroll_viewed",
      details: {
        recordsCount: payrollRecords.length,
        filters: { userId, month, year },
      },
    });

    return NextResponse.json({
      success: true,
      payroll: payrollRecords.map((record) => ({
        id: record.id,
        userId: record.userId,
        employee: record.user.username,
        email: record.user.email,
        department: record.user.department,
        role: record.user.role,
        month: record.month,
        year: record.year,
        baseSalary: record.baseSalary,
        bonus: record.bonus,
        deductions: record.deductions,
        netPay: record.netPay,
        status: record.status,
        approvedBy: record.approvedBy?.username,
        approvedAt: record.approvedAt,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      })),
      count: payrollRecords.length,
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
 * POST /api/payroll
 * Create payroll record (HR/Finance/Admin only)
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only HR/Finance/Admin can create payroll records
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
    const validation = createPayrollSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const {
      userId,
      month,
      year,
      baseSalary,
      bonus = 0,
      deductions = 0,
    } = validation.data;
    const netPay = baseSalary + bonus - deductions;

    // Check if record already exists
    const existing = await prisma.payrollRecord.findUnique({
      where: {
        userId_month_year: {
          userId,
          month,
          year,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Payroll record for this month already exists" },
        { status: 400 }
      );
    }

    const payrollRecord = await prisma.payrollRecord.create({
      data: {
        userId,
        month,
        year,
        baseSalary,
        bonus,
        deductions,
        netPay,
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    // Log creation
    await logUserActivity({
      userId: user.userId,
      username: user.username,
      action: "payroll_created",
      details: {
        payrollId: payrollRecord.id,
        targetUserId: userId,
        month,
        year,
        netPay,
      },
    });

    return NextResponse.json({
      success: true,
      payroll: payrollRecord,
    });
  } catch (error: any) {
    console.error("Create payroll error:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Payroll record already exists for this month" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create payroll record" },
      { status: 500 }
    );
  }
}
