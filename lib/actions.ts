'use server'

import { prisma } from './prisma'
import {
  hashPassword,
  verifyPassword,
  createToken,
  setAuthCookie,
  clearAuthCookie,
  getCurrentUser,
  generateMFASecret,
  verifyMFAToken,
  checkLockout,
  recordFailedLogin,
  resetFailedAttempts,
  generateVerificationToken,
  sendVerificationEmail,
} from './auth'
import { logUserActivity, logAuditTrail } from './logger'
import { checkAccess, grantPermission as grantPermissionAC, revokePermission as revokePermissionAC } from './access-control'
import { redirect } from 'next/navigation'
import type { Role, SecurityLevel, PermissionType } from './access-control'

// ==================
// REGISTRATION
// ==================

export interface RegisterData {
  username: string
  email: string
  password: string
  role: string
  department: string
  securityLevel?: string
}

export async function registerUser(data: RegisterData) {
  try {
    // Validate password strength
    if (data.password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' }
    }

    if (!/[A-Z]/.test(data.password)) {
      return { success: false, error: 'Password must contain uppercase letter' }
    }

    if (!/[a-z]/.test(data.password)) {
      return { success: false, error: 'Password must contain lowercase letter' }
    }

    if (!/[0-9]/.test(data.password)) {
      return { success: false, error: 'Password must contain a number' }
    }

    // Map frontend roles to backend enum
    const roleMap: Record<string, Role> = {
      user: 'EMPLOYEE',
      employee: 'EMPLOYEE',
      manager: 'MANAGER',
      hr: 'HR',
      admin: 'ADMIN',
    }

    const role = roleMap[data.role.toLowerCase()] || 'EMPLOYEE'

    // Assign security level based on role
    let securityLevel: SecurityLevel = 'PUBLIC'
    if (role === 'MANAGER' || role === 'HR') {
      securityLevel = 'INTERNAL'
    } else if (role === 'ADMIN') {
      securityLevel = 'CONFIDENTIAL'
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password)

    // Generate MFA secret
    const mfaData = generateMFASecret(data.username)

    // Generate verification token
    const verificationToken = generateVerificationToken()

    // Create user
    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        hashedPassword,
        role,
        department: data.department,
        securityLevel,
        mfaSecret: mfaData.secret,
        mfaEnabled: true,
        verificationToken,
        emailVerified: false,
      },
    })

    // Send verification email (simulated)
    await sendVerificationEmail(data.email, verificationToken)

    // Log registration
    await logUserActivity({
      userId: user.id,
      username: user.username,
      action: 'user_registered',
      details: { role, department: data.department, securityLevel },
    })

    return {
      success: true,
      data: {
        userId: user.id,
        username: user.username,
        mfaSecret: mfaData.secret,
        mfaQRUrl: mfaData.otpauthUrl,
      },
    }
  } catch (error: any) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0]
      return { success: false, error: `${field === 'username' ? 'Username' : 'Email'} already exists` }
    }
    console.error('Registration error:', error)
    return { success: false, error: 'Registration failed. Please try again.' }
  }
}

// ==================
// LOGIN
// ==================

export interface LoginData {
  username: string
  password: string
  otp?: string
}

export async function loginUser(data: LoginData, ip?: string) {
  try {
    // Check account lockout
    const lockoutStatus = await checkLockout(data.username)
    if (lockoutStatus.locked) {
      await logUserActivity({
        username: data.username,
        ip,
        action: 'login_blocked',
        details: { reason: 'Account locked', lockedUntil: lockoutStatus.lockedUntil },
      })
      return {
        success: false,
        error: `Account locked due to multiple failed attempts. Try again after ${lockoutStatus.lockedUntil?.toLocaleTimeString()}`,
      }
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { username: data.username },
    })

    if (!user) {
      await logUserActivity({
        username: data.username,
        ip,
        action: 'failed_login',
        details: { reason: 'User not found' },
      })
      return { success: false, error: 'Invalid username or password' }
    }

    // Verify password
    const passwordValid = await verifyPassword(data.password, user.hashedPassword)
    if (!passwordValid) {
      await recordFailedLogin(data.username)
      await logUserActivity({
        userId: user.id,
        username: data.username,
        ip,
        action: 'failed_login',
        details: { reason: 'Invalid password', failedAttempts: user.failedAttempts + 1 },
      })
      return { success: false, error: 'Invalid username or password' }
    }

    // Check MFA if enabled
    if (user.mfaEnabled) {
      if (!data.otp) {
        // First step: password verified, need OTP
        return {
          success: false,
          requireMFA: true,
          message: 'Please enter your MFA code',
        }
      }

      // Verify MFA token
      if (!user.mfaSecret) {
        return { success: false, error: 'MFA not properly configured' }
      }

      const mfaValid = verifyMFAToken(user.mfaSecret, data.otp)
      if (!mfaValid) {
        await recordFailedLogin(data.username)
        await logUserActivity({
          userId: user.id,
          username: data.username,
          ip,
          action: 'failed_login',
          details: { reason: 'Invalid MFA token' },
        })
        return { success: false, error: 'Invalid MFA code' }
      }
    }

    // Reset failed attempts on successful login
    await resetFailedAttempts(data.username)

    // Create JWT token
    const token = createToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      department: user.department,
      securityLevel: user.securityLevel,
    })

    // Set HTTP-only cookie
    await setAuthCookie(token)

    // Log successful login
    await logUserActivity({
      userId: user.id,
      username: user.username,
      ip,
      action: 'login_success',
      details: { role: user.role, department: user.department },
    })

    return {
      success: true,
      data: {
        userId: user.id,
        username: user.username,
        role: user.role,
        department: user.department,
        securityLevel: user.securityLevel,
      },
    }
  } catch (error) {
    console.error('Login error:', error)
    return { success: false, error: 'Login failed. Please try again.' }
  }
}

// ==================
// LOGOUT
// ==================

export async function logoutUser() {
  try {
    const user = await getCurrentUser()
    if (user) {
      await logUserActivity({
        userId: user.userId,
        username: user.username,
        action: 'logout',
        details: {},
      })
    }
    await clearAuthCookie()
    return { success: true }
  } catch (error) {
    console.error('Logout error:', error)
    return { success: false, error: 'Logout failed' }
  }
}

// ==================
// RESOURCE OPERATIONS
// ==================

export async function createResource(name: string, description: string, sensitivityLevel: SecurityLevel, ip?: string) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const resource = await prisma.resource.create({
      data: {
        name,
        description,
        sensitivityLevel,
        ownerId: user.userId,
        content: {},
      },
    })

    await logUserActivity({
      userId: user.userId,
      username: user.username,
      ip,
      action: 'resource_created',
      details: { resourceId: resource.id, name, sensitivityLevel },
    })

    return { success: true, data: resource }
  } catch (error) {
    console.error('Create resource error:', error)
    return { success: false, error: 'Failed to create resource' }
  }
}

export async function getResources() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get all resources the user can access
    const resources = await prisma.resource.findMany({
      include: {
        owner: {
          select: {
            username: true,
            role: true,
          },
        },
        permissions: {
          where: {
            userId: user.userId,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return { success: true, data: resources }
  } catch (error) {
    console.error('Get resources error:', error)
    return { success: false, error: 'Failed to fetch resources' }
  }
}

export async function getResourceById(resourceId: number, permissionType: PermissionType = 'READ', ip?: string) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        owner: {
          select: {
            username: true,
            role: true,
            department: true,
          },
        },
        permissions: true,
      },
    })

    if (!resource) {
      return { success: false, error: 'Resource not found' }
    }

    // Check access using all access control models
    const accessResult = await checkAccess(
      {
        userId: user.userId,
        username: user.username,
        role: user.role as Role,
        department: user.department,
        securityLevel: user.securityLevel as SecurityLevel,
        ip,
        timestamp: new Date(),
      },
      {
        resourceId: resource.id,
        ownerId: resource.ownerId,
        sensitivityLevel: resource.sensitivityLevel,
      },
      permissionType
    )

    if (!accessResult.allowed) {
      return { success: false, error: accessResult.reason }
    }

    return { success: true, data: resource }
  } catch (error) {
    console.error('Get resource error:', error)
    return { success: false, error: 'Failed to fetch resource' }
  }
}

// ==================
// PERMISSION MANAGEMENT (DAC)
// ==================

export async function grantResourcePermission(
  resourceId: number,
  targetUserId: string,
  permissionType: PermissionType
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const result = await grantPermissionAC(resourceId, user.userId, targetUserId, permissionType)

    if (result.success) {
      await logAuditTrail({
        userId: user.userId,
        action: 'permission_granted',
        details: `Granted ${permissionType} permission on resource ${resourceId} to user ${targetUserId}`,
        metadata: { resourceId, targetUserId, permissionType },
      })
    }

    return result
  } catch (error) {
    console.error('Grant permission error:', error)
    return { success: false, error: 'Failed to grant permission' }
  }
}

export async function revokeResourcePermission(
  resourceId: number,
  targetUserId: string,
  permissionType: PermissionType
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const result = await revokePermissionAC(resourceId, user.userId, targetUserId, permissionType)

    if (result.success) {
      await logAuditTrail({
        userId: user.userId,
        action: 'permission_revoked',
        details: `Revoked ${permissionType} permission on resource ${resourceId} from user ${targetUserId}`,
        metadata: { resourceId, targetUserId, permissionType },
      })
    }

    return result
  } catch (error) {
    console.error('Revoke permission error:', error)
    return { success: false, error: 'Failed to revoke permission' }
  }
}

// ==================
// USER MANAGEMENT (ADMIN)
// ==================

export async function getAllUsers() {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized: Admin access required' }
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        department: true,
        securityLevel: true,
        mfaEnabled: true,
        isLocked: true,
        failedAttempts: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return { success: true, data: users }
  } catch (error) {
    console.error('Get users error:', error)
    return { success: false, error: 'Failed to fetch users' }
  }
}

export async function updateUserRole(targetUserId: string, newRole: Role) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized: Admin access required' }
    }

    // Update security level based on new role
    let securityLevel: SecurityLevel = 'PUBLIC'
    if (newRole === 'MANAGER' || newRole === 'HR') {
      securityLevel = 'INTERNAL'
    } else if (newRole === 'ADMIN') {
      securityLevel = 'CONFIDENTIAL'
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole, securityLevel },
    })

    await logAuditTrail({
      userId: user.userId,
      action: 'role_changed',
      details: `Changed user ${targetUserId} role to ${newRole}`,
      metadata: { targetUserId, newRole, securityLevel },
    })

    return { success: true }
  } catch (error) {
    console.error('Update role error:', error)
    return { success: false, error: 'Failed to update user role' }
  }
}

// ==================
// PROFILE MANAGEMENT
// ==================

export async function updateProfile(updates: { email?: string; department?: string; password?: string }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const data: any = {}

    if (updates.email) {
      data.email = updates.email
    }

    if (updates.department) {
      data.department = updates.department
    }

    if (updates.password) {
      // Validate new password
      if (updates.password.length < 8) {
        return { success: false, error: 'Password must be at least 8 characters' }
      }
      data.hashedPassword = await hashPassword(updates.password)
    }

    await prisma.user.update({
      where: { id: user.userId },
      data,
    })

    await logUserActivity({
      userId: user.userId,
      username: user.username,
      action: 'profile_updated',
      details: { fields: Object.keys(updates) },
    })

    return { success: true }
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: 'Email already exists' }
    }
    console.error('Update profile error:', error)
    return { success: false, error: 'Failed to update profile' }
  }
}
