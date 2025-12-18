import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, addSecurityHeaders } from '@/lib/middleware'

/**
 * API route to decrypt data server-side
 * This is needed because ENCRYPTION_KEY is only available server-side
 * Supports both single string and batch decryption
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request)
    if (authResult instanceof NextResponse) {
      return addSecurityHeaders(authResult)
    }

    const body = await request.json()
    const { data, fields } = body

    // Import decryption function (server-side only)
    const { safeDecrypt } = await import('@/lib/security')
    
    try {
      // Batch decryption: decrypt multiple fields at once
      if (fields && Array.isArray(fields)) {
        const decryptedFields: Record<string, string> = {}
        const uniqueFields = [...new Set(fields.filter((f: any) => f && typeof f === 'string'))]
        
        for (const field of uniqueFields) {
          try {
            decryptedFields[field] = safeDecrypt(field)
          } catch (error) {
            // If decryption fails, keep original value
            decryptedFields[field] = field
          }
        }
        return addSecurityHeaders(
          NextResponse.json({ decrypted: decryptedFields })
        )
      }
      
      // Single string decryption
      if (data && typeof data === 'string') {
        const decrypted = safeDecrypt(data)
        return addSecurityHeaders(
          NextResponse.json({ decrypted })
        )
      }
      
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Invalid data format. Provide either "data" (string) or "fields" (array)' },
          { status: 400 }
        )
      )
    } catch (error: any) {
      console.error('Decryption error:', error)
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Failed to decrypt data', decrypted: data || fields },
          { status: 500 }
        )
      )
    }
  } catch (error: any) {
    console.error('Error in decrypt API:', error)
    return addSecurityHeaders(
      NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    )
  }
}

