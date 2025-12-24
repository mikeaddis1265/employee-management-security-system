import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logUserActivity, logAuditTrail } from '@/lib/logger'

/**
 * GET /api/admin/users
 * Get all users (Admin only)
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        department: true,
        securityLevel: true,
        emailVerified: true,
        mfaEnabled: true,
        isLocked: true,
        failedAttempts: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      users,
      count: users.length,
    })
  } catch (error: any) {
    console.error('Get users error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
