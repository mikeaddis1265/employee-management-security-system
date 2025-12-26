import Link from "next/link"

export default function NotFound() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-6">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <h2 className="text-3xl font-bold">Page Not Found</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        The page you're looking for doesn't exist or has been moved. Check the URL and try again.
      </p>
      <Link
        href="/"
        className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
      >
        Back to Home
      </Link>
    </div>
  )
}
