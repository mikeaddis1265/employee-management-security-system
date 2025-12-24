import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAccess } from "@/lib/access-control";
import { logUserActivity } from "@/lib/logger";
import { z } from "zod";
import type { SecurityLevel, PermissionType } from "@/lib/access-control";

const createResourceSchema = z.object({
  name: z.string().min(1, "Resource name is required"),
  description: z.string().optional(),
  sensitivityLevel: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL"]),
  content: z.any().optional(),
});

/**
 * GET /api/resources
 * Get all resources the user can access
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const includeAll = url.searchParams.get("includeAll") === "true";

    // Get client IP
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded
      ? forwarded.split(",")[0]
      : request.headers.get("x-real-ip") || "unknown";

    // Get all resources
    const resources = await prisma.resource.findMany({
      include: {
        owner: {
          select: {
            username: true,
            role: true,
          },
        },
        permissions:
          includeAll && user.role === "ADMIN"
            ? true
            : {
                where: {
                  userId: user.userId,
                },
              },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (includeAll && user.role === "ADMIN") {
      return NextResponse.json({
        success: true,
        resources: resources.map((resource) => ({
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
          canWrite: true,
        })),
        count: resources.length,
      });
    }

    // Filter resources based on access control
    const accessibleResources = [];
    for (const resource of resources) {
      // For PUBLIC and INTERNAL resources, skip DAC and RBAC
      // MAC will still enforce security level restrictions
      // For example: PUBLIC user can't see INTERNAL resources (MAC blocks it)
      // But INTERNAL user can see INTERNAL resources (MAC allows, DAC skipped)
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

      if (accessResult.allowed) {
        accessibleResources.push({
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
          canWrite:
            resource.permissions.some((p) => p.permissionType === "WRITE") ||
            resource.ownerId === user.userId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      resources: accessibleResources,
      count: accessibleResources.length,
    });
  } catch (error: any) {
    console.error("Get resources error:", error);
    return NextResponse.json(
      { error: "Failed to fetch resources" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/resources
 * Create a new resource
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createResourceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { name, description, sensitivityLevel, content } = validation.data;

    // Get client IP
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded
      ? forwarded.split(",")[0]
      : request.headers.get("x-real-ip") || "unknown";

    // Create resource
    const resource = await prisma.resource.create({
      data: {
        name,
        description,
        sensitivityLevel: sensitivityLevel as SecurityLevel,
        content: content || {},
        ownerId: user.userId,
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

    // Log resource creation
    await logUserActivity({
      userId: user.userId,
      username: user.username,
      ip,
      action: "resource_created",
      details: {
        resourceId: resource.id,
        name,
        sensitivityLevel,
      },
    });

    return NextResponse.json({
      success: true,
      resource: {
        id: resource.id,
        name: resource.name,
        description: resource.description,
        sensitivityLevel: resource.sensitivityLevel,
        owner: resource.owner.username,
        content: resource.content,
        createdAt: resource.createdAt,
        canRead: true,
        canWrite: true,
      },
    });
  } catch (error: any) {
    console.error("Create resource error:", error);
    return NextResponse.json(
      { error: "Failed to create resource" },
      { status: 500 }
    );
  }
}
