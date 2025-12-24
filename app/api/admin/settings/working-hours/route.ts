import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logUserActivity } from '@/lib/logger'
import { z } from 'zod'

const workingHoursSchema = z.object({
  enabled: z.boolean(),
  startHour: z.number().min(0).max(23),
  endHour: z.number().min(0).max(23),
  allowedDays: z.array(z.number().min(0).max(6)).optional(), // 0 = Sunday, 6 = Saturday
})

/**
 * GET /api/admin/settings/working-hours
 * Get current working hours settings
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get working hours settings
    const settings = await prisma.systemSettings.findUnique({
      where: { key: 'working_hours' },
    })

    if (!settings) {
      // Return default settings if not configured
      return NextResponse.json({
        success: true,
        settings: {
          enabled: false,
          startHour: 9,
          endHour: 17,
          allowedDays: [1, 2, 3, 4, 5], // Monday-Friday
        },
      })
    }

    return NextResponse.json({
      success: true,
      settings: settings.value,
    })
  } catch (error: any) {
    console.error('Get working hours error:', error)
    return NextResponse.json(
      { error: 'Failed to get working hours settings' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/settings/working-hours
 * Update working hours settings (Admin only)
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate input
    const validation = workingHoursSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const { enabled, startHour, endHour, allowedDays } = validation.data

    // Validate that end hour is after start hour
    if (endHour <= startHour) {
      return NextResponse.json(
        { error: 'End hour must be after start hour' },
        { status: 400 }
      )
    }

    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded
      ? forwarded.split(',')[0]
      : request.headers.get('x-real-ip') || 'unknown'

    // Update or create settings
    const settings = await prisma.systemSettings.upsert({
      where: { key: 'working_hours' },
      update: {
        value: {
          enabled,
          startHour,
          endHour,
          allowedDays: allowedDays || [1, 2, 3, 4, 5],
        },
        updatedBy: user.username,
      },
      create: {
        key: 'working_hours',
        value: {
          enabled,
          startHour,
          endHour,
          allowedDays: allowedDays || [1, 2, 3, 4, 5],
        },
        description: 'Working hours login restriction settings',
        updatedBy: user.username,
      },
    })

    // Log the settings change
    await logUserActivity({
      userId: user.userId,
      username: user.username,
      ip,
      action: 'working_hours_updated',
      details: {
        enabled,
        startHour,
        endHour,
        allowedDays: allowedDays || [1, 2, 3, 4, 5],
        timestamp: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Working hours settings updated successfully',
      settings: settings.value,
    })
  } catch (error: any) {
    console.error('Update working hours error:', error)
    return NextResponse.json(
      { error: 'Failed to update working hours settings' },
      { status: 500 }
    )
  }
}
