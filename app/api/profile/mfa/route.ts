import { NextResponse } from 'next/server'
import { getCurrentUser, generateMFASecret, verifyMFAToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logUserActivity } from '@/lib/logger'
import { z } from 'zod'

/**
 * GET /api/profile/mfa
 * Get MFA status and generate new secret if needed
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
        mfaEnabled: true,
        mfaSecret: true,
      },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If MFA is not enabled, ensure we have (or generate) a secret and send it back for setup
    if (!dbUser.mfaEnabled) {
      let secret = dbUser.mfaSecret
      if (!secret) {
        const mfaData = generateMFASecret(user.username)
        secret = mfaData.secret
        await prisma.user.update({
          where: { id: user.userId },
          data: { mfaSecret: secret },
        })
      }

      const otpauthUrl = `otpauth://totp/EMS:${user.username}?secret=${secret}&issuer=Employee%20Management%20System`

      return NextResponse.json({
        success: true,
        mfaEnabled: false,
        mfa: {
          secret,
          otpauthUrl,
        },
      })
    }

    // If MFA is enabled, don't return the secret (security); only provide otpauth URL for re-adding if needed
    return NextResponse.json({
      success: true,
      mfaEnabled: true,
      mfa: dbUser.mfaSecret
        ? {
            otpauthUrl: `otpauth://totp/EMS:${user.username}?secret=${dbUser.mfaSecret}&issuer=Employee%20Management%20System`,
          }
        : null,
    })
  } catch (error: any) {
    console.error('Get MFA status error:', error)
    return NextResponse.json({ error: 'Failed to get MFA status' }, { status: 500 })
  }
}

const enableMFASchema = z.object({
  token: z.string().length(6, 'MFA token must be 6 digits'),
})

/**
 * POST /api/profile/mfa/enable
 * Enable MFA after verifying the token
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = enableMFASchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const { token } = validation.data

    // Get user's MFA secret
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        mfaSecret: true,
        mfaEnabled: true,
      },
    })

    if (!dbUser || !dbUser.mfaSecret) {
      // Generate new secret if none exists
      const mfaData = generateMFASecret(user.username)
      await prisma.user.update({
        where: { id: user.userId },
        data: { mfaSecret: mfaData.secret },
      })

      return NextResponse.json(
        { error: 'MFA secret not found. Please refresh and try again.' },
        { status: 400 }
      )
    }

    // Verify the token
    const validToken = verifyMFAToken(dbUser.mfaSecret, token)

    if (!validToken) {
      await logUserActivity({
        userId: user.userId,
        username: user.username,
        action: 'mfa_enable_failed',
        details: { reason: 'Invalid token' },
      })

      return NextResponse.json({ error: 'Invalid MFA token' }, { status: 400 })
    }

    // Enable MFA
    await prisma.user.update({
      where: { id: user.userId },
      data: { mfaEnabled: true },
    })

    await logUserActivity({
      userId: user.userId,
      username: user.username,
      action: 'mfa_enabled',
      details: { timestamp: new Date() },
    })

    return NextResponse.json({
      success: true,
      message: 'MFA enabled successfully',
    })
  } catch (error: any) {
    console.error('Enable MFA error:', error)
    return NextResponse.json({ error: 'Failed to enable MFA' }, { status: 500 })
  }
}

/**
 * DELETE /api/profile/mfa
 * Disable MFA
 */
export async function DELETE() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Disable MFA (but keep the secret in case user wants to re-enable)
    await prisma.user.update({
      where: { id: user.userId },
      data: { mfaEnabled: false },
    })

    await logUserActivity({
      userId: user.userId,
      username: user.username,
      action: 'mfa_disabled',
      details: { timestamp: new Date() },
    })

    return NextResponse.json({
      success: true,
      message: 'MFA disabled successfully',
    })
  } catch (error: any) {
    console.error('Disable MFA error:', error)
    return NextResponse.json({ error: 'Failed to disable MFA' }, { status: 500 })
  }
}

