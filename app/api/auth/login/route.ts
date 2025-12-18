import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { 
  rateLimit, 
  addSecurityHeaders,
  generateCSRFToken 
} from '@/lib/middleware'
import { 
  sanitizeEmail, 
  isValidEmail, 
  comparePassword,
  generateToken 
} from '@/lib/security'

const LOGIN_RATE_LIMIT = 5 // 5 attempts per minute

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = rateLimit(LOGIN_RATE_LIMIT, 60 * 1000)(request)
    if (rateLimitResponse) {
      return addSecurityHeaders(rateLimitResponse)
    }

    // Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Dữ liệu yêu cầu không hợp lệ.' },
          { status: 400 }
        )
      )
    }

    const { email, password } = body

    // Validate required fields
    if (!email || !password) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Email và mật khẩu là bắt buộc' },
          { status: 400 }
        )
      )
    }

    // Sanitize and validate email
    const sanitizedEmail = sanitizeEmail(email)
    if (!isValidEmail(sanitizedEmail)) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Email không hợp lệ.' },
          { status: 400 }
        )
      )
    }

    // Validate password length (prevent DoS)
    if (password.length > 128 || password.length < 1) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Email hoặc mật khẩu không đúng.' },
          { status: 401 }
        )
      )
    }

    // Get Supabase credentials
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase configuration missing')
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Cấu hình hệ thống chưa đầy đủ. Vui lòng liên hệ quản trị viên.' },
          { status: 500 }
        )
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Check staff in database
    const { data: staff, error: queryError } = await supabase
      .from('staff')
      .select('id, email, password, name, is_active')
      .eq('email', sanitizedEmail)
      .eq('is_active', true)
      .single()

    // Always return same error message to prevent user enumeration
    if (queryError || !staff) {
      // Log failed attempt for security monitoring
      console.warn(`Failed login attempt for email: ${sanitizedEmail}`)
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Email hoặc mật khẩu không đúng.' },
          { status: 401 }
        )
      )
    }

    // Check password (support both hashed and plain text for migration)
    let passwordValid = false
    try {
      // Try comparing with bcrypt hash first
      if (staff.password.startsWith('$2a$') || staff.password.startsWith('$2b$')) {
        passwordValid = await comparePassword(password, staff.password)
      } else {
        // Fallback to plain text comparison (for migration period)
        // In production, remove this after all passwords are migrated
        passwordValid = password === staff.password
        // If plain text matches, hash it and update database
        if (passwordValid) {
          const { hashPassword } = await import('@/lib/security')
          const hashedPassword = await hashPassword(password)
          await supabase
            .from('staff')
            .update({ password: hashedPassword })
            .eq('id', staff.id)
          console.log(`Migrated password for user: ${staff.email}`)
        }
      }
    } catch (compareError) {
      console.error('Password comparison error:', compareError)
      passwordValid = false
    }

    if (!passwordValid) {
      console.warn(`Failed login attempt for email: ${sanitizedEmail}`)
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Email hoặc mật khẩu không đúng.' },
          { status: 401 }
        )
      )
    }

    // Update last_login_at
    await supabase
      .from('staff')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', staff.id)

    // Generate JWT token
    const token = generateToken({
      email: staff.email,
      id: staff.id,
      name: staff.name || undefined,
    })

    // Generate CSRF token
    const csrfToken = generateCSRFToken(staff.id)

    // Create response with httpOnly cookie
    const response = NextResponse.json({
      success: true,
      user: {
        email: staff.email,
        name: staff.name,
        id: staff.id,
      },
      csrfToken, // Return CSRF token to client
    })

    // Set secure httpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production'
    response.cookies.set('staff_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })

    // Set CSRF token in httpOnly cookie
    response.cookies.set('csrf_token', csrfToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 60 * 60, // 1 hour
      path: '/',
    })

    return addSecurityHeaders(response)
  } catch (error: any) {
    console.error('Login error:', error)
    // Don't expose internal error details
    return addSecurityHeaders(
      NextResponse.json(
        { error: 'Đăng nhập thất bại. Vui lòng thử lại sau.' },
        { status: 500 }
      )
    )
  }
}

