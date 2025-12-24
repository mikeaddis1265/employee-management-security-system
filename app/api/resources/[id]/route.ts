import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  checkAccess,
  grantPermission,
  revokePermission,
} from "@/lib/access-control";
import { logUserActivity } from "@/lib/logger";
import { z } from "zod";
import type { SecurityLevel, PermissionType } from "@/lib/access-control";

const updateResourceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  content: z.any().optional(),
});

/**
 * GET /api/resources/[id]
 * Get a specific resource by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const resourceId = parseInt(id);
    if (isNaN(resourceId)) {
      return NextResponse.json(
        { error: "Invalid resource ID" },
        { status: 400 }
      );
    }

    // Get client IP
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded
      ? forwarded.split(",")[0]
      : request.headers.get("x-real-ip") || "unknown";

    // Get resource
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
        permissions: {
          include: {
            user: {
              select: {
                username: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!resource) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 }
      );
    }

    // Check access
    let canWrite =
      resource.ownerId === user.userId ||
      resource.permissions.some(
        (p) => p.userId === user.userId && p.permissionType === "WRITE"
      );

    // Admins can view any resource regardless of DAC/RBAC; MAC still enforced elsewhere.
    if (user.role !== "ADMIN") {
      // For PUBLIC and INTERNAL resources, skip DAC and RBAC
      // MAC will still enforce security level restrictions
      const shouldSkipDACandRBAC =
        resource.sensitivityLevel === "PUBLIC" ||
        resource.sensitivityLevel === "INTERNAL";

      const accessResult = await checkAccess(
        {
          userId: user.userId,
          username: user.username,
          role: user.role as any,
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
        "READ",
        {
          skipDAC: shouldSkipDACandRBAC, // Skip DAC for PUBLIC/INTERNAL (MAC handles access)
          skipRBAC: shouldSkipDACandRBAC, // Skip RBAC for PUBLIC/INTERNAL (MAC handles access)
        }
      );

      if (!accessResult.allowed) {
        return NextResponse.json(
          {
            error: "Access denied",
            reason: accessResult.reason,
          },
          { status: 403 }
        );
      }
    } else {
      canWrite = true;
    }

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
        updatedAt: resource.updatedAt,
        canRead: true,
        canWrite,
        isOwner: resource.ownerId === user.userId,
        permissions: resource.permissions.map((p) => ({
          id: p.id,
          userId: p.userId,
          username: p.user.username,
          permissionType: p.permissionType,
          grantedAt: p.grantedAt,
        })),
      },
    });
  } catch (error: any) {
    console.error("Get resource error:", error);
    return NextResponse.json(
      { error: "Failed to fetch resource" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/resources/[id]
 * Update a resource
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const resourceId = parseInt(id);
    if (isNaN(resourceId)) {
      return NextResponse.json(
        { error: "Invalid resource ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = updateResourceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    // Get client IP
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded
      ? forwarded.split(",")[0]
      : request.headers.get("x-real-ip") || "unknown";

    // Get resource
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 }
      );
    }

    // Check write access
    const accessResult = await checkAccess(
      {
        userId: user.userId,
        username: user.username,
        role: user.role as any,
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
      "WRITE"
    );

    if (!accessResult.allowed) {
      return NextResponse.json(
        {
          error: "Access denied",
          reason: accessResult.reason,
        },
        { status: 403 }
      );
    }

    // Update resource
    const updatedResource = await prisma.resource.update({
      where: { id: resourceId },
      data: {
        name: validation.data.name,
        description: validation.data.description,
        content: validation.data.content,
      },
      include: {
        owner: {
          select: {
            username: true,
            role: true,
          },
        },
      },
    });

    // Log update
    await logUserActivity({
      userId: user.userId,
      username: user.username,
      ip,
      action: "resource_updated",
      details: {
        resourceId: updatedResource.id,
        changes: validation.data,
      },
    });

    return NextResponse.json({
      success: true,
      resource: {
        id: updatedResource.id,
        name: updatedResource.name,
        description: updatedResource.description,
        sensitivityLevel: updatedResource.sensitivityLevel,
        owner: updatedResource.owner.username,
        content: updatedResource.content,
        createdAt: updatedResource.createdAt,
        updatedAt: updatedResource.updatedAt,
        canRead: true,
        canWrite: true,
      },
    });
  } catch (error: any) {
    console.error("Update resource error:", error);
    return NextResponse.json(
      { error: "Failed to update resource" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/resources/[id]
 * Delete a resource (only owner can delete)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const resourceId = parseInt(id);
    if (isNaN(resourceId)) {
      return NextResponse.json(
        { error: "Invalid resource ID" },
        { status: 400 }
      );
    }

    // Get client IP
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded
      ? forwarded.split(",")[0]
      : request.headers.get("x-real-ip") || "unknown";

    // Get resource
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 }
      );
    }

    // Only owner can delete
    if (resource.ownerId !== user.userId) {
      return NextResponse.json(
        { error: "Only resource owner can delete" },
        { status: 403 }
      );
    }

    // Delete resource
    await prisma.resource.delete({
      where: { id: resourceId },
    });

    // Log deletion
    await logUserActivity({
      userId: user.userId,
      username: user.username,
      ip,
      action: "resource_deleted",
      details: {
        resourceId,
        name: resource.name,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Resource deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete resource error:", error);
    return NextResponse.json(
      { error: "Failed to delete resource" },
      { status: 500 }
    );
  }
}
