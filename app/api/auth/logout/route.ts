import { NextRequest, NextResponse } from 'next/server'
import { addSecurityHeaders } from '@/lib/middleware'

export async function POST(request: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: 'Đăng xuất thành công',
  })

  // Clear authentication cookies
  response.cookies.delete('staff_token')
  response.cookies.delete('csrf_token')

  return addSecurityHeaders(response)
}


