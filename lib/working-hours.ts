import { prisma } from './prisma'

export interface WorkingHoursSettings {
  enabled: boolean
  startHour: number
  endHour: number
  allowedDays: number[] // 0 = Sunday, 6 = Saturday
}

/**
 * Get working hours settings from database
 */
export async function getWorkingHoursSettings(): Promise<WorkingHoursSettings> {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { key: 'working_hours' },
    })

    if (!settings) {
      // Default: disabled, 9 AM - 5 PM, Monday-Friday
      return {
        enabled: false,
        startHour: 9,
        endHour: 17,
        allowedDays: [1, 2, 3, 4, 5],
      }
    }

    return settings.value as WorkingHoursSettings
  } catch (error) {
    console.error('Failed to get working hours settings:', error)
    // Return default on error
    return {
      enabled: false,
      startHour: 9,
      endHour: 17,
      allowedDays: [1, 2, 3, 4, 5],
    }
  }
}

/**
 * Check if the current time is within working hours
 * @param userRole - User's role (ADMIN users bypass this check)
 * @returns Object with allowed status and reason if denied
 */
export async function checkWorkingHours(
  userRole: string
): Promise<{ allowed: boolean; reason?: string; settings?: WorkingHoursSettings }> {
  // Admin users can always login
  if (userRole === 'ADMIN') {
    return { allowed: true }
  }

  const settings = await getWorkingHoursSettings()

  // If working hours restriction is disabled, allow access
  if (!settings.enabled) {
    return { allowed: true, settings }
  }

  const now = new Date()
  const currentHour = now.getHours()
  const currentDay = now.getDay() // 0 = Sunday, 6 = Saturday

  // Check if current day is allowed
  if (!settings.allowedDays.includes(currentDay)) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return {
      allowed: false,
      reason: `Login is not allowed on ${dayNames[currentDay]}. Allowed days: ${settings.allowedDays
        .map((d) => dayNames[d])
        .join(', ')}`,
      settings,
    }
  }

  // Check if current hour is within allowed range
  if (currentHour < settings.startHour || currentHour >= settings.endHour) {
    return {
      allowed: false,
      reason: `Login is only allowed between ${formatHour(settings.startHour)} and ${formatHour(
        settings.endHour
      )}. Current time: ${formatHour(currentHour)}`,
      settings,
    }
  }

  return { allowed: true, settings }
}

/**
 * Format hour in 12-hour format
 */
function formatHour(hour: number): string {
  if (hour === 0) return '12:00 AM'
  if (hour < 12) return `${hour}:00 AM`
  if (hour === 12) return '12:00 PM'
  return `${hour - 12}:00 PM`
}
