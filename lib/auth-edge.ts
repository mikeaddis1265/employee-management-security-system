import jwt from 'jsonwebtoken'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return secret
}

// JWT Token Functions for Edge Runtime (no Prisma dependency)
export interface JWTPayload {
  userId: string
  username: string
  role: string
  department: string
  securityLevel: string
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload
  } catch (error) {
    return null
  }
}
