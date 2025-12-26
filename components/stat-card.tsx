interface StatCardProps {
  label: string
  value: string
  trend: string
  trendUp: boolean
}

export default function StatCard({ label, value, trend, trendUp }: StatCardProps) {
  return (
    <div className="p-6 border border-border rounded-lg bg-card hover:border-primary transition-colors">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold">{value}</p>
      </div>
      <div className={`mt-4 text-sm font-medium ${trendUp ? "text-green-600" : "text-destructive"}`}>
        {trend} this month
      </div>
    </div>
  )
}
