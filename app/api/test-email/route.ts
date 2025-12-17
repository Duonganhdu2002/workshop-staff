import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'

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

// Generate logo as base64 data URL for HTML embedding
async function generateLogoBase64(): Promise<string> {
  try {
    // Try multiple possible paths
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'logo.svg'),
      path.join(process.cwd(), 'logo.svg'),
    ]

    // In production (Vercel), files are in .next/server directory
    if (process.env.VERCEL) {
      possiblePaths.unshift(path.join(process.cwd(), '.next', 'static', 'logo.svg'))
    }

    for (const logoPath of possiblePaths) {
      try {
        if (fs.existsSync(logoPath)) {
          // Read SVG as text and encode as base64
          const logoSvg = fs.readFileSync(logoPath, 'utf-8')
          const base64 = Buffer.from(logoSvg).toString('base64')
          console.log(`Logo loaded successfully from: ${logoPath}`)
          return `data:image/svg+xml;base64,${base64}`
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

// Generate HTML email template
function generateEmailHTML(name: string, qrCodeImageSrc: string, qrData: string, logoBase64: string = ''): string {
  const imgSrc = qrCodeImageSrc
  const logoSrc = logoBase64

  // Parse QR data to get seat number, workshop date, phone, and email
  let seatNumber: string | null = null
  let workshopDate: Date | null = null
  let formattedDate: string = '28/12/2025'
  let formattedTime: string = '14:00 - 17:00'
  let phone: string | null = null
  let email: string | null = null

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
      email = parsed.email
    }
  } catch (e) {
    // Ignore parsing errors
  }

  // Get workshop location and time from environment or use defaults
  const workshopLocation = process.env.WORKSHOP_LOCATION || 'Vibas Coffee - Tầng 1 - 67 Trần Quốc Hoàn, Tân Bình'
  const workshopTime = process.env.WORKSHOP_TIME || '14:00 - 17:00'
  const googleMapsLink = 'https://maps.app.goo.gl/A7od1uNSEMjRN9KY8'

  // Get registration ID for ticket number - use first part of UUID
  let registrationId = 'TNF-' + Date.now()
  try {
    const parsed = JSON.parse(qrData)
    // Try to get UUID from registration_id or id field
    const uuid = parsed.registration_id || parsed.id
    if (uuid && typeof uuid === 'string') {
      // Extract first part of UUID (before first hyphen)
      const uuidParts = uuid.split('-')
      if (uuidParts.length > 0) {
        registrationId = uuidParts[0].toUpperCase()
      } else {
        registrationId = uuid.substring(0, 8).toUpperCase()
      }
    }
  } catch (e) {
    // Use default
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vé Workshop - Tây Nguyên Food</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: transparent;">
    <tr>
      <td align="center" style="padding: 0;">
        <!-- Email Header Message -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 0;">
          <tr>
            <td style="padding: 16px; background-color: #ffffff;">
              <p style="margin: 0 0 8px 0; font-size: 16px; color: #000000;">
                Xin chào <strong style="color: #000000;">${escapeHtml(name)}</strong>,
              </p>
              <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">
                Cảm ơn bạn đã đăng ký tham gia workshop. Vui lòng lưu hoặc in vé điện tử dưới đây để mang theo khi đến sự kiện.
              </p>
            </td>
          </tr>
        </table>
        
        <!-- TICKET -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; overflow: hidden; position: relative;">
          <!-- Ticket Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 24px; text-align: center; position: relative;">
              ${logoSrc ? `
              <img src="${logoSrc}" alt="Tây Nguyên Food - Việt Nam" style="width: 100%; max-width: 100%; height: auto; display: block; margin: 0 auto 12px auto; filter: brightness(0) invert(1);" />
              ` : ''}
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">
                VÉ WORKSHOP
              </h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; color: #bbf7d0; font-weight: 500;">
                Tây Nguyên Food - Việt Nam
              </p>
            </td>
          </tr>
          
          <!-- Perforated Edge (Dashed line separator) -->
          <tr>
            <td style="padding: 0; height: 0; border-top: 2px dashed #d1d5db; position: relative;">
              <div style="position: absolute; left: -8px; top: -6px; width: 12px; height: 12px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 50%;"></div>
              <div style="position: absolute; right: -8px; top: -6px; width: 12px; height: 12px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 50%;"></div>
            </td>
          </tr>
          
          <!-- Ticket Body -->
          <tr>
            <td style="padding: 24px;">
              <!-- Ticket Info Section -->
              <div style="display: flex; flex-direction: row; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 24px;">
                <!-- Ticket Number (Left) -->
                <div style="flex: 1;">
                  <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Mã vé</p>
                  <p style="margin: 0; font-size: 18px; font-weight: 700; color: #16a34a; font-family: 'Courier New', monospace;">${registrationId}</p>
                </div>
                
                <!-- Seat Number (Right) -->
                ${seatNumber ? `
                <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px; border-radius: 4px; display: flex; flex-direction: column; align-items: flex-end; text-align: right; flex: 1;">
                  <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Ghế ngồi</p>
                  <p style="margin: 0; font-size: 28px; font-weight: 700; color: #16a34a;">${seatNumber}</p>
                </div>
                ` : ''}
              </div>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                
                <!-- Event Details -->
                <tr>
                  <td style="padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Thời gian</p>
                    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #000000;">${workshopTime}</p>
                    <p style="margin: 4px 0 0 0; font-size: 14px; color: #374151;">${formattedDate}</p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Địa điểm</p>
                    <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.5;">
                      <a href="${googleMapsLink}" style="color: #2563eb; text-decoration: none; font-weight: 500;">${escapeHtml(workshopLocation)}</a>
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding-top: 16px;">
                    <p style="margin: 0 0 8px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Người tham gia</p>
                    <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #000000;">${escapeHtml(name)}</p>
                    ${phone ? `<p style="margin: 0 0 4px 0; font-size: 13px; color: #374151;">SĐT: ${escapeHtml(phone)}</p>` : ''}
                    ${email ? `<p style="margin: 0; font-size: 13px; color: #374151;">Email: <a href="mailto:${escapeHtml(email)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(email)}</a></p>` : ''}
                  </td>
                </tr>
              </table>
              
             
              
              <!-- QR Code Section -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 12px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Mã QR Check-in</p>
                    <table cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px; margin: 0 auto;">
                      <tr>
                        <td align="center">
                          <img src="${imgSrc}" alt="QR Code" style="display: block; width: 200px; height: 200px; max-width: 100%; object-fit: contain;" />
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 12px 0 0 0; font-size: 10px; color: #9ca3af; line-height: 1.4;">
                      Vui lòng trình mã QR này<br/>khi đến sự kiện
                    </p>
                  </td>
                </tr>
              </table>

               <!-- Important Notes -->
              <div style="margin: 24px 0; padding: 20px; background-color: #f0fdf4; border-radius: 8px;">
                <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 600; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Lưu ý</p>
                <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #14532d; line-height: 1.6;">
                  <li style="margin-bottom: 6px;">Giá vé <strong>ĐÃ BAO GỒM</strong> nước</li>
                  <li style="margin-bottom: 6px;"><strong>KHÔNG</strong> mang theo đồ ăn, thức uống từ bên ngoài</li>
                  <li style="margin-bottom: 0;">Đến trước 15-20 phút để kịp check-in</li>
                </ul>
              </div>

              
            </td>
          </tr>
          
          <!-- Perforated Edge (Bottom) -->
          <tr>
            <td style="padding: 0; height: 0; border-top: 2px dashed #d1d5db; position: relative;">
              <div style="position: absolute; left: -8px; top: -6px; width: 12px; height: 12px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 50%;"></div>
              <div style="position: absolute; right: -8px; top: -6px; width: 12px; height: 12px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 50%;"></div>
            </td>
          </tr>
        </table>
        
        <!-- Footer Message -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 0;">
        <!-- Perforated Edge (Dashed line separator) -->
          <tr>
            <td style="padding: 0; height: 0; border-top: 2px dashed #d1d5db; position: relative;">
              <div style="position: absolute; left: -8px; top: -6px; width: 12px; height: 12px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 50%;"></div>
              <div style="position: absolute; right: -8px; top: -6px; width: 12px; height: 12px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 50%;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px; text-align: center; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);">
              ${logoSrc ? `
              <img src="${logoSrc}" alt="Tây Nguyên Food - Việt Nam" style="max-width: 400px; width: 100%; height: auto; display: block; margin: 0 auto 16px auto; filter: brightness(0) invert(1);" />
              ` : ''}
              <p style="margin: 0 0 20px 0; font-size: 12px; color: #ffffff; line-height: 1.6; font-style: italic;">
                Chúng mình hy vọng bạn sẽ có trải nghiệm thật đáng nhớ!<br/>
              </p>
              
              <!-- Contact Information -->
              <div style="display: flex; flex-direction: row; justify-content: space-between; align-items: flex-start; gap: 24px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.3);">
                <!-- Left Column -->
                <div style="flex: 1; text-align: left;">
                  <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #ffffff;">Tây Nguyên Food - Việt Nam</p>
                  <p style="margin: 0; font-size: 12px; color: #ffffff;">Phòng marketing</p>
                </div>
                
                <!-- Right Column -->
                <div style="flex: 1; text-align: right;">
                  <p style="margin: 0 0 4px 0; font-size: 12px; color: #ffffff;">
                    <a href="mailto:pmkt.taynguyenfood@gmail.com" style="color: #ffffff; text-decoration: underline;">pmkt.taynguyenfood@gmail.com</a>
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #ffffff;">G43, Lê Thị Riêng, Thới An, Quận 12, Tp.HCM</p>
                </div>
              </div>
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

export async function GET() {
  try {
    // Generate test QR code
    const testQrData = JSON.stringify({
      registration_id: 'test-123',
      name: 'Nguyễn Văn A',
      email: 'test@example.com',
      phone: '0901234567',
      seat_number: 15,
      workshop_date: '2025-12-28'
    })

    const qrCodeBase64 = await QRCode.toDataURL(testQrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 200,
      margin: 2,
    })

    // Generate logo base64
    const logoBase64 = await generateLogoBase64()

    // Generate email HTML with test data
    const emailHTML = generateEmailHTML(
      'Nguyễn Văn A',
      qrCodeBase64,
      testQrData,
      logoBase64
    )

    return NextResponse.json({
      html: emailHTML,
      success: true
    })
  } catch (error: any) {
    console.error('Error generating test email:', error)
    return NextResponse.json(
      {
        error: error.message || 'Không thể tạo email test',
        details: error.toString(),
      },
      { status: 500 }
    )
  }
}

