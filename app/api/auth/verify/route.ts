import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, addSecurityHeaders } from '@/lib/middleware'

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request)
  
  if (authResult instanceof NextResponse) {
    return addSecurityHeaders(authResult)
  }
  
  return addSecurityHeaders(
    NextResponse.json({
      success: true,
      user: {
        email: authResult.user.email,
        name: authResult.user.name,
        id: authResult.user.id,
      },
    })
  )
}


