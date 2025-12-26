"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthStatus } from "@/lib/auth-client";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: "admin" | "manager" | "user";
  fallback?: ReactNode;
}

export default function ProtectedRoute({
  children,
  requiredRole,
  fallback,
}: ProtectedRouteProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [accessDeniedReason, setAccessDeniedReason] = useState("");

  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Use server-side auth check which reads from HTTP-only cookies
        const authStatus = await getAuthStatus();

        if (!authStatus.authenticated || !authStatus.user) {
          setIsAuthorized(false);
          setAccessDeniedReason("Authentication required");
          router.push("/login");
          return;
        }

        // Check role-based access
        const userRole = authStatus.user.role.toLowerCase();

        if (requiredRole === "admin") {
          const isAdmin = userRole === "admin";
          setIsAuthorized(isAdmin);
          if (!isAdmin) {
            setAccessDeniedReason("Admin privileges required");
          }
        } else if (requiredRole === "manager") {
          // Manager includes MANAGER, HR, and ADMIN roles
          const isManager =
            userRole === "manager" || userRole === "hr" || userRole === "admin";
          setIsAuthorized(isManager);
          if (!isManager) {
            setAccessDeniedReason("Manager privileges required");
          }
        } else {
          // For "user" or no role requirement, any authenticated user can access
          setIsAuthorized(true);
        }
      } catch (error) {
        console.error("Access check failed:", error);
        setIsAuthorized(false);
        setAccessDeniedReason("Access check failed");
        router.push("/login");
      }
    };

    checkAccess();
  }, [requiredRole, router]);

  if (isAuthorized === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      fallback || (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-destructive">Access Denied</h2>
            <p className="text-muted-foreground">{accessDeniedReason}</p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}
