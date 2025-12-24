import { NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logUserActivity } from '@/lib/logger'
import type { SecurityLevel } from '@/lib/access-control'

export const runtime = 'nodejs'

const allowedLevels: SecurityLevel[] = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL']

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const name = formData.get('name')?.toString().trim()
    const description = formData.get('description')?.toString().trim()
    const sensitivityLevel = (formData.get('sensitivityLevel')?.toString().trim().toUpperCase() ||
      'PUBLIC') as SecurityLevel
    const file = formData.get('file')

    if (!name) {
      return NextResponse.json({ error: 'Resource name is required' }, { status: 400 })
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (!allowedLevels.includes(sensitivityLevel)) {
      return NextResponse.json({ error: 'Invalid security level' }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'Uploaded file is empty' }, { status: 400 })
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(uploadsDir, { recursive: true })

    const safeFileName = `${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const filePath = path.join(uploadsDir, safeFileName)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await fs.writeFile(filePath, buffer)
    const base64Data = buffer.toString('base64')

    const resource = await prisma.resource.create({
      data: {
        name,
        description,
        sensitivityLevel,
        ownerId: user.userId,
        content: {
          filename: file.name,
          storedAs: `/uploads/${safeFileName}`,
          mimeType: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          description: description || '',
          base64: `data:${file.type};base64,${base64Data}`,
        },
      },
      include: {
        owner: {
          select: {
            username: true,
            role: true,
          },
        },
      },
    })

    await logUserActivity({
      userId: user.userId,
      username: user.username,
      action: 'resource_uploaded',
      details: {
        resourceId: resource.id,
        filename: file.name,
        storedAs: `/uploads/${safeFileName}`,
        sensitivityLevel,
      },
    })

    return NextResponse.json({
      success: true,
      resource: {
        id: resource.id,
        name: resource.name,
        description: resource.description,
        sensitivityLevel: resource.sensitivityLevel,
        owner: resource.owner.username,
        ownerRole: resource.owner.role,
        content: resource.content,
        createdAt: resource.createdAt,
        canRead: true,
        canWrite: true,
      },
    })
  } catch (error: any) {
    console.error('Resource upload error:', error)
    return NextResponse.json({ error: 'Failed to upload resource' }, { status: 500 })
  }
}


