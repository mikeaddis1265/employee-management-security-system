"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";
import emailjs from "@emailjs/browser";
import { ReCAPTCHA } from "@/components/recaptcha";

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(20),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    department: z.string().min(2, "Department must be at least 2 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

const passwordRequirements = [
  { label: "At least 8 characters", check: (pwd: string) => pwd.length >= 8 },
  {
    label: "Contains uppercase letter",
    check: (pwd: string) => /[A-Z]/.test(pwd),
  },
  {
    label: "Contains lowercase letter",
    check: (pwd: string) => /[a-z]/.test(pwd),
  },
  { label: "Contains number", check: (pwd: string) => /[0-9]/.test(pwd) },
  {
    label: "Contains special character",
    check: (pwd: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd),
  },
];

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [showMFAQR, setShowMFAQR] = useState(false);
  const [mfaData, setMfaData] = useState<{
    secret: string;
    otpauthUrl: string;
  } | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
  });

  const passwordFieldValue = watch("password");

  const sendVerificationEmail = useCallback(
    async (email: string, username: string, token: string) => {
      try {
        const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
        const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
        const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

        if (!serviceId || !templateId || !publicKey) {
          console.warn("EmailJS environment variables not configured");
          console.warn("Service ID:", serviceId ? "Set" : "Missing");
          console.warn("Template ID:", templateId ? "Set" : "Missing");
          console.warn("Public Key:", publicKey ? "Set" : "Missing");
          return false;
        }

        // Initialize EmailJS with public key
        emailjs.init(publicKey);

        const verificationUrl = `${
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        }/verify?token=${token}`;

        const templateParams = {
          to_email: email,
          to_name: username,
          verification_link: verificationUrl,
          // Common EmailJS template variable names
          user_email: email,
          user_name: username,
          verification_url: verificationUrl,
          link: verificationUrl,
        };

        console.log("Sending EmailJS email with params:", {
          serviceId,
          templateId,
          to_email: email,
          verification_url: verificationUrl,
        });

        const response = await emailjs.send(
          serviceId,
          templateId,
          templateParams
        );

        console.log("EmailJS response:", response);
        return true;
      } catch (error: any) {
        console.error("Failed to send verification email:", error);
        console.error("Error details:", {
          message: error?.message,
          text: error?.text,
          status: error?.status,
        });
        return false;
      }
    },
    []
  );

  const onSubmit = async (data: RegisterFormData) => {
    if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && !captchaToken) {
      toast.error("Please complete the reCAPTCHA");
      return;
    }

    let toastId: string | undefined;
    try {
      toastId = toast.loading("Creating account...");

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          captchaToken: captchaToken,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.errors) {
          // Handle field-specific errors from API
          Object.keys(result.errors).forEach((key) => {
            setError(key as keyof RegisterFormData, {
              type: "server",
              message: result.errors[key],
            });
          });
        }
        throw new Error(result.error || "Registration failed");
      }

      toast.dismiss(toastId);

      // Store email for MFA display
      setUserEmail(data.email);

      // Send verification email via EmailJS
      const emailSent = await sendVerificationEmail(
        data.email,
        data.username,
        result.verificationToken
      );

      if (emailSent) {
        toast.success("Verification email sent! Check your inbox.");
      } else {
        toast.error(
          "Account created, but email could not be sent. Check console for details or contact admin.",
          {
            duration: 5000,
          }
        );
        console.warn("Verification token:", result.verificationToken);
        console.warn(
          "Manual verification URL:",
          `${
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
          }/verify?token=${result.verificationToken}`
        );
      }

      // Show MFA QR code if MFA data is returned
      if (result.mfa) {
        setMfaData(result.mfa);
        setShowMFAQR(true);
      } else {
        // If no MFA, redirect to login
        toast.success("Account created successfully! Redirecting to login...");
        setTimeout(() => (window.location.href = "/login"), 2000);
      }
    } catch (error) {
      console.error("Registration error:", error);
      if (toastId) toast.dismiss(toastId);
      toast.error(
        error instanceof Error
          ? error.message
          : "Registration failed. Please try again."
      );
    }
  };

  const handleRedirectToLogin = () => {
    setShowMFAQR(false);
    toast.success("Redirecting to login...");
    setTimeout(() => (window.location.href = "/login"), 1000);
  };

  // MFA QR Code Display
  if (showMFAQR && mfaData) {
    return (
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">
            Setup Two-Factor Authentication
          </h1>
          <p className="text-muted-foreground">Secure your account with MFA</p>
        </div>

        <div className="p-6 border border-primary/30 rounded-lg bg-card space-y-6">
          <div className="text-center">
            <div className="p-4 bg-background rounded-lg inline-block">
              <QRCodeSVG
                value={mfaData.otpauthUrl}
                size={200}
                level="M"
                includeMargin
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Or enter this code manually:</p>
            <p className="font-mono text-center bg-secondary/20 p-3 rounded-lg break-all text-sm">
              {mfaData.secret}
            </p>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg space-y-1">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              Verification email sent to: {userEmail}
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Please check your inbox and click the verification link to
              activate your account.
            </p>
          </div>

          <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <span className="font-semibold">Important:</span> Save your MFA secret key in a safe place. You'll
              need it to set up your authenticator app.
            </p>
          </div>

          <button
            onClick={handleRedirectToLogin}
            className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Continue to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Create Account</h1>
        <p className="text-muted-foreground">
          Join EMS - Employee Management System
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Username */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium mb-2">
            Username
          </label>
          <input
            {...register("username")}
            id="username"
            type="text"
            placeholder="your_username"
            className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            aria-invalid={errors.username ? "true" : "false"}
          />
          {errors.username && (
            <p className="text-xs text-destructive mt-1">{errors.username.message}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email
          </label>
          <input
            {...register("email")}
            id="email"
            type="email"
            placeholder="your@email.com"
            className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            aria-invalid={errors.email ? "true" : "false"}
          />
          {errors.email && (
            <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">
            Password
          </label>
          <div className="relative">
            <input
              {...register("password")}
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              onChange={(e) => setPasswordValue(e.target.value)}
              className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors pr-10"
              aria-invalid={errors.password ? "true" : "false"}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
          )}

          {/* Password Strength Requirements */}
          {passwordValue && (
            <div className="mt-3 space-y-2 p-3 bg-muted/30 rounded-lg">
              <p className="text-xs font-medium text-foreground mb-2">
                Password requirements:
              </p>
              {passwordRequirements.map((req, i) => {
                const isMet = req.check(passwordValue);
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className={`font-bold ${isMet ? "text-green-500" : "text-muted-foreground"}`}
                    >
                      {isMet ? "Yes" : "No"}
                    </span>
                    <span
                      className={
                        isMet
                          ? "text-green-600 font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {req.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium mb-2"
          >
            Confirm Password
          </label>
          <div className="relative">
            <input
              {...register("confirmPassword")}
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors pr-10"
              aria-invalid={errors.confirmPassword ? "true" : "false"}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm"
              aria-label={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
            >
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-destructive mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Department */}
        <div>
          <label
            htmlFor="department"
            className="block text-sm font-medium mb-2"
          >
            Department
          </label>
          <input
            {...register("department")}
            id="department"
            type="text"
            placeholder="e.g., Engineering, Finance, HR"
            className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            aria-invalid={errors.department ? "true" : "false"}
          />
          {errors.department && (
            <p className="text-xs text-destructive mt-1">{errors.department.message}</p>
          )}
        </div>

        {/* Info: All new users are registered as Employees */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            New Account Information
          </p>
          <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
            Your account will be created with <strong>Employee</strong> role. Contact your administrator to request role changes (Manager, HR, or Admin).
          </p>
        </div>

        {/* reCAPTCHA */}
        {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && (
          <div>
            <ReCAPTCHA
              siteKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
              onChange={(token) => setCaptchaToken(token)}
              onError={() => {
                setCaptchaToken(null);
                toast.error("reCAPTCHA failed. Please try again.");
              }}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={
            isSubmitting ||
            (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && !captchaToken)
          }
          className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {isSubmitting ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-primary hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm"
        >
          Login
        </Link>
      </p>
    </div>
  );
}
