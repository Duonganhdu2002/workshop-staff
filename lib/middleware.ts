import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, JWTPayload } from './security'
import { cookies } from 'next/headers'
import crypto from 'crypto'

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5 // 5 requests per minute for login
const RATE_LIMIT_MAX_API_REQUESTS = 100 // 100 requests per minute for API

export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload
}

// Rate limiting middleware
export function rateLimit(
  maxRequests: number = RATE_LIMIT_MAX_API_REQUESTS,
  windowMs: number = RATE_LIMIT_WINDOW
) {
  return (request: NextRequest): NextResponse | null => {
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown'
    
    const key = `rate_limit_${ip}`
    const now = Date.now()
    
    // Clean up old entries
    if (rateLimitStore.size > 10000) {
      for (const [k, v] of rateLimitStore.entries()) {
        if (v.resetTime < now) {
          rateLimitStore.delete(k)
        }
      }
    }
    
    const record = rateLimitStore.get(key)
    
    if (!record || record.resetTime < now) {
      // Create new record
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      })
      return null // Continue
    }
    
    if (record.count >= maxRequests) {
      return NextResponse.json(
        { 
          error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
          retryAfter: Math.ceil((record.resetTime - now) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((record.resetTime - now) / 1000).toString(),
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': record.resetTime.toString(),
          }
        }
      )
    }
    
    // Increment count
    record.count++
    return null // Continue
  }
}

// Authentication middleware
export async function authenticateRequest(
  request: NextRequest
): Promise<{ user: JWTPayload } | NextResponse> {
  try {
    // Get token from cookie
    const cookieStore = await cookies()
    const token = cookieStore.get('staff_token')?.value
    
    if (!token) {
      return NextResponse.json(
        { error: 'Không có quyền truy cập. Vui lòng đăng nhập.' },
        { status: 401 }
      )
    }
    
    // Verify token
    const payload = verifyToken(token)
    
    if (!payload) {
      // Clear invalid token
      const response = NextResponse.json(
        { error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' },
        { status: 401 }
      )
      response.cookies.delete('staff_token')
      return response
    }
    
    return { user: payload }
  } catch (error) {
    console.error('Authentication error:', error)
    return NextResponse.json(
      { error: 'Lỗi xác thực. Vui lòng thử lại.' },
      { status: 401 }
    )
  }
}

// Combined middleware for protected API routes
export async function withAuth(
  request: NextRequest,
  handler: (request: NextRequest, user: JWTPayload) => Promise<NextResponse>
): Promise<NextResponse> {
  // Check rate limit
  const rateLimitResponse = rateLimit(RATE_LIMIT_MAX_API_REQUESTS)(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }
  
  // Authenticate
  const authResult = await authenticateRequest(request)
  if (authResult instanceof NextResponse) {
    return authResult
  }
  
  // Call handler with authenticated user
  return handler(request, authResult.user)
}

// CSRF token generation and validation
const csrfTokens = new Map<string, { token: string; expires: number }>()

export function generateCSRFToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString('hex')
  csrfTokens.set(sessionId, {
    token,
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  })
  
  // Clean up expired tokens
  for (const [id, data] of csrfTokens.entries()) {
    if (data.expires < Date.now()) {
      csrfTokens.delete(id)
    }
  }
  
  return token
}

export function validateCSRFToken(sessionId: string, token: string): boolean {
  const stored = csrfTokens.get(sessionId)
  if (!stored || stored.expires < Date.now()) {
    return false
  }
  
  return stored.token === token
}

// Security headers middleware
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent XSS attacks
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Prevent MIME type sniffing
  response.headers.set('Content-Security-Policy', 
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  )
  
  // Prevent clickjacking
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  return response
}

