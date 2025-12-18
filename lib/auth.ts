'use client'

export interface StaffSession {
  email: string
  name?: string
  id?: string
}

// Check authentication status via API
export const isStaffAuthenticated = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/auth/verify', {
      method: 'GET',
      credentials: 'include', // Include cookies
    })
    return response.ok
  } catch {
    return false
  }
}

// Get current user session
export const getStaffSession = async (): Promise<StaffSession | null> => {
  try {
    const response = await fetch('/api/auth/verify', {
      method: 'GET',
      credentials: 'include',
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return data.user || null
  } catch {
    return null
  }
}

// Logout function
export const logoutStaff = async (): Promise<void> => {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
  } catch (error) {
    console.error('Logout error:', error)
  }
  
  // Clear any client-side storage as fallback
  if (typeof window !== 'undefined') {
    localStorage.removeItem('staff_session')
    sessionStorage.clear()
  }
}

// Get staff email (synchronous version for backward compatibility)
export const getStaffEmail = (): string | null => {
  // This is now async, but keeping sync version for compatibility
  // Components should use getStaffSession() instead
  return null
}

// Get staff email async
export const getStaffEmailAsync = async (): Promise<string | null> => {
  const session = await getStaffSession()
  return session?.email || null
}
