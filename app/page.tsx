"use client"

import Link from "next/link"

export default function LandingPage() {
  return (
    <div className="space-y-0">
      {/* Hero Section */}
      <section className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 bg-gradient-to-br from-primary/5 via-background to-secondary/20">
        <div className="max-w-4xl mx-auto text-center space-y-8 py-20">
          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl font-bold text-balance">
              Enterprise <span className="text-primary">Employee</span> Management
            </h1>
            <p className="text-xl text-muted-foreground text-balance">
              Secure, role-based access control system for modern organizations
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/register"
              className="px-8 py-3 border border-primary text-primary rounded-lg font-medium hover:bg-primary/5 transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-card">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">Key Features</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Role-Based Access",
                desc: "Fine-grained permissions and role hierarchy",
              },
              {
                title: "User Management",
                desc: "Efficient employee and team administration",
              },
              {
                title: "MFA Security",
                desc: "Multi-factor authentication with QR codes",
              },
              {
                title: "Analytics Dashboard",
                desc: "Real-time insights and performance metrics",
              },
              {
                title: "Fast Performance",
                desc: "Optimized for speed and reliability",
              },
              {
                title: "Activity Logs",
                desc: "Comprehensive audit trail for compliance",
              },
            ].map((feature, i) => (
              <div key={i} className="p-6 border border-border rounded-lg hover:border-primary transition-colors">
                <h3 className="font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary/10 to-accent/10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl font-bold">Ready to Secure Your Organization?</h2>
          <Link
            href="/register"
            className="inline-block px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Start Now
          </Link>
        </div>
      </section>
    </div>
  )
}
