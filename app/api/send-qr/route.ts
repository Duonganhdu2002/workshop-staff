import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

// Email service types
type EmailService = 'resend' | 'sendgrid' | 'smtp' | 'none'

interface RequestBody {
  registrationId: string
  email: string
  name: string
  qrData: string
}

// Get email service from environment
function getEmailService(): EmailService {
  const service = process.env.EMAIL_SERVICE
  if (service === 'resend' || service === 'sendgrid' || service === 'smtp' || service === 'none') {
    return service
  }
  return 'none' // Default to none for development
}

// Generate QR code as buffer
async function generateQRCodeBuffer(data: string): Promise<Buffer> {
  try {
    const qrCodeBuffer = await QRCode.toBuffer(data, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 400,
      margin: 2,
    })
    return qrCodeBuffer as Buffer
  } catch (error) {
    console.error('Error generating QR code:', error)
    throw new Error('Không thể tạo QR code')
  }
}

// Generate QR code as base64 data URL for HTML embedding
async function generateQRCodeBase64(data: string): Promise<string> {
  try {
    const buffer = await generateQRCodeBuffer(data)
    const base64 = buffer.toString('base64')
    return `data:image/png;base64,${base64}`
  } catch (error) {
    console.error('Error generating QR code base64:', error)
    throw new Error('Không thể tạo QR code')
  }
}

// Generate HTML email template matching customerv2 UI design
function generateEmailHTML(name: string, qrCodeImageSrc: string, qrData: string, useCID: boolean = false): string {
  // For SMTP with CID attachment, use CID reference
  // For other services, use base64 data URI
  const imgSrc = useCID ? 'cid:qrcode@workshop' : qrCodeImageSrc
  
  // Parse QR data to get seat number if available
  let seatNumber: string | null = null
  try {
    const parsed = JSON.parse(qrData)
    if (parsed.seat_number) {
      seatNumber = parsed.seat_number.toString()
    }
  } catch (e) {
    // Ignore parsing errors
  }
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã QR Code Workshop</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 24px; text-align: center; background-color: #ffffff; border-bottom: 1px solid #e5e7eb;">
              <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #000000; letter-spacing: -0.5px;">Đăng ký Workshop</h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">Mã QR Code check-in của bạn</p>
            </td>
          </tr>
          
          <!-- Success Message -->
          <tr>
            <td style="padding: 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border: 2px solid #4ade80; border-radius: 6px;">
                <tr>
                  <td style="padding: 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="28" style="vertical-align: top;">
                          <table cellpadding="0" cellspacing="0" border="0" style="width: 20px; height: 20px;">
                            <tr>
                              <td style="background-color: #16a34a; border-radius: 50%; text-align: center; vertical-align: middle; width: 20px; height: 20px; font-size: 0;">
                                <span style="color: #ffffff; font-size: 13px; font-weight: bold; line-height: 20px; font-family: Arial, sans-serif;">✓</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td style="padding-left: 12px; vertical-align: top;">
                          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #166534; line-height: 1.4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">Thanh toán đã được xác nhận!</p>
                          <p style="margin: 4px 0 0 0; font-size: 12px; color: #15803d; font-weight: 500; line-height: 1.4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">Mã QR check-in đã được gửi! Vui lòng kiểm tra email</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 0 24px 24px 24px;">
              <p style="margin: 0; font-size: 16px; color: #000000;">
                Xin chào <strong style="color: #000000;">${escapeHtml(name)}</strong>,
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 0 24px 24px 24px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">
                Cảm ơn bạn đã đăng ký tham gia workshop. Dưới đây là mã QR code của bạn để check-in tại sự kiện.
              </p>
              
              ${seatNumber ? `
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; color: #6b7280; margin-bottom: 4px;">Ghế ngồi của bạn:</p>
                <p style="margin: 0; font-size: 18px; font-weight: 600; color: #000000;">Ghế ${seatNumber}</p>
              </div>
              ` : ''}
              
              <!-- QR Code -->
              <div style="text-align: center; margin: 32px 0;">
                <div style="display: inline-block; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
                  <img src="${imgSrc}" alt="QR Code" style="display: block; width: 300px; height: 300px; max-width: 100%; height: auto; margin: 0 auto;" />
                </div>
              </div>
              
              <!-- Instructions -->
              <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-left: 4px solid #16a34a; border-radius: 6px; padding: 20px; margin-top: 24px;">
                <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #000000;">Hướng dẫn:</p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #4b5563; line-height: 1.8;">
                  <li style="margin-bottom: 8px;">Vui lòng lưu mã QR code này hoặc in ra để mang theo</li>
                  <li style="margin-bottom: 8px;">Khi đến workshop, nhân viên sẽ quét mã QR code này để check-in</li>
                  <li style="margin-bottom: 0;">Mã QR code này là duy nhất và chỉ dành cho bạn</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #374151;">
                Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi.
              </p>
              <p style="margin: 0; font-size: 14px; color: #374151;">
                Trân trọng,<br>
                <strong style="color: #000000;">Đội ngũ Workshop</strong>
              </p>
            </td>
          </tr>
          
          <!-- Auto-sent notice -->
          <tr>
            <td style="padding: 16px 24px; text-align: center; background-color: #ffffff; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Email này được gửi tự động, vui lòng không trả lời.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

// Helper function to escape HTML
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
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
        throw new Error('Package "resend" chưa được cài đặt. Chạy: npm install resend trong thư mục staff')
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
    if (error.message && error.message.includes('chưa được cài đặt')) {
      throw error
    }
    if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
      throw new Error('Package "resend" chưa được cài đặt. Chạy: npm install resend trong thư mục staff')
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
        throw new Error('Package "@sendgrid/mail" chưa được cài đặt. Chạy: npm install @sendgrid/mail trong thư mục staff')
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
    if (error.message && error.message.includes('chưa được cài đặt')) {
      throw error
    }
    if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
      throw new Error('Package "@sendgrid/mail" chưa được cài đặt. Chạy: npm install @sendgrid/mail trong thư mục staff')
    }
    throw error
  }
}

// Send email using SMTP (Nodemailer)
async function sendWithSMTP(to: string, subject: string, html: string, qrCodeBuffer: Buffer): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require('nodemailer')

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('Cấu hình SMTP chưa đầy đủ. Cần SMTP_HOST, SMTP_USER, và SMTP_PASS')
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
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      attachments: [
        {
          filename: 'qrcode.png',
          content: qrCodeBuffer,
          cid: 'qrcode@workshop', // Content ID for inline image
        },
      ],
    })
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND') {
      throw new Error('Package "nodemailer" chưa được cài đặt. Chạy: npm install nodemailer')
    }
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json()
    const { registrationId, email, name, qrData } = body

    // Validate request body
    if (!registrationId || !email || !name || !qrData) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bắt buộc' },
        { status: 400 }
      )
    }

    // Parse QR data to check and update workshop_date if needed
    let parsedQrData: any
    try {
      parsedQrData = JSON.parse(qrData)
    } catch (error) {
      return NextResponse.json(
        { error: 'Dữ liệu QR code không hợp lệ' },
        { status: 400 }
      )
    }

    // Set workshop_date if it's null or missing
    if (!parsedQrData.workshop_date) {
      const workshopDate = process.env.WORKSHOP_DATE || '2025-01-01'
      parsedQrData.workshop_date = workshopDate
    }

    // Regenerate QR code with updated data
    const updatedQrData = JSON.stringify(parsedQrData)

    // Generate QR code buffer and base64
    const qrCodeBuffer = await generateQRCodeBuffer(updatedQrData)
    const qrCodeBase64 = await generateQRCodeBase64(updatedQrData)

    // Get email subject
    const emailSubject = process.env.EMAIL_SUBJECT || 'Mã QR Code Workshop của bạn'

    // Send email based on configured service
    const emailService = getEmailService()

    if (emailService === 'none') {
      // Development mode: return QR code in response
      console.log('EMAIL_SERVICE=none: Email không được gửi. QR code được trả về trong response.')
      return NextResponse.json({
        success: true,
        message: 'Email không được gửi (EMAIL_SERVICE=none). QR code được trả về để test.',
        qrCodeDataURL: qrCodeBase64,
        qrData: updatedQrData,
      })
    }

    try {
      // Generate email HTML based on service type
      // SMTP uses CID attachment, others use base64
      const useCID = emailService === 'smtp'
      const emailHTML = generateEmailHTML(name, qrCodeBase64, updatedQrData, useCID)

      switch (emailService) {
        case 'resend':
          await sendWithResend(email, emailSubject, emailHTML)
          break
        case 'sendgrid':
          await sendWithSendGrid(email, emailSubject, emailHTML)
          break
        case 'smtp':
          await sendWithSMTP(email, emailSubject, emailHTML, qrCodeBuffer)
          break
        default:
          throw new Error(`Email service không được hỗ trợ: ${emailService}`)
      }

      return NextResponse.json({
        success: true,
        message: 'Email đã được gửi thành công',
      })
    } catch (emailError: any) {
      console.error('Error sending email:', emailError)
      return NextResponse.json(
        {
          error: emailError.message || 'Không thể gửi email',
          details: emailError.toString(),
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error in send-qr API:', error)
    return NextResponse.json(
      {
        error: error.message || 'Đã xảy ra lỗi khi xử lý yêu cầu',
      },
      { status: 500 }
    )
  }
}
