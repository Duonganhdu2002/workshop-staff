import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email và mật khẩu là bắt buộc' },
        { status: 400 }
      )
    }

    // Get Supabase credentials
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Cấu hình Supabase chưa đầy đủ. Vui lòng liên hệ quản trị viên.' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const emailLower = email.trim().toLowerCase()

    // Check staff in database
    const { data: staff, error: queryError } = await supabase
      .from('staff')
      .select('id, email, password, name, is_active')
      .eq('email', emailLower)
      .eq('is_active', true)
      .single()

    if (queryError || !staff) {
      return NextResponse.json(
        { error: 'Email hoặc mật khẩu không đúng.' },
        { status: 401 }
      )
    }

    // Check password
    if (password !== staff.password) {
      return NextResponse.json(
        { error: 'Email hoặc mật khẩu không đúng.' },
        { status: 401 }
      )
    }

    // Update last_login_at
    await supabase
      .from('staff')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', staff.id)

    // Return success with session data
    const sessionData = {
      email: staff.email,
      name: staff.name,
      id: staff.id,
      loginTime: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      session: sessionData
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: error.message || 'Đăng nhập thất bại. Vui lòng thử lại.' },
      { status: 500 }
    )
  }
}

