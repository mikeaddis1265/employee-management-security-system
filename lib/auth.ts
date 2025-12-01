import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import speakeasy from 'speakeasy'
import { cookies } from 'next/headers'
import { prisma } from './prisma'

const SALT_ROUNDS = 12

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return secret
}

// Password Hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

// JWT Token Functions
export interface JWTPayload {
  userId: string
  username: string
  role: string
  department: string
  securityLevel: string
}

export function createToken(payload: JWTPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: '30m', // 30 minutes as per requirements
  })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload
  } catch (error) {
    return null
  }
}

// Session Management with HTTP-only cookies
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 30, // 30 minutes
    path: '/',
  })
}

export async function getAuthCookie(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get('auth_token')?.value
}

export async function clearAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete('auth_token')
}

export async function getCurrentUser(): Promise<JWTPayload | null> {
  const token = await getAuthCookie()
  if (!token) return null
  return verifyToken(token)
}

// Multi-Factor Authentication (TOTP)
export function generateMFASecret(username: string): { secret: string; otpauthUrl: string } {
  const secret = speakeasy.generateSecret({
    name: `EMS:${username}`,
    issuer: 'Employee Management System',
    length: 32,
  })

  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url || '',
  }
}

export function verifyMFAToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2, // Allow 2 steps before/after for clock skew
  })
}

// Account Lockout Protection
interface LockoutInfo {
  attempts: number
  lastAttempt: Date
  lockedUntil?: Date
}

const lockoutStore: Map<string, LockoutInfo> = new Map()
const MAX_ATTEMPTS = 3
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes

export async function checkLockout(username: string): Promise<{ locked: boolean; remainingAttempts?: number; lockedUntil?: Date }> {
  // Check database for persistent lockout
  const user = await prisma.user.findUnique({
    where: { username },
    select: { isLocked: true, failedAttempts: true, lastFailedLogin: true },
  })

  if (user?.isLocked && user.lastFailedLogin) {
    const lockedUntil = new Date(user.lastFailedLogin.getTime() + LOCKOUT_DURATION)
    if (new Date() < lockedUntil) {
      return { locked: true, lockedUntil }
    } else {
      // Unlock the account if lockout period has passed
      await prisma.user.update({
        where: { username },
        data: { isLocked: false, failedAttempts: 0 },
      })
    }
  }

  return { locked: false, remainingAttempts: MAX_ATTEMPTS - (user?.failedAttempts || 0) }
}

export async function recordFailedLogin(username: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { username },
  })

  if (!user) return false

  const failedAttempts = user.failedAttempts + 1
  const isLocked = failedAttempts >= MAX_ATTEMPTS

  await prisma.user.update({
    where: { username },
    data: {
      failedAttempts,
      lastFailedLogin: new Date(),
      isLocked,
    },
  })

  return isLocked
}

export async function resetFailedAttempts(username: string): Promise<void> {
  await prisma.user.update({
    where: { username },
    data: {
      failedAttempts: 0,
      isLocked: false,
      lastFailedLogin: null,
    },
  })
}

// Email Verification (Simulated)
export function generateVerificationToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  // In production, use nodemailer to send actual emails
  // For this prototype, we'll just log it
  console.log(`[EMAIL VERIFICATION] Send to ${email}: ${process.env.NEXT_PUBLIC_APP_URL}/verify?token=${token}`)
}
