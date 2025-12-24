import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/seed-roles
 * Seed role definitions (Admin only)
 */
export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      )
    }

    // Check if roles already exist
    const existingRoles = await prisma.roleDef.findMany()

    if (existingRoles.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Roles already exist',
        roles: existingRoles.map(r => r.roleName),
      })
    }

    // Create role definitions
    await prisma.roleDef.createMany({
      data: [
        {
          roleName: 'EMPLOYEE',
          permissions: {
            read_resource: true,
            view_own_payroll: true,
            view_own_attendance: true,
            create_leave_request: true,
            view_own_profile: true,
          },
        },
        {
          roleName: 'MANAGER',
          permissions: {
            read_resource: true,
            write_resource: true,
            view_own_payroll: true,
            view_team_payroll: true,
            view_team_attendance: true,
            approve_leave: true,
            view_team_profiles: true,
            view_own_profile: true,
          },
        },
        {
          roleName: 'HR',
          permissions: {
            read_resource: true,
            write_resource: true,
            view_all_payroll: true,
            approve_payroll: true,
            view_all_attendance: true,
            approve_leave: true,
            view_all_profiles: true,
            manage_employees: true,
            view_own_profile: true,
          },
        },
        {
          roleName: 'ADMIN',
          permissions: {
            read_resource: true,
            write_resource: true,
            view_all_payroll: true,
            approve_payroll: true,
            view_all_attendance: true,
            approve_leave: true,
            view_all_profiles: true,
            manage_employees: true,
            manage_users: true,
            manage_roles: true,
            view_logs: true,
            create_backup: true,
            view_own_profile: true,
          },
        },
      ],
    })

    return NextResponse.json({
      success: true,
      message: 'Role definitions created successfully',
      roles: ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'],
    })
  } catch (error: any) {
    console.error('Seed roles error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to seed roles' },
      { status: 500 }
    )
  }
}
