"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import toast from "react-hot-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"

const workingHoursSchema = z.object({
  enabled: z.boolean(),
  startHour: z.number().min(0).max(23),
  endHour: z.number().min(0).max(23),
  allowedDays: z.array(z.number()),
})

type WorkingHoursFormData = z.infer<typeof workingHoursSchema>

const DAYS = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
]

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<WorkingHoursFormData>({
    resolver: zodResolver(workingHoursSchema),
    defaultValues: {
      enabled: false,
      startHour: 9,
      endHour: 17,
      allowedDays: [1, 2, 3, 4, 5],
    },
  })

  const enabled = watch("enabled")
  const startHour = watch("startHour")
  const endHour = watch("endHour")

  // Load current settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/admin/settings/working-hours")
        const data = await response.json()

        if (data.success && data.settings) {
          setValue("enabled", data.settings.enabled)
          setValue("startHour", data.settings.startHour)
          setValue("endHour", data.settings.endHour)
          setValue("allowedDays", data.settings.allowedDays)
          setSelectedDays(data.settings.allowedDays)
        }
      } catch (error) {
        console.error("Failed to load settings:", error)
        toast.error("Failed to load settings")
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [setValue])

  const toggleDay = (dayValue: number) => {
    const newDays = selectedDays.includes(dayValue)
      ? selectedDays.filter((d) => d !== dayValue)
      : [...selectedDays, dayValue].sort((a, b) => a - b)

    setSelectedDays(newDays)
    setValue("allowedDays", newDays)
  }

  const onSubmit = async (data: WorkingHoursFormData) => {
    if (data.endHour <= data.startHour) {
      toast.error("End hour must be after start hour")
      return
    }

    if (data.allowedDays.length === 0) {
      toast.error("Please select at least one allowed day")
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/admin/settings/working-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to save settings")
      }

      toast.success("Working hours settings saved successfully")
    } catch (error: any) {
      console.error("Save settings error:", error)
      toast.error(error.message || "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const formatHour = (hour: number): string => {
    if (hour === 0) return "12:00 AM"
    if (hour < 12) return `${hour}:00 AM`
    if (hour === 12) return "12:00 PM"
    return `${hour - 12}:00 PM`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">System Settings</h1>
        <p className="text-muted-foreground">
          Configure system-wide settings and restrictions
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Working Hours Restriction</CardTitle>
              <CardDescription>
                Control when users can login to the system (Admins are exempt)
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="enabled" className="text-base font-medium">
                  Enable Working Hours Restriction
                </Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, users can only login during specified hours and days
                </p>
              </div>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={(checked) => setValue("enabled", checked)}
              />
            </div>

            {enabled && (
              <>
                {/* Time Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="startHour">Start Hour</Label>
                    <div className="relative">
                      <Input
                        id="startHour"
                        type="number"
                        min="0"
                        max="23"
                        {...register("startHour", { valueAsNumber: true })}
                        className="pr-24"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-sm text-muted-foreground">
                          {formatHour(startHour)}
                        </span>
                      </div>
                    </div>
                    {errors.startHour && (
                      <p className="text-sm text-destructive">{errors.startHour.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endHour">End Hour</Label>
                    <div className="relative">
                      <Input
                        id="endHour"
                        type="number"
                        min="0"
                        max="23"
                        {...register("endHour", { valueAsNumber: true })}
                        className="pr-24"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-sm text-muted-foreground">
                          {formatHour(endHour)}
                        </span>
                      </div>
                    </div>
                    {errors.endHour && (
                      <p className="text-sm text-destructive">{errors.endHour.message}</p>
                    )}
                  </div>
                </div>

                {/* Current Time Range Display */}
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="text-sm">
                    <span className="font-medium">Login allowed:</span>{" "}
                    <span className="text-muted-foreground">
                      {formatHour(startHour)} - {formatHour(endHour)}
                    </span>
                  </div>
                </div>

                {/* Allowed Days */}
                <div className="space-y-3">
                  <Label>Allowed Days</Label>
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS.map((day) => {
                      const isSelected = selectedDays.includes(day.value)
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          className={`
                            p-3 rounded-lg border-2 transition-all
                            ${
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background hover:border-primary/50"
                            }
                          `}
                        >
                          <div className="text-xs font-medium">{day.short}</div>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Selected days:{" "}
                    {selectedDays.length > 0
                      ? selectedDays.map((d) => DAYS[d].label).join(", ")
                      : "None"}
                  </p>
                </div>

                {/* Warning */}
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-1">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    Important Notes
                  </p>
                  <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1 list-disc pl-4">
                    <li>Admin users can always login regardless of these settings</li>
                    <li>Users trying to login outside allowed hours will see an error message</li>
                    <li>Changes take effect immediately</li>
                  </ul>
                </div>
              </>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
