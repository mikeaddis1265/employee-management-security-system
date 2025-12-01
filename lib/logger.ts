import crypto from 'crypto'
import { prisma } from './prisma'

// AES-256-GCM: authenticated encryption (integrity + confidentiality), unlike
// plain CBC which is malleable and gives no tamper detection on stored logs.
const ALGORITHM = 'aes-256-gcm'
const LEGACY_CBC_ALGORITHM = 'aes-256-cbc'

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPT_KEY
  if (!key) {
    throw new Error('ENCRYPT_KEY environment variable is not set')
  }
  // Ensure key is 32 bytes for AES-256
  return Buffer.from(key.substring(0, 32).padEnd(32, '0'), 'utf8')
}

// Encryption Functions
export function encryptLog(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decryptLog(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':')

    if (parts.length === 3) {
      // Current format: iv:authTag:ciphertext (AES-256-GCM)
      const [ivHex, authTagHex, ciphertext] = parts
      const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivHex, 'hex'))
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    }

    if (parts.length === 2) {
      // Legacy format from older log entries: iv:ciphertext (AES-256-CBC)
      const [ivHex, ciphertext] = parts
      const decipher = crypto.createDecipheriv(LEGACY_CBC_ALGORITHM, getEncryptionKey(), Buffer.from(ivHex, 'hex'))
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    }

    return encryptedText // Not encrypted
  } catch (error) {
    console.error('Decryption error:', error)
    return encryptedText // Return as-is if decryption fails
  }
}

// User Activity Logging
export interface LogData {
  username: string
  userId?: string
  ip?: string
  action: string
  details: Record<string, any>
}

export async function logUserActivity(data: LogData): Promise<void> {
  try {
    const detailsString = JSON.stringify(data.details)
    const encryptedDetails = encryptLog(detailsString)

    await prisma.log.create({
      data: {
        userId: data.userId || null,
        username: data.username,
        ip: data.ip || null,
        action: data.action,
        details: encryptedDetails,
        encrypted: true,
        timestamp: new Date(),
      },
    })

    // Alert on critical events
    if (shouldAlert(data.action, data.details)) {
      console.warn(`[SECURITY ALERT] ${data.action} by ${data.username}`, data.details)
    }
  } catch (error) {
    console.error('Failed to log user activity:', error)
  }
}

// Audit Trail (for role/permission changes)
export interface AuditData {
  userId: string
  action: string
  details: string
  metadata?: Record<string, any>
}

export async function logAuditTrail(data: AuditData): Promise<void> {
  try {
    await prisma.auditTrail.create({
      data: {
        userId: data.userId,
        action: data.action,
        details: data.details,
        metadata: data.metadata || null,
        timestamp: new Date(),
      },
    })
  } catch (error) {
    console.error('Failed to log audit trail:', error)
  }
}

// System Events Logging
export async function logSystemEvent(event: string, details: Record<string, any>): Promise<void> {
  await logUserActivity({
    username: 'SYSTEM',
    action: event,
    details,
  })
}

// Alert Mechanism
function shouldAlert(action: string, details: Record<string, any>): boolean {
  const criticalActions = [
    'failed_login',
    'account_locked',
    'access_denied',
    'permission_changed',
    'role_changed',
    'multiple_failed_attempts',
  ]

  if (criticalActions.includes(action)) return true

  // Alert on multiple failed logins
  if (action === 'login_attempt' && details.failed === true) {
    return true
  }

  return false
}

// Retrieve Logs (with decryption)
export interface LogFilter {
  userId?: string
  username?: string
  action?: string
  startDate?: Date
  endDate?: Date
  limit?: number
}

export async function getLogs(filter: LogFilter = {}) {
  const where: any = {}

  if (filter.userId) where.userId = filter.userId
  if (filter.username) where.username = { contains: filter.username, mode: 'insensitive' }
  if (filter.action) where.action = { contains: filter.action, mode: 'insensitive' }
  if (filter.startDate || filter.endDate) {
    where.timestamp = {}
    if (filter.startDate) where.timestamp.gte = filter.startDate
    if (filter.endDate) where.timestamp.lte = filter.endDate
  }

  const logs = await prisma.log.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: filter.limit || 100,
  })

  // Decrypt logs before returning
  return logs.map((log) => ({
    ...log,
    details: log.encrypted ? decryptLog(log.details) : log.details,
  }))
}

// Get Audit Trail
export async function getAuditTrail(userId?: string, limit: number = 100) {
  const where = userId ? { userId } : {}

  return await prisma.auditTrail.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: limit,
    include: {
      user: {
        select: {
          username: true,
          role: true,
        },
      },
    },
  })
}

// Log Statistics (for monitoring dashboard)
export async function getLogStatistics() {
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [totalLogs, failedLogins, accessDenials, recentLogs] = await Promise.all([
    prisma.log.count(),
    prisma.log.count({
      where: {
        action: 'failed_login',
        timestamp: { gte: last24Hours },
      },
    }),
    prisma.log.count({
      where: {
        action: 'access_denied',
        timestamp: { gte: last24Hours },
      },
    }),
    prisma.log.count({
      where: {
        timestamp: { gte: last24Hours },
      },
    }),
  ])

  return {
    totalLogs,
    failedLogins,
    accessDenials,
    recentLogs,
  }
}
