import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkAccess } from '@/lib/access-control'
import { logUserActivity } from '@/lib/logger'
import type { SecurityLevel } from '@/lib/access-control'

/**
 * GET /api/employees/[id]
 * Get individual employee details with access control
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const employeeId = id

    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'

    // Get employee from database
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        department: true,
        securityLevel: true,
        emailVerified: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Access control checks
    // Regular employees can only see their own department
    if (user.role === 'EMPLOYEE' && employee.department !== user.department) {
      await logUserActivity({
        userId: user.userId,
        username: user.username,
        ip,
        action: 'access_denied',
        details: {
          reason: 'Department mismatch - Employee can only view same department',
          targetEmployeeId: employeeId,
        },
      })

      return NextResponse.json(
        {
          error: 'Access denied',
          reason: 'You can only view employees in your department',
        },
        { status: 403 }
      )
    }

    // Managers can see their department
    if (user.role === 'MANAGER' && employee.department !== user.department) {
      await logUserActivity({
        userId: user.userId,
        username: user.username,
        ip,
        action: 'access_denied',
        details: {
          reason: 'Department mismatch - Manager can only view same department',
          targetEmployeeId: employeeId,
        },
      })

      return NextResponse.json(
        {
          error: 'Access denied',
          reason: 'You can only view employees in your department',
        },
        { status: 403 }
      )
    }

    // Check MAC (Mandatory Access Control) - user level must be >= employee level
    const userRank: Record<SecurityLevel, number> = {
      PUBLIC: 1,
      INTERNAL: 2,
      CONFIDENTIAL: 3,
    }

    const userLevelRank = userRank[user.securityLevel as SecurityLevel]
    const employeeLevelRank = userRank[employee.securityLevel as SecurityLevel]

    if (userLevelRank < employeeLevelRank) {
      await logUserActivity({
        userId: user.userId,
        username: user.username,
        ip,
        action: 'access_denied',
        details: {
          reason: `MAC: User security level '${user.securityLevel}' cannot access '${employee.securityLevel}' employee data`,
          targetEmployeeId: employeeId,
          deniedBy: 'MAC',
        },
      })

      return NextResponse.json(
        {
          error: 'Access denied',
          reason: `Your security level (${user.securityLevel}) is insufficient to view this employee's data (${employee.securityLevel})`,
        },
        { status: 403 }
      )
    }

    // Log successful access
    await logUserActivity({
      userId: user.userId,
      username: user.username,
      ip,
      action: 'employee_viewed',
      details: {
        targetEmployeeId: employeeId,
        targetEmployeeUsername: employee.username,
        targetDepartment: employee.department,
      },
    })

    // Determine what data can be shown based on role
    const canRead = true // Already passed access checks
    const canWrite = user.role === 'ADMIN' || user.role === 'HR' || (user.role === 'MANAGER' && employee.department === user.department)

    // Format response
    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        username: employee.username,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        securityLevel: employee.securityLevel,
        emailVerified: employee.emailVerified,
        mfaEnabled: employee.mfaEnabled,
        joinDate: employee.createdAt,
        canRead,
        canWrite,
      },
    })
  } catch (error: any) {
    console.error('Get employee error:', error)
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 })
  }
}

