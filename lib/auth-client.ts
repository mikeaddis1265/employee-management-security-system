'use server'

import { getCurrentUser } from './auth'

export async function getAuthStatus() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { authenticated: false }
    }
    return {
      authenticated: true,
      user: {
        username: user.username,
        role: user.role,
        department: user.department,
      },
    }
  } catch (error) {
    return { authenticated: false }
  }
}
