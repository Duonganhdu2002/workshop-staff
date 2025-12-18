import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, generateCSRFToken, addSecurityHeaders } from '@/lib/middleware'

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request)
  
  if (authResult instanceof NextResponse) {
    return addSecurityHeaders(authResult)
  }
  
  // Generate CSRF token for authenticated user
  const csrfToken = generateCSRFToken(authResult.user.id)
  
  // Also set in httpOnly cookie
  const response = NextResponse.json({
    success: true,
    csrfToken,
  })
  
  const isProduction = process.env.NODE_ENV === 'production'
  response.cookies.set('csrf_token', csrfToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 60 * 60, // 1 hour
    path: '/',
  })
  
  return addSecurityHeaders(response)
}


