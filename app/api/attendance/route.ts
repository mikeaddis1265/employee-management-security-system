import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logUserActivity } from "@/lib/logger";
import { z } from "zod";

const createAttendanceSchema = z.object({
  date: z.string(), // ISO date string
  checkIn: z.string().optional(), // ISO datetime string
  checkOut: z.string().optional(), // ISO datetime string
  status: z
    .enum(["PRESENT", "ABSENT", "LATE", "HALF_DAY", "SICK_LEAVE", "VACATION"])
    .optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/attendance
 * Get attendance records
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build where clause
    const where: any = {};

    // Employees can only see their own attendance
    if (user.role === "EMPLOYEE") {
      where.userId = user.userId;
    } else if (userId) {
      // Managers can see their department, HR/Admin can see all
      if (user.role === "MANAGER") {
        // Check if user is in same department
        const targetUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { department: true },
        });
        if (targetUser?.department !== user.department) {
          return NextResponse.json(
            { error: "Access denied - Different department" },
            { status: 403 }
          );
        }
      }
      where.userId = userId;
    }

    if (startDate) {
      where.date = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.date = { ...where.date, lte: new Date(endDate) };
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            department: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      attendance: attendance.map((record) => ({
        id: record.id,
        userId: record.userId,
        username: record.user.username,
        email: record.user.email,
        department: record.user.department,
        date: record.date,
        checkIn: record.checkIn,
        checkOut: record.checkOut,
        hoursWorked: record.hoursWorked,
        status: record.status,
        notes: record.notes,
        createdAt: record.createdAt,
      })),
      count: attendance.length,
    });
  } catch (error: any) {
    console.error("Get attendance error:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/attendance
 * Create or update attendance record
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createAttendanceSchema.safeParse(body);

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
      date,
      checkIn,
      checkOut,
      status = "PRESENT",
      notes,
    } = validation.data;
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    // Calculate hours worked if both checkIn and checkOut are provided
    let hoursWorked: number | null = null;
    if (checkIn && checkOut) {
      const checkInTime = new Date(checkIn).getTime();
      const checkOutTime = new Date(checkOut).getTime();
      hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60); // Convert to hours
    }

    // Check if record exists for this date
    const existing = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId: user.userId,
          date: dateObj,
        },
      },
    });

    let attendanceRecord;

    if (existing) {
      // Update existing record
      attendanceRecord = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          checkIn: checkIn ? new Date(checkIn) : existing.checkIn,
          checkOut: checkOut ? new Date(checkOut) : existing.checkOut,
          hoursWorked,
          status,
          notes: notes || existing.notes,
        },
      });
    } else {
      // Create new record
      attendanceRecord = await prisma.attendance.create({
        data: {
          userId: user.userId,
          date: dateObj,
          checkIn: checkIn ? new Date(checkIn) : null,
          checkOut: checkOut ? new Date(checkOut) : null,
          hoursWorked,
          status,
          notes,
        },
      });
    }

    // Log attendance action
    await logUserActivity({
      userId: user.userId,
      username: user.username,
      action: existing ? "attendance_updated" : "attendance_created",
      details: {
        attendanceId: attendanceRecord.id,
        date: dateObj.toISOString(),
        status,
      },
    });

    return NextResponse.json({
      success: true,
      attendance: attendanceRecord,
    });
  } catch (error: any) {
    console.error("Create attendance error:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Attendance record already exists for this date" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create attendance record" },
      { status: 500 }
    );
  }
}
