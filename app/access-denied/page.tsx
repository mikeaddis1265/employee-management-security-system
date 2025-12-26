"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AccessDeniedPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const reason = searchParams.get("reason");
  const attemptedPath = searchParams.get("attempted");

  useEffect(() => {
    setMounted(true);
  }, []);

  const messages: Record<string, { title: string; description: string; required: string }> = {
    admin_only: {
      title: "Admin Access Required",
      description: "This page is restricted to administrators only.",
      required: "ADMIN role required",
    },
    hr_only: {
      title: "HR Access Required",
      description: "This page is restricted to HR and Admin users only.",
      required: "HR or ADMIN role required",
    },
    manager_only: {
      title: "Manager Access Required",
      description: "This page is restricted to Managers, HR, and Admin users.",
      required: "MANAGER, HR, or ADMIN role required",
    },
  };

  const currentMessage = reason && messages[reason]
    ? messages[reason]
    : {
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        required: "Insufficient permissions",
      };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="max-w-md w-full">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 space-y-6">
          {/* Content */}
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-bold text-destructive">
              {currentMessage.title}
            </h1>
            <p className="text-muted-foreground text-base">
              {currentMessage.description}
            </p>

            {attemptedPath && (
              <div className="bg-muted/50 border border-border rounded-lg p-4 mt-4">
                <p className="text-sm font-medium text-foreground mb-2">
                  Attempted to access:
                </p>
                <code className="text-sm text-primary font-mono bg-background px-3 py-1 rounded border border-border">
                  {attemptedPath}
                </code>
              </div>
            )}

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mt-4">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {currentMessage.required}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-4">
            <button
              onClick={() => router.back()}
              className="w-full px-4 py-3 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg font-medium transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
            >
              Go to Dashboard
            </button>
          </div>

          {/* Help Text */}
          <p className="text-xs text-center text-muted-foreground pt-4 border-t border-border">
            If you believe you should have access to this page, please contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
