'use client'

export interface StaffSession {
  email: string
  name?: string
  id?: string
  loginTime: string
}

export const getStaffSession = (): StaffSession | null => {
  if (typeof window === 'undefined') return null
  
  try {
    const session = localStorage.getItem('staff_session')
    if (!session) return null
    
    const sessionData: StaffSession = JSON.parse(session)
    
    // Check if session is valid (not expired - 24 hours)
    const loginTime = new Date(sessionData.loginTime)
    const now = new Date()
    const hoursDiff = (now.getTime() - loginTime.getTime()) / (1000 * 60 * 60)
    
    if (hoursDiff > 24) {
      localStorage.removeItem('staff_session')
      return null
    }
    
    return sessionData
  } catch {
    return null
  }
}

export const isStaffAuthenticated = (): boolean => {
  return getStaffSession() !== null
}

export const logoutStaff = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('staff_session')
  }
}

export const getStaffEmail = (): string | null => {
  const session = getStaffSession()
  return session?.email || null
}
