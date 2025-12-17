import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Email service types
type EmailService = 'resend' | 'sendgrid' | 'smtp' | 'none'

// Get email service from environment
function getEmailService(): EmailService {
  const service = process.env.EMAIL_SERVICE
  if (service === 'resend' || service === 'sendgrid' || service === 'smtp' || service === 'none') {
    return service
  }
  return 'none'
}

// Send email notification to staff
async function sendNotificationToStaff(expiredSeatsCount: number): Promise<void> {
  const staffEmail = process.env.STAFF_EMAIL
  if (!staffEmail || staffEmail.trim() === '') {
    console.log('STAFF_EMAIL not configured, skipping email notification')
    return
  }

  const emailService = getEmailService()
  if (emailService === 'none') {
    console.log('EMAIL_SERVICE is set to "none", skipping email notification')
    return
  }

  const subject = `Thông báo: ${expiredSeatsCount} ghế đã được tự động giải phóng`
  const html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Thông báo Tự động</h1>
          </div>
          <div class="content">
            <p>Xin chào,</p>
            <p>Hệ thống đã tự động kiểm tra và giải phóng <strong>${expiredSeatsCount}</strong> ghế đã hết hạn.</p>
            <p>Các ghế này đã được đặt lại về trạng thái "available" và có thể được chọn lại.</p>
            <p>Thời gian kiểm tra: ${new Date().toLocaleString('vi-VN')}</p>
          </div>
          <div class="footer">
            <p>Đây là email tự động từ hệ thống Workshop Staff.</p>
          </div>
        </div>
      </body>
    </html>
  `

  try {
    if (emailService === 'resend') {
      await sendWithResend(staffEmail, subject, html)
    } else if (emailService === 'sendgrid') {
      await sendWithSendGrid(staffEmail, subject, html)
    } else if (emailService === 'smtp') {
      await sendWithSMTP(staffEmail, subject, html)
    }
    console.log(`Email notification sent successfully to ${staffEmail}`)
  } catch (error: any) {
    console.error('Failed to send email notification:', error.message)
    // Don't throw - email failure shouldn't fail the entire operation
  }
}

// Send email using Resend
async function sendWithResend(to: string, subject: string, html: string): Promise<void> {
  try {
    // Use require instead of import to avoid build-time errors
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    let Resend: any
    try {
      Resend = require('resend').Resend
    } catch (requireError: any) {
      if (requireError.code === 'MODULE_NOT_FOUND') {
        console.warn('Package "resend" not installed. Skipping email.')
        return
      }
      throw requireError
    }

    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY chưa được cấu hình')
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev'
    const fromName = process.env.EMAIL_FROM_NAME || 'Workshop'

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html,
    })

    if (error) {
      throw new Error(`Resend error: ${error.message}`)
    }

    if (!data) {
      throw new Error('Không nhận được phản hồi từ Resend')
    }
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
      console.warn('Package "resend" not installed. Skipping email.')
      return
    }
    throw error
  }
}

// Send email using SendGrid
async function sendWithSendGrid(to: string, subject: string, html: string): Promise<void> {
  try {
    // Use require instead of import to avoid build-time errors
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    let sgMail: any
    try {
      sgMail = require('@sendgrid/mail')
    } catch (requireError: any) {
      if (requireError.code === 'MODULE_NOT_FOUND') {
        console.warn('Package "@sendgrid/mail" not installed. Skipping email.')
        return
      }
      throw requireError
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY || '')

    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY chưa được cấu hình')
    }

    const fromEmail = process.env.EMAIL_FROM || 'workshop@yourdomain.com'
    const fromName = process.env.EMAIL_FROM_NAME || 'Workshop'

    await sgMail.send({
      from: {
        email: fromEmail,
        name: fromName,
      },
      to,
      subject,
      html,
    })
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
      console.warn('Package "@sendgrid/mail" not installed. Skipping email.')
      return
    }
    throw error
  }
}

// Send email using SMTP (Nodemailer)
async function sendWithSMTP(to: string, subject: string, html: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require('nodemailer')

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('SMTP configuration chưa đầy đủ')
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER
    const fromName = process.env.EMAIL_FROM_NAME || 'Workshop'

    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html,
    })
  } catch (error: any) {
    throw error
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify authorization header (for cron job security)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Calculate expiration time (10 minutes ago)
    const expirationTime = new Date()
    expirationTime.setMinutes(expirationTime.getMinutes() - 10)

    // Find expired seats (status = 'selected' and selected_at < expirationTime)
    const { data: expiredSeats, error: fetchError } = await supabase
      .from('seats')
      .select('seat_number, selected_at, selected_by')
      .eq('status', 'selected')
      .lt('selected_at', expirationTime.toISOString())

    if (fetchError) {
      console.error('Error fetching expired seats:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch expired seats', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!expiredSeats || expiredSeats.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired seats found',
        expiredSeatsCount: 0,
        releasedSeats: [],
      })
    }

    // Release expired seats
    const seatNumbers = expiredSeats.map(seat => seat.seat_number)
    const { error: updateError } = await supabase
      .from('seats')
      .update({
        status: 'available',
        selected_by: null,
        selected_at: null,
        expires_at: null,
      })
      .in('seat_number', seatNumbers)

    if (updateError) {
      console.error('Error releasing expired seats:', updateError)
      return NextResponse.json(
        { error: 'Failed to release expired seats', details: updateError.message },
        { status: 500 }
      )
    }

    // Send notification to staff (non-blocking)
    sendNotificationToStaff(expiredSeats.length).catch(err => {
      console.error('Failed to send notification:', err)
    })

    return NextResponse.json({
      success: true,
      message: `Released ${expiredSeats.length} expired seat(s)`,
      expiredSeatsCount: expiredSeats.length,
      releasedSeats: seatNumbers,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error in check-expired-seats:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
