import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { grantPermission, revokePermission } from '@/lib/access-control'
import { logUserActivity } from '@/lib/logger'
import { z } from 'zod'

const grantSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  permissionType: z.enum(['READ', 'WRITE']),
})

const revokeSchema = z.object({
  permissionId: z.number(),
})

// POST /api/resources/[id]/permissions  -> grant DAC permission
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const resourceId = parseInt(id)
    if (isNaN(resourceId)) {
      return NextResponse.json({ error: 'Invalid resource ID' }, { status: 400 })
    }

    const body = await request.json()
    const validation = grantSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 },
      )
    }

    const { username, permissionType } = validation.data

    // Find target user
    const targetUser = await prisma.user.findUnique({
      where: { username },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    const result = await grantPermission(resourceId, currentUser.userId, targetUser.id, permissionType)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to grant permission' }, { status: 400 })
    }

    // Log separately for clarity
    await logUserActivity({
      userId: currentUser.userId,
      username: currentUser.username,
      action: 'dac_permission_granted',
      details: { resourceId, targetUserId: targetUser.id, targetUsername: targetUser.username, permissionType },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Grant permission error:', error)
    return NextResponse.json({ error: 'Failed to grant permission' }, { status: 500 })
  }
}

// DELETE /api/resources/[id]/permissions  -> revoke DAC permission
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const resourceId = parseInt(id)
    if (isNaN(resourceId)) {
      return NextResponse.json({ error: 'Invalid resource ID' }, { status: 400 })
    }

    const body = await request.json()
    const validation = revokeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 },
      )
    }

    const { permissionId } = validation.data

    // Load permission and resource to enforce owner-only revoke
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
      include: {
        resource: true,
        user: true,
      },
    })

    if (!permission || permission.resourceId !== resourceId) {
      return NextResponse.json({ error: 'Permission not found for this resource' }, { status: 404 })
    }

    if (permission.resource.ownerId !== currentUser.userId) {
      return NextResponse.json({ error: 'Only resource owner can revoke permissions' }, { status: 403 })
    }

    const result = await revokePermission(
      resourceId,
      currentUser.userId,
      permission.userId,
      permission.permissionType as any,
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to revoke permission' }, { status: 400 })
    }

    await logUserActivity({
      userId: currentUser.userId,
      username: currentUser.username,
      action: 'dac_permission_revoked',
      details: {
        resourceId,
        permissionId,
        targetUserId: permission.userId,
        targetUsername: permission.user.username,
        permissionType: permission.permissionType,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Revoke permission error:', error)
    return NextResponse.json({ error: 'Failed to revoke permission' }, { status: 500 })
  }
}


