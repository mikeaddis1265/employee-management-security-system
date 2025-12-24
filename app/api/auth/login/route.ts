import { NextResponse } from "next/server";
import { z } from "zod";
import {
  verifyPassword,
  checkLockout,
  recordFailedLogin,
  resetFailedAttempts,
  createToken,
  setAuthCookie,
  verifyMFAToken,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logUserActivity } from "@/lib/logger";
import { checkWorkingHours } from "@/lib/working-hours";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  mfaToken: z.string().optional(),
});

/**
 * POST /api/auth/login
 * Authenticate user with username, password, and optional MFA
 */
export async function POST(request: Request) {
  try {
    // Get client IP address
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded
      ? forwarded.split(",")[0]
      : request.headers.get("x-real-ip") || "unknown";

    const body = await request.json();

    // Validate input
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { username, password, mfaToken } = validation.data;

    // Determine if input is email or username
    const isEmail = username.includes("@");
    const lookupField = isEmail ? { email: username } : { username };

    // Check if account is locked (need to find user first to get username for lockout check)
    let userForLockout = await prisma.user.findFirst({
      where: lookupField,
      select: { username: true },
    });

    const lockoutUsername = userForLockout?.username || username;
    const lockoutStatus = await checkLockout(lockoutUsername);
    if (lockoutStatus.locked) {
      await logUserActivity({
        username: lockoutUsername,
        ip,
        action: "login_attempt_while_locked",
        details: {
          lockedUntil: lockoutStatus.lockedUntil,
        },
      });

      return NextResponse.json(
        {
          error: "Account is locked",
          lockedUntil: lockoutStatus.lockedUntil,
          message: `Account locked due to too many failed login attempts. Try again after ${lockoutStatus.lockedUntil?.toLocaleTimeString()}`,
        },
        { status: 403 }
      );
    }

    // Find user by username or email
    const user = await prisma.user.findFirst({
      where: lookupField,
      select: {
        id: true,
        username: true,
        email: true,
        hashedPassword: true,
        role: true,
        department: true,
        securityLevel: true,
        mfaEnabled: true,
        mfaSecret: true,
        emailVerified: true,
        isLocked: true,
      },
    });

    if (!user) {
      // User not found - log failed attempt but don't reveal this
      await logUserActivity({
        username,
        ip,
        action: "failed_login",
        details: { reason: "User not found" },
      });

      return NextResponse.json(
        { error: "Email or password not correct" },
        { status: 401 }
      );
    }

    // Check email verification
    if (!user.emailVerified) {
      await logUserActivity({
        userId: user.id,
        username,
        ip,
        action: "failed_login",
        details: {
          reason: "Email not verified",
        },
      });

      return NextResponse.json(
        {
          error: "Email not verified",
          message:
            "Please verify your email address before logging in. Check your inbox for the verification link.",
          emailVerified: false,
        },
        { status: 403 }
      );
    }

    // Check working hours restrictions (Admin users bypass this check)
    const workingHoursCheck = await checkWorkingHours(user.role);
    if (!workingHoursCheck.allowed) {
      await logUserActivity({
        userId: user.id,
        username,
        ip,
        action: "login_denied_outside_working_hours",
        details: {
          reason: workingHoursCheck.reason,
          settings: workingHoursCheck.settings,
        },
      });

      return NextResponse.json(
        {
          error: "Access denied",
          message: workingHoursCheck.reason || "You cannot login outside working hours",
        },
        { status: 403 }
      );
    }

    // Verify password
    const validPassword = await verifyPassword(password, user.hashedPassword);

    if (!validPassword) {
      // Record failed login
      const isLocked = await recordFailedLogin(user.username);

      await logUserActivity({
        userId: user.id,
        username,
        ip,
        action: "failed_login",
        details: {
          reason: "Invalid password",
          locked: isLocked,
        },
      });

      if (isLocked) {
        return NextResponse.json(
          {
            error: "Account locked",
            message:
              "Too many failed login attempts. Account locked for 15 minutes.",
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        {
          error: "Email or password not correct",
          remainingAttempts: lockoutStatus.remainingAttempts
            ? lockoutStatus.remainingAttempts - 1
            : 2,
        },
        { status: 401 }
      );
    }

    // If MFA is enabled, verify MFA token
    if (user.mfaEnabled) {
      if (!mfaToken) {
        // MFA token required but not provided
        return NextResponse.json(
          {
            mfaRequired: true,
            message: "MFA token required",
          },
          { status: 200 }
        );
      }

      // Verify MFA token
      if (!user.mfaSecret) {
        return NextResponse.json(
          { error: "MFA not properly configured" },
          { status: 500 }
        );
      }

      const validMFA = verifyMFAToken(user.mfaSecret, mfaToken);

      if (!validMFA) {
        await logUserActivity({
          userId: user.id,
          username,
          ip,
          action: "failed_mfa",
          details: { reason: "Invalid MFA token" },
        });

        return NextResponse.json(
          { error: "Invalid MFA token" },
          { status: 401 }
        );
      }

      await logUserActivity({
        userId: user.id,
        username,
        ip,
        action: "mfa_verified",
        details: { timestamp: new Date() },
      });
    }

    // Login successful - reset failed attempts
    await resetFailedAttempts(user.username);

    // Create JWT token
    const token = createToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      department: user.department,
      securityLevel: user.securityLevel,
    });

    // Set HTTP-only cookie
    await setAuthCookie(token);

    // Log successful login
    await logUserActivity({
      userId: user.id,
      username,
      ip,
      action: "login_success",
      details: {
        role: user.role,
        department: user.department,
        mfaUsed: user.mfaEnabled,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department,
        securityLevel: user.securityLevel,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);

    // Handle Prisma errors (like table not found)
    if (error.code === "P2021" || error.message?.includes("does not exist")) {
      return NextResponse.json(
        {
          error: "Email or password not correct",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: "Email or password not correct",
      },
      { status: 401 }
    );
  }
}
