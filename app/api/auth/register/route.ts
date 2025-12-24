import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateMFASecret, generateVerificationToken, sendVerificationEmail } from '@/lib/auth'
import { logUserActivity } from '@/lib/logger'

const registerSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  department: z.string().min(2),
  captchaToken: z.string().nullable().optional(), // reCAPTCHA token (can be string, null, or undefined)
})

/**
 * Verify reCAPTCHA token
 */
async function verifyCaptcha(token: string): Promise<boolean> {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY

    // Skip verification if secret key not configured (development)
    if (!secretKey) {
      console.warn('[CAPTCHA] Secret key not configured - skipping verification')
      return true
    }

    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify'

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    })

    const data = await response.json()

    if (data.success) {
      console.log('[CAPTCHA] Verification successful')
      return true
    } else {
      console.log('[CAPTCHA] Verification failed:', data['error-codes'])
      return false
    }
  } catch (error) {
    console.error('[CAPTCHA] Verification error:', error)
    return false
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Convert null captchaToken to undefined for consistency
    if (body.captchaToken === null) {
      body.captchaToken = undefined
    }

    // Validate input
    const validatedData = registerSchema.parse(body)

    // Verify CAPTCHA if provided
    if (validatedData.captchaToken) {
      const captchaValid = await verifyCaptcha(validatedData.captchaToken)
      if (!captchaValid) {
        return NextResponse.json(
          { error: 'CAPTCHA verification failed. Please try again.' },
          { status: 400 }
        )
      }
    } else if (process.env.RECAPTCHA_SECRET_KEY) {
      // If CAPTCHA is configured but token not provided
      return NextResponse.json(
        { error: 'CAPTCHA verification required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: validatedData.username },
          { email: validatedData.email },
        ],
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username or email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password)

    // Generate MFA secret
    const mfaData = generateMFASecret(validatedData.username)

    // Generate email verification token
    const verificationToken = generateVerificationToken()

    // All self-registered users are EMPLOYEE with PUBLIC security level
    // Only admins can assign other roles (MANAGER, HR, ADMIN)
    const role = 'EMPLOYEE'
    const securityLevel = 'PUBLIC'

    // Create user
    const user = await prisma.user.create({
      data: {
        username: validatedData.username,
        email: validatedData.email,
        hashedPassword,
        role,
        department: validatedData.department,
        securityLevel,
        mfaSecret: mfaData.secret,
        mfaEnabled: false, // User will enable after scanning QR
        verificationToken,
        emailVerified: false,
      },
    })

    // Best-effort: send verification email (server-side log / dev aid)
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const verificationUrl = `${appUrl}/verify?token=${verificationToken}`
      await sendVerificationEmail(user.email, verificationToken)
      console.log('[REGISTER] Verification URL:', verificationUrl)
    } catch (err) {
      console.error('[REGISTER] Failed to send verification email:', err)
    }

    // Log the registration
    await logUserActivity({
      username: user.username,
      userId: user.id,
      action: 'user_registered',
      details: { email: user.email, role: user.role, department: user.department },
    })

    // Return user data with MFA secret for QR code
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      mfa: {
        secret: mfaData.secret,
        otpauthUrl: mfaData.otpauthUrl,
      },
      verificationToken,
      verificationUrl: `${
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      }/verify?token=${verificationToken}`,
    })
  } catch (error: any) {
    console.error('Registration error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    // Handle Prisma unique constraint errors
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0]
      if (field === 'username') {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 400 }
        )
      }
      if (field === 'email') {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Username or email already exists' },
        { status: 400 }
      )
    }

    // Handle Prisma errors (like table not found)
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Database error. Please contact administrator.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}
