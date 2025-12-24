import { NextResponse } from 'next/server'
import { getCurrentUser, verifyPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logUserActivity } from '@/lib/logger'
import { z } from 'zod'

const updateProfileSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  department: z.string().min(1, 'Department is required').optional(),
  currentPassword: z.string().min(1, 'Current password is required for verification'),
})

/**
 * PATCH /api/profile/update
 * Update user profile information
 */
export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate input
    const validation = updateProfileSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const { email, department, currentPassword } = validation.data

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        username: true,
        email: true,
        department: true,
        hashedPassword: true,
      },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify current password for security
    const validPassword = await verifyPassword(currentPassword, dbUser.hashedPassword)

    if (!validPassword) {
      await logUserActivity({
        userId: user.userId,
        username: user.username,
        action: 'profile_update_failed',
        details: { reason: 'Invalid password' },
      })

      return NextResponse.json({ error: 'Invalid password' }, { status: 403 })
    }

    // Prepare update data
    const updateData: any = {}
    const changedFields: string[] = []

    if (email && email !== dbUser.email) {
      // Check if email is already taken
      const existingUser = await prisma.user.findUnique({
        where: { email },
      })

      if (existingUser && existingUser.id !== user.userId) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
      }

      updateData.email = email
      updateData.emailVerified = false // Reset verification status
      changedFields.push('email')
    }

    if (department && department !== dbUser.department) {
      updateData.department = department
      changedFields.push('department')
    }

    // Only update if there are changes
    if (changedFields.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes to update',
      })
    }

    // Update profile
    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        department: true,
        role: true,
        securityLevel: true,
        emailVerified: true,
      },
    })

    // Log profile update
    await logUserActivity({
      userId: user.userId,
      username: user.username,
      action: 'profile_updated',
      details: {
        fields: changedFields,
        timestamp: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
      changedFields,
    })
  } catch (error: any) {
    console.error('Profile update error:', error)

    return NextResponse.json(
      {
        error: 'Failed to update profile',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/profile/update
 * Get current user profile
 */
export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        username: true,
        email: true,
        department: true,
        role: true,
        securityLevel: true,
        emailVerified: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      user: dbUser,
    })
  } catch (error: any) {
    console.error('Get profile error:', error)

    return NextResponse.json(
      {
        error: 'Failed to get profile',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
