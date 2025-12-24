import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getLogs, getLogStatistics } from '@/lib/logger'
import { z } from 'zod'

/**
 * GET /api/logs
 * Get activity logs (admin only)
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can view logs
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    const action = searchParams.get('action')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = searchParams.get('limit')

    const logs = await getLogs({
      username: username || undefined,
      action: action || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : 100,
    })

    // Parse details from JSON string
    const formattedLogs = logs.map((log) => {
      let details = log.details
      try {
        if (typeof details === 'string') {
          details = JSON.parse(details)
        }
      } catch {
        // Keep as string if not valid JSON
      }

      return {
        id: log.id,
        username: log.username,
        userId: log.userId,
        timestamp: log.timestamp,
        ip: log.ip,
        action: log.action,
        details,
        encrypted: log.encrypted,
      }
    })

    // Get statistics
    const stats = await getLogStatistics()

    return NextResponse.json({
      success: true,
      logs: formattedLogs,
      count: formattedLogs.length,
      statistics: stats,
    })
  } catch (error: any) {
    console.error('Get logs error:', error)
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}

