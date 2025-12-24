import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { performBackup, listBackups } from '@/lib/backup'

/**
 * GET /api/backup - List all backups
 * Requires ADMIN role
 */
export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    const backups = await listBackups()

    return NextResponse.json({
      success: true,
      backups,
      count: backups.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/backup - Create a new backup
 * Requires ADMIN role
 */
export async function POST() {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    const result = await performBackup()

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Backup created successfully',
        filename: result.filename,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
