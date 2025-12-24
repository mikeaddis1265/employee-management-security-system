import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/employees
 * Get list of employees (filtered by role/department based on user permissions)
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const department = searchParams.get('department')
    const search = searchParams.get('search')

    // Build where clause
    const where: any = {}

    // Regular employees can only see their own department
    if (user.role === 'EMPLOYEE') {
      where.department = user.department
    }

    // Managers can see their department
    if (user.role === 'MANAGER') {
      where.department = user.department
    }

    // HR and ADMIN can see all
    if (user.role === 'HR' || user.role === 'ADMIN') {
      // No restriction
    }

    if (role) {
      where.role = role
    }

    if (department && (user.role === 'HR' || user.role === 'ADMIN')) {
      where.department = department
    }

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
      ]
    }

    const employees = await prisma.user.findMany({
      where,
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      employees,
      count: employees.length,
    })
  } catch (error: any) {
    console.error('Get employees error:', error)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}

