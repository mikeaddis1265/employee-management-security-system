"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getAuthStatus } from "@/lib/auth-client";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    async function checkAuth() {
      const status = await getAuthStatus();
      setIsAuthenticated(status.authenticated);
      if (status.authenticated && status.user) {
        setUserRole(status.user.role.toLowerCase());
        setUsername(status.user.username);
      }
    }
    checkAuth();
  }, []);

  const navLinks = [
    {
      href: "/dashboard",
      label: "Dashboard",
      requiresAuth: true,
      allowedRoles: ["employee", "manager", "hr", "admin"]
    },
    {
      href: "/resources",
      label: "Resources",
      requiresAuth: true,
      allowedRoles: ["employee", "manager", "hr", "admin"]
    },
    {
      href: "/leave",
      label: "Leave",
      requiresAuth: true,
      allowedRoles: ["employee", "manager", "hr", "admin"]
    },
    {
      href: "/employees",
      label: "Employees",
      requiresAuth: true,
      allowedRoles: ["hr", "admin"]
    },
    {
      href: "/payroll",
      label: "Payroll",
      requiresAuth: true,
      allowedRoles: ["hr", "admin"]
    },
    {
      href: "/logs",
      label: "Logs",
      requiresAuth: true,
      allowedRoles: ["admin"]
    },
    {
      href: "/admin",
      label: "Admin",
      requiresAuth: true,
      allowedRoles: ["admin"]
    },
    {
      href: "/admin/settings",
      label: "Settings",
      requiresAuth: true,
      allowedRoles: ["admin"]
    },
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setIsAuthenticated(false);
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const visibleLinks = navLinks.filter((link) => {
    if (link.requiresAuth && !isAuthenticated) return false;
    if (link.allowedRoles && !link.allowedRoles.includes(userRole)) return false;
    return true;
  });

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span className="font-bold text-xl text-primary">
              EMS
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-foreground hover:text-primary transition-colors relative group"
              >
                {link.label}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all" />
              </Link>
            ))}
          </div>

          {/* Desktop Auth Controls */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated && (
              <>
                <Link
                  href="/profile"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium text-muted-foreground hover:text-destructive transition-colors"
                >
                  Logout
                </button>
              </>
            )}
            {!isAuthenticated && (
              <Link
                href="/login"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden px-3 py-2 text-sm font-medium hover:bg-secondary/50 rounded-lg transition-colors"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? "Close" : "Menu"}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border py-4 space-y-3 animate-in fade-in slide-in-from-top-2">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/50 rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            {isAuthenticated && (
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              >
                Logout
              </button>
            )}
            {!isAuthenticated && (
              <Link
                href="/login"
                className="block px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Login
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
