import { prisma } from "./prisma";
import { logUserActivity } from "./logger";
import { getWorkingHoursSettings } from "./working-hours";

// Enums matching Prisma schema
export type Role = "EMPLOYEE" | "MANAGER" | "HR" | "ADMIN";
export type SecurityLevel = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL";
export type PermissionType = "READ" | "WRITE";

export interface AccessContext {
  userId: string;
  username: string;
  role: Role;
  department: string;
  securityLevel: SecurityLevel;
  ip?: string;
  timestamp?: Date;
}

export interface ResourceContext {
  resourceId: number;
  ownerId: string;
  sensitivityLevel: SecurityLevel;
}

export interface AccessResult {
  allowed: boolean;
  reason?: string;
  deniedBy?: string; // Which control denied access
}

// ======================
// 1. MANDATORY ACCESS CONTROL (MAC)
// ======================
// Users can only access resources at their security level or below
// Security level hierarchy: PUBLIC < INTERNAL < CONFIDENTIAL

const securityLevelRank: Record<SecurityLevel, number> = {
  PUBLIC: 1,
  INTERNAL: 2,
  CONFIDENTIAL: 3,
};

export function checkMAC(
  userLevel: SecurityLevel,
  resourceLevel: SecurityLevel
): AccessResult {
  const userRank = securityLevelRank[userLevel];
  const resourceRank = securityLevelRank[resourceLevel];

  if (userRank >= resourceRank) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `MAC: User security level '${userLevel}' cannot access '${resourceLevel}' resources`,
    deniedBy: "MAC",
  };
}

// ======================
// 2. DISCRETIONARY ACCESS CONTROL (DAC)
// ======================
// Resource owners can grant/revoke permissions

export async function checkDAC(
  userId: string,
  resourceId: number,
  permissionType: PermissionType
): Promise<AccessResult> {
  // Check if user is the owner
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
  });

  if (!resource) {
    return { allowed: false, reason: "Resource not found", deniedBy: "DAC" };
  }

  // Owners have full access
  if (resource.ownerId === userId) {
    return { allowed: true };
  }

  // Check explicit permissions granted by owner
  const permission = await prisma.permission.findFirst({
    where: {
      resourceId,
      userId,
      permissionType,
    },
  });

  if (permission) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `DAC: No ${permissionType} permission granted for this resource`,
    deniedBy: "DAC",
  };
}

// Grant permission (DAC)
export async function grantPermission(
  resourceId: number,
  granterId: string,
  userId: string,
  permissionType: PermissionType
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify granter is the owner
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      return { success: false, error: "Resource not found" };
    }

    if (resource.ownerId !== granterId) {
      return {
        success: false,
        error: "Only resource owner can grant permissions",
      };
    }

    await prisma.permission.create({
      data: {
        resourceId,
        userId,
        permissionType,
        grantedById: granterId,
      },
    });

    // Log permission grant
    await logUserActivity({
      userId: granterId,
      username: "owner",
      action: "permission_granted",
      details: { resourceId, userId, permissionType },
    });

    return { success: true };
  } catch (error: any) {
    if (error.code === "P2002") {
      return { success: false, error: "Permission already exists" };
    }
    return { success: false, error: "Failed to grant permission" };
  }
}

// Revoke permission (DAC)
export async function revokePermission(
  resourceId: number,
  granterId: string,
  userId: string,
  permissionType: PermissionType
): Promise<{ success: boolean; error?: string }> {
  try {
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource || resource.ownerId !== granterId) {
      return {
        success: false,
        error: "Only resource owner can revoke permissions",
      };
    }

    await prisma.permission.deleteMany({
      where: {
        resourceId,
        userId,
        permissionType,
      },
    });

    await logUserActivity({
      userId: granterId,
      username: "owner",
      action: "permission_revoked",
      details: { resourceId, userId, permissionType },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to revoke permission" };
  }
}

// ======================
// 3. ROLE-BASED ACCESS CONTROL (RBAC)
// ======================
// Roles have predefined permissions

export async function checkRBAC(
  role: Role,
  action: string
): Promise<AccessResult> {
  try {
    const roleDef = await prisma.roleDef.findUnique({
      where: { roleName: role },
    });

    if (!roleDef) {
      return {
        allowed: false,
        reason: "Role definition not found",
        deniedBy: "RBAC",
      };
    }

    const permissions = roleDef.permissions as Record<string, boolean>;

    if (permissions[action] === true) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `RBAC: Role '${role}' does not have permission for '${action}'`,
      deniedBy: "RBAC",
    };
  } catch (error) {
    return { allowed: false, reason: "RBAC check failed", deniedBy: "RBAC" };
  }
}

// ======================
// 4. RULE-BASED ACCESS CONTROL (RuBAC)
// ======================
// Access based on conditions: time, location, etc.

export interface AccessRules {
  allowedHours?: { start: number; end: number }; // 24-hour format
  allowedDays?: number[]; // 0-6 (Sunday-Saturday)
  allowedIPs?: string[];
  blockedIPs?: string[];
}

export async function checkRuBAC(
  context: AccessContext,
  rules?: AccessRules
): Promise<AccessResult> {
  const now = context.timestamp || new Date();

  if (!rules) {
    // No explicit rules passed: fall back to the same admin-configured
    // working-hours settings used at login (Admin → Settings → Working
    // Hours), rather than a hardcoded always-allow default. If the admin
    // hasn't enabled the restriction, access is allowed; if they have,
    // this enforces it here too.
    const settings = await getWorkingHoursSettings();
    if (!settings.enabled) {
      return { allowed: true };
    }
    rules = {
      allowedHours: { start: settings.startHour, end: settings.endHour },
      allowedDays: settings.allowedDays,
    };
  }

  // Time-based rule
  if (rules.allowedHours) {
    const hour = now.getHours();
    if (hour < rules.allowedHours.start || hour >= rules.allowedHours.end) {
      return {
        allowed: false,
        reason: `RuBAC: Access only allowed between ${rules.allowedHours.start}:00 and ${rules.allowedHours.end}:00`,
        deniedBy: "RuBAC",
      };
    }
  }

  // Day-based rule
  if (rules.allowedDays && rules.allowedDays.length > 0) {
    const day = now.getDay();
    if (!rules.allowedDays.includes(day)) {
      return {
        allowed: false,
        reason: "RuBAC: Access not allowed on this day",
        deniedBy: "RuBAC",
      };
    }
  }

  // IP-based rules
  if (context.ip) {
    if (rules.blockedIPs && rules.blockedIPs.includes(context.ip)) {
      return {
        allowed: false,
        reason: `RuBAC: IP ${context.ip} is blocked`,
        deniedBy: "RuBAC",
      };
    }

    if (
      rules.allowedIPs &&
      rules.allowedIPs.length > 0 &&
      !rules.allowedIPs.includes(context.ip)
    ) {
      return {
        allowed: false,
        reason: `RuBAC: IP ${context.ip} is not in allowed list`,
        deniedBy: "RuBAC",
      };
    }
  }

  return { allowed: true };
}

// ======================
// 5. ATTRIBUTE-BASED ACCESS CONTROL (ABAC)
// ======================
// Fine-grained control using multiple attributes

export interface ABACPolicy {
  name: string;
  condition: (context: AccessContext, resource?: ResourceContext) => boolean;
  description: string;
}

// Example ABAC Policies
export const abacPolicies: ABACPolicy[] = [
  {
    name: "payroll_access",
    description: "Only HR or Finance department can access payroll data",
    condition: (context) => {
      return (
        ["HR", "Finance"].includes(context.department) ||
        context.role === "ADMIN"
      );
    },
  },
  {
    name: "confidential_access",
    description: "Only MANAGER or above can access confidential resources",
    condition: (context) => {
      return ["MANAGER", "HR", "ADMIN"].includes(context.role);
    },
  },
  {
    name: "leave_approval",
    description:
      "Only HR Managers can approve leave requests exceeding 10 days",
    condition: (context) => {
      return context.role === "HR" || context.role === "ADMIN";
    },
  },
];

export function checkABAC(
  context: AccessContext,
  policyName: string,
  resource?: ResourceContext
): AccessResult {
  const policy = abacPolicies.find((p) => p.name === policyName);

  if (!policy) {
    return {
      allowed: false,
      reason: "ABAC policy not found",
      deniedBy: "ABAC",
    };
  }

  if (policy.condition(context, resource)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `ABAC: ${policy.description}`,
    deniedBy: "ABAC",
  };
}

// ======================
// COMBINED ACCESS CHECK
// ======================
// Checks all access control models

export async function checkAccess(
  context: AccessContext,
  resource: ResourceContext,
  permissionType: PermissionType,
  options?: {
    skipMAC?: boolean;
    skipDAC?: boolean;
    skipRBAC?: boolean;
    skipRuBAC?: boolean;
    skipABAC?: boolean;
    abacPolicy?: string;
    ruBACRules?: AccessRules;
  }
): Promise<AccessResult> {
  const checks: AccessResult[] = [];
  const isOwner = context.userId === resource.ownerId;

  // 1. Mandatory Access Control (MAC)
  if (!options?.skipMAC) {
    const macResult = checkMAC(
      context.securityLevel,
      resource.sensitivityLevel
    );
    if (!macResult.allowed) {
      await logUserActivity({
        userId: context.userId,
        username: context.username,
        ip: context.ip,
        action: "access_denied",
        details: {
          reason: macResult.reason,
          resourceId: resource.resourceId,
          deniedBy: "MAC",
        },
      });
      return macResult;
    }
    checks.push(macResult);
  }

  // 2. Discretionary Access Control (DAC)
  if (!options?.skipDAC) {
    const dacResult = await checkDAC(
      context.userId,
      resource.resourceId,
      permissionType
    );
    if (!dacResult.allowed) {
      await logUserActivity({
        userId: context.userId,
        username: context.username,
        ip: context.ip,
        action: "access_denied",
        details: {
          reason: dacResult.reason,
          resourceId: resource.resourceId,
          deniedBy: "DAC",
        },
      });
      return dacResult;
    }
    checks.push(dacResult);
  }

  // 3. Role-Based Access Control (RBAC)
  if (!options?.skipRBAC && !isOwner) {
    const action =
      permissionType === "READ" ? "read_resource" : "write_resource";
    const rbacResult = await checkRBAC(context.role, action);
    if (!rbacResult.allowed) {
      await logUserActivity({
        userId: context.userId,
        username: context.username,
        ip: context.ip,
        action: "access_denied",
        details: {
          reason: rbacResult.reason,
          resourceId: resource.resourceId,
          deniedBy: "RBAC",
        },
      });
      return rbacResult;
    }
    checks.push(rbacResult);
  }

  // 4. Rule-Based Access Control (RuBAC)
  if (!options?.skipRuBAC) {
    const rubacResult = await checkRuBAC(context, options?.ruBACRules);
    if (!rubacResult.allowed) {
      await logUserActivity({
        userId: context.userId,
        username: context.username,
        ip: context.ip,
        action: "access_denied",
        details: {
          reason: rubacResult.reason,
          resourceId: resource.resourceId,
          deniedBy: "RuBAC",
        },
      });
      return rubacResult;
    }
    checks.push(rubacResult);
  }

  // 5. Attribute-Based Access Control (ABAC)
  if (!options?.skipABAC && options?.abacPolicy) {
    const abacResult = checkABAC(context, options.abacPolicy, resource);
    if (!abacResult.allowed) {
      await logUserActivity({
        userId: context.userId,
        username: context.username,
        ip: context.ip,
        action: "access_denied",
        details: {
          reason: abacResult.reason,
          resourceId: resource.resourceId,
          deniedBy: "ABAC",
        },
      });
      return abacResult;
    }
    checks.push(abacResult);
  }

  // All checks passed
  await logUserActivity({
    userId: context.userId,
    username: context.username,
    ip: context.ip,
    action: "access_granted",
    details: { resourceId: resource.resourceId, permissionType },
  });

  return { allowed: true };
}
