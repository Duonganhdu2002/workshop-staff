import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'

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

// Generate logo as base64 data URL for HTML embedding
async function generateLogoBase64(): Promise<string> {
  try {
    // Try multiple possible paths
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'logo.png'),
      path.join(process.cwd(), 'logo.png'),
    ]
    
    // In production (Vercel), files are in .next/server directory
    if (process.env.VERCEL) {
      possiblePaths.unshift(path.join(process.cwd(), '.next', 'static', 'logo.png'))
    }
    
    for (const logoPath of possiblePaths) {
      try {
        if (fs.existsSync(logoPath)) {
          const logoBuffer = fs.readFileSync(logoPath)
          const base64 = logoBuffer.toString('base64')
          console.log(`Logo loaded successfully from: ${logoPath}`)
          return `data:image/png;base64,${base64}`
        }
      } catch (pathError) {
        // Continue to next path
        continue
      }
    }
    
    console.warn(`Logo file not found. Tried paths: ${possiblePaths.join(', ')}`)
    return ''
  } catch (error) {
    console.error('Error reading logo:', error)
    // Return empty string if logo not found, template will still work
    return ''
  }
}

// Generate HTML email template matching customerv2 UI design
function generateEmailHTML(name: string, qrCodeImageSrc: string, qrData: string, useCID: boolean = false, logoBase64: string = '', emailFromRequest: string = ''): string {
  // For SMTP with CID attachment, use CID reference
  // For other services, use base64 data URI
  const imgSrc = useCID ? 'cid:qrcode@workshop' : qrCodeImageSrc
  const logoSrc = logoBase64
  
  // Parse QR data to get seat number, workshop date, phone, and email
  let seatNumber: string | null = null
  let workshopDate: Date | null = null
  let formattedDate: string = '28/12/2025'
  let formattedTime: string = '14:00 - 17:00'
  let phone: string | null = null
  let emailFromQr: string | null = null
  
  try {
    const parsed = JSON.parse(qrData)
    if (parsed.seat_number) {
      seatNumber = parsed.seat_number.toString()
    }
    if (parsed.workshop_date) {
      workshopDate = new Date(parsed.workshop_date)
      if (!isNaN(workshopDate.getTime()) && workshopDate.getFullYear() > 1970) {
        const day = String(workshopDate.getDate()).padStart(2, '0')
        const month = String(workshopDate.getMonth() + 1).padStart(2, '0')
        const year = workshopDate.getFullYear()
        formattedDate = `${day}/${month}/${year}`
      }
    }
    if (parsed.phone || parsed.phone_number) {
      phone = parsed.phone || parsed.phone_number
    }
    if (parsed.email) {
      emailFromQr = parsed.email
    }
  } catch (e) {
    // Ignore parsing errors
  }
  
  // Use email from request body as fallback if not in qrData
  if (!emailFromQr && emailFromRequest) {
    emailFromQr = emailFromRequest
  }
  
  // Get workshop location and time from environment or use defaults
  const workshopLocation = process.env.WORKSHOP_LOCATION || 'Vibas Coffee - Tầng 1 - 67 Trần Quốc Hoàn, Tân Bình'
  const workshopTime = process.env.WORKSHOP_TIME || '14:00 - 17:00'
  const googleMapsLink = 'https://maps.app.goo.gl/A7od1uNSEMjRN9KY8'
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác nhận đăng ký Workshop</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px 24px; border-bottom: 1px solid #e5e7eb;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #000000; letter-spacing: -0.5px;">
                Xác nhận đăng ký thành công
              </h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280; font-weight: 400;">
                Workshop "Người Việt Healthy Theo Kiểu Việt"
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 24px; background-color: #ffffff;">
              <!-- Greeting -->
              <p style="margin: 0 0 20px 0; font-size: 18px; color: #111827; font-weight: 600;">
                Xin chào <strong style="color: #000000;">${escapeHtml(name)}</strong>
              </p>
              
              <!-- Confirmation Text -->
              <p style="margin: 0 0 32px 0; font-size: 16px; color: #4b5563; line-height: 1.7;">
                Tây Nguyên Food - Việt Nam cảm ơn bạn đã đăng ký tham gia workshop. Vui lòng sử dụng mã QR dưới đây để check-in khi đến sự kiện.
              </p>
              
              <!-- QR Code Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 32px 0;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px;">
                      <tr>
                        <td align="center" style="padding-bottom: 16px;">
                          <p style="margin: 0; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                            Mã QR Check-in
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="background-color: #ffffff; padding: 16px;">
                          <img src="${imgSrc}" alt="QR Code" style="display: block; width: 280px; height: 280px; max-width: 100%; height: auto;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Seat Number Card -->
              ${seatNumber ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0; background-color: #000000; border-radius: 8px; padding: 20px;">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: #9ca3af; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                      Ghế ngồi của bạn
                    </p>
                    <p style="margin: 0; font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -1px;">
                      Ghế ${seatNumber}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Customer Information Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700; color: #000000;">
                      Thông tin khách hàng
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; color: #4b5563;">
                            <strong style="color: #111827; font-weight: 600;">Tên:</strong> <span style="color: #000000; font-weight: 500;">${escapeHtml(name)}</span>
                          </p>
                        </td>
                      </tr>
                      ${emailFromQr ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; color: #4b5563;">
                            <strong style="color: #111827; font-weight: 600;">Email:</strong> <a href="mailto:${escapeHtml(emailFromQr)}" style="color: #000000; text-decoration: underline; font-weight: 500;">${escapeHtml(emailFromQr)}</a>
                          </p>
                        </td>
                      </tr>
                      ` : ''}
                      ${phone ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; color: #4b5563;">
                            <strong style="color: #111827; font-weight: 600;">Số điện thoại:</strong> <span style="color: #000000; font-weight: 500;">${escapeHtml(phone)}</span>
                          </p>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Program Information Section -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0 24px 0;">
                <tr>
                  <td>
                    <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: #000000;">
                      Thông tin chương trình
                    </p>
                    
                    <!-- Detailed Information Card -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 20px 0; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #000000;">
                            Thông tin chi tiết
                          </p>
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding: 6px 0;">
                                <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.7;">
                                  <strong style="color: #111827;">Thời gian:</strong> ${workshopTime}, ngày <strong style="color: #000000;">${formattedDate}</strong>
                                </p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0;">
                                <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.7;">
                                  <strong style="color: #111827;">Địa điểm:</strong> <a href="${googleMapsLink}" style="color: #000000; text-decoration: underline; font-weight: 500;">${escapeHtml(workshopLocation)}</a>
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Participation Notes Card -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 20px 0; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #000000;">
                            Lưu ý khi tham gia chương trình
                          </p>
                          <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #4b5563; line-height: 1.8;">
                            <li style="margin-bottom: 8px;">Giá vé <strong style="color: #000000;">ĐÃ BAO GỒM</strong> nước</li>
                            <li style="margin-bottom: 8px;">Bạn vui lòng <strong style="color: #000000;">KHÔNG</strong> mang theo đồ ăn, thức uống từ bên ngoài vào</li>
                            <li style="margin-bottom: 0;">Bạn hãy đến trước thời gian diễn ra <strong style="color: #000000;">15 - 20 phút</strong> để kịp check-in</li>
                          </ul>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Instructions Card -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #000000;">
                            Hướng dẫn sử dụng
                          </p>
                          <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #4b5563; line-height: 1.8;">
                            <li style="margin-bottom: 8px;">Vui lòng <strong style="color: #000000;">lưu hoặc in</strong> mã QR này để mang theo khi tham dự</li>
                            <li style="margin-bottom: 8px;">Khi đến workshop, nhân viên sẽ quét mã QR để thực hiện check-in</li>
                            <li style="margin-bottom: 0;">Mã QR là <strong style="color: #000000;">duy nhất</strong> và chỉ dành riêng cho bạn</li>
                          </ul>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Closing Message -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0 0 0; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 15px; color: #4b5563; line-height: 1.7; text-align: center;">
                      Tây Nguyên Food - Việt Nam hy vọng bạn sẽ có trải nghiệm thật đáng nhớ!
                    </p>
                    <p style="margin: 12px 0 0 0; font-size: 14px; color: #6b7280; text-align: center;">
                      Hãy theo dõi Fanpage <strong style="color: #000000;">Tây Nguyên Food - Việt Nam</strong> để nắm bắt thông tin kịp thời về chương trình nha!
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #6b7280;">
                © ${new Date().getFullYear()} Tây Nguyên Food - Việt Nam. All rights reserved.
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
      const workshopDate = process.env.WORKSHOP_DATE || '2025-12-28'
      parsedQrData.workshop_date = workshopDate
    }

    // Regenerate QR code with updated data
    const updatedQrData = JSON.stringify(parsedQrData)

    // Generate QR code buffer and base64
    const qrCodeBuffer = await generateQRCodeBuffer(updatedQrData)
    const qrCodeBase64 = await generateQRCodeBase64(updatedQrData)

    // Get email subject
    const emailSubject = process.env.EMAIL_SUBJECT || '[TÂY NGUYÊN FOOD - VIỆT NAM] XÁC NHẬN ĐĂNG KÝ THÀNH CÔNG WORKSHOP "NGƯỜI VIỆT HEALTHY THEO KIỂU VIỆT"'

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
      // Generate logo base64
      const logoBase64 = await generateLogoBase64()
      
      // Generate email HTML based on service type
      // SMTP uses CID attachment, others use base64
      const useCID = emailService === 'smtp'
      const emailHTML = generateEmailHTML(name, qrCodeBase64, updatedQrData, useCID, logoBase64, email)

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
