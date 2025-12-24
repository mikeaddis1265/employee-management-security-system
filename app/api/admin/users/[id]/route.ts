import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logUserActivity, logAuditTrail } from '@/lib/logger'
import { z } from 'zod'

const updateUserSchema = z.object({
  role: z.enum(['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN']).optional(),
  securityLevel: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL']).optional(),
  department: z.string().optional(),
  isLocked: z.boolean().optional(),
})

/**
 * PATCH /api/admin/users/[id]
 * Update user (Admin only)
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    const { id: userId } = await params
    const body = await request.json()

    // Validate input
    const validation = updateUserSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const updateData = validation.data

    // Prevent admin from demoting themselves
    if (userId === currentUser.userId && updateData.role && updateData.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Cannot change your own admin role' },
        { status: 400 }
      )
    }

    // Get current user data for audit trail
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        securityLevel: true,
        department: true,
        isLocked: true,
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Track changes for audit trail
    const changes: Record<string, { from: any; to: any }> = {}

    if (updateData.role && updateData.role !== targetUser.role) {
      changes.role = { from: targetUser.role, to: updateData.role }
    }

    if (updateData.securityLevel && updateData.securityLevel !== targetUser.securityLevel) {
      changes.securityLevel = { from: targetUser.securityLevel, to: updateData.securityLevel }
    }

    if (updateData.department && updateData.department !== targetUser.department) {
      changes.department = { from: targetUser.department, to: updateData.department }
    }

    if (updateData.isLocked !== undefined && updateData.isLocked !== targetUser.isLocked) {
      changes.isLocked = { from: targetUser.isLocked, to: updateData.isLocked }

      // Reset failed attempts when unlocking
      if (updateData.isLocked === false) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            failedAttempts: 0,
            lastFailedLogin: null,
          },
        })
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        department: true,
        securityLevel: true,
        isLocked: true,
        emailVerified: true,
        mfaEnabled: true,
      },
    })

    // Log changes to audit trail
    for (const [field, change] of Object.entries(changes)) {
      await logAuditTrail({
        userId: currentUser.userId,
        action: `user_${field}_changed`,
        details: `Changed ${field} for user ${targetUser.username} from ${change.from} to ${change.to}`,
        metadata: {
          targetUserId: userId,
          targetUsername: targetUser.username,
          field,
          oldValue: change.from,
          newValue: change.to,
          changedBy: currentUser.username,
        },
      })

      // Log specific events
      await logUserActivity({
        userId: currentUser.userId,
        username: currentUser.username,
        action: `${field}_changed`,
        details: {
          targetUser: targetUser.username,
          field,
          from: change.from,
          to: change.to,
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser,
      changes: Object.keys(changes),
    })
  } catch (error: any) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Delete user (Admin only)
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    const { id: userId } = await params

    // Prevent admin from deleting themselves
    if (userId === currentUser.userId) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    // Get user before deletion for audit log
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        email: true,
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: userId },
    })

    // Log deletion
    await logAuditTrail({
      userId: currentUser.userId,
      action: 'user_deleted',
      details: `Deleted user ${targetUser.username} (${targetUser.email})`,
      metadata: {
        deletedUserId: userId,
        deletedUsername: targetUser.username,
        deletedUserRole: targetUser.role,
        deletedBy: currentUser.username,
      },
    })

    await logUserActivity({
      userId: currentUser.userId,
      username: currentUser.username,
      action: 'user_deleted',
      details: {
        deletedUser: targetUser.username,
        deletedUserRole: targetUser.role,
      },
    })

    return NextResponse.json({
      success: true,
      message: `User ${targetUser.username} deleted successfully`,
    })
  } catch (error: any) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
