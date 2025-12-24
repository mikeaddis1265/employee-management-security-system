import { NextResponse } from 'next/server'
import { getCurrentUser, hashPassword, verifyPassword, resetFailedAttempts } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logUserActivity } from '@/lib/logger'
import { z } from 'zod'

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
})

/**
 * POST /api/profile/change-password
 * Change user's password
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate input
    const validation = changePasswordSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword, confirmPassword } = validation.data

    // Check if new passwords match
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'New passwords do not match' }, { status: 400 })
    }

    // Check if new password is different from current
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password must be different from current password' },
        { status: 400 }
      )
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        username: true,
        hashedPassword: true,
      },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify current password
    const validPassword = await verifyPassword(currentPassword, dbUser.hashedPassword)

    if (!validPassword) {
      await logUserActivity({
        userId: user.userId,
        username: user.username,
        action: 'password_change_failed',
        details: { reason: 'Invalid current password' },
      })

      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 })
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword)

    // Update password in database
    await prisma.user.update({
      where: { id: user.userId },
      data: { hashedPassword },
    })

    // Reset failed login attempts
    await resetFailedAttempts(dbUser.username)

    // Log successful password change
    await logUserActivity({
      userId: user.userId,
      username: user.username,
      action: 'password_changed',
      details: {
        timestamp: new Date(),
        changedBy: 'self',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    })
  } catch (error: any) {
    console.error('Password change error:', error)

    return NextResponse.json(
      {
        error: 'Failed to change password',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
