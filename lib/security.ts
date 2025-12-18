import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'default-secret-change-in-production'
const JWT_EXPIRES_IN = '24h'
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')
const ENCRYPTION_ALGORITHM = 'aes-256-gcm'

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

// JWT Token management
export interface JWTPayload {
  email: string
  id: string
  name?: string
  iat?: number
  exp?: number
}

export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    return decoded
  } catch (error) {
    return null
  }
}

// Data encryption/decryption
export function encryptData(text: string): string {
  try {
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    // Return iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

export function decryptData(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format')
    }
    
    const [ivHex, authTagHex, encrypted] = parts
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

// Helper function to check if data is encrypted
// Supports two formats:
// 1. Staff format: iv:authTag:encrypted (3 parts)
// 2. User format: salt:iv:tag:encryptedData (4 parts)
export function isEncrypted(data: string): boolean {
  if (!data || typeof data !== 'string') {
    return false
  }
  const parts = data.split(':')
  const hexPattern = /^[0-9a-f]+$/i
  
  // Check for staff format (3 parts)
  if (parts.length === 3) {
    return parts.every(part => hexPattern.test(part) && part.length > 0)
  }
  
  // Check for user format (4 parts)
  if (parts.length === 4) {
    return parts.every(part => hexPattern.test(part) && part.length > 0)
  }
  
  return false
}

/**
 * Decrypt data in user format: salt:iv:tag:encryptedData
 * Uses PBKDF2 with salt to derive key (same as workshop-user)
 */
function decryptUserFormat(encryptedData: string): string {
  const ALGORITHM = 'aes-256-gcm'
  const IV_LENGTH = 16 // 128 bits
  const SALT_LENGTH = 64 // 512 bits
  const KEY_LENGTH = 32 // 256 bits
  const ITERATIONS = 100000 // PBKDF2 iterations
  
  // Get encryption key (same as user system)
  function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY || process.env.NEXT_PUBLIC_ENCRYPTION_KEY
    
    if (!key) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ENCRYPTION_KEY environment variable is required in production')
      }
      // Development fallback - MUST be changed in production
      console.warn('⚠️  WARNING: Using default encryption key. Set ENCRYPTION_KEY in production!')
      return crypto.scryptSync('default-dev-key-change-in-production', 'salt', KEY_LENGTH)
    }
    
    // If key is provided as hex string, convert it
    if (key.length === 64) {
      return Buffer.from(key, 'hex')
    }
    
    // Otherwise derive key from the provided string
    return crypto.scryptSync(key, 'encryption-salt', KEY_LENGTH)
  }
  
  // Derive a key from the master key using PBKDF2
  function deriveKey(masterKey: Buffer, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha512')
  }
  
  const masterKey = getEncryptionKey()
  
  // Split the encrypted data
  const parts = encryptedData.split(':')
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format')
  }
  
  const [saltHex, ivHex, tagHex, encrypted] = parts
  
  // Convert hex strings back to buffers
  const salt = Buffer.from(saltHex, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  
  // Derive the same key using the salt
  const key = deriveKey(masterKey, salt)
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  
  // Decrypt the data
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

// Safe decrypt - returns original value if decryption fails or data is not encrypted
// Supports both staff format (3 parts) and user format (4 parts)
// Works on both client and server side
// Note: On client-side, this will try to decrypt directly if ENCRYPTION_KEY is available
// Otherwise, use safeDecryptAsync() which calls API route
export function safeDecrypt(data: string): string {
  if (!data || typeof data !== 'string') {
    return data || ''
  }
  
  // If it doesn't look encrypted, return as-is
  if (!isEncrypted(data)) {
    return data
  }
  
  try {
    const parts = data.split(':')
    
    // Try user format first (4 parts: salt:iv:tag:encryptedData)
    if (parts.length === 4) {
      try {
        return decryptUserFormat(data)
      } catch (error) {
        // On client-side, ENCRYPTION_KEY might not be available
        // Return original data - caller should use safeDecryptAsync instead
        if (typeof window !== 'undefined') {
          console.warn('Client-side: ENCRYPTION_KEY not available, use safeDecryptAsync() instead')
          return data
        }
        console.warn('Failed to decrypt user format, trying staff format:', error)
        // Fall through to try staff format
      }
    }
    
    // Try staff format (3 parts: iv:authTag:encrypted)
    if (parts.length === 3) {
      try {
        return decryptData(data)
      } catch (error) {
        // On client-side, ENCRYPTION_KEY might not be available
        if (typeof window !== 'undefined') {
          console.warn('Client-side: ENCRYPTION_KEY not available, use safeDecryptAsync() instead')
          return data
        }
        throw error
      }
    }
    
    // If neither format works, return original
    return data
  } catch (error) {
    // If decryption fails, return original (might be corrupted or wrong key)
    console.warn('Failed to decrypt data, returning original:', error)
    return data
  }
}

// Async version for client-side decryption via API
// Use this in client components when ENCRYPTION_KEY is not available
export async function safeDecryptAsync(data: string): Promise<string> {
  if (!data || typeof data !== 'string') {
    return data || ''
  }
  
  // If it doesn't look encrypted, return as-is
  if (!isEncrypted(data)) {
    return data
  }
  
  // Check if we're on client-side
  if (typeof window !== 'undefined') {
    try {
      // Call API route for server-side decryption
      const response = await fetch('/api/decrypt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ data }),
      })
      
      if (response.ok) {
        const result = await response.json()
        return result.decrypted || data
      }
    } catch (error) {
      console.warn('Failed to decrypt via API, returning original:', error)
    }
  }
  
  // Fallback to synchronous decryption (works on server-side)
  return safeDecrypt(data)
}

// Helper to decrypt a registration object (batch decrypt via Supabase Edge Function or API on client-side)
export async function decryptRegistration(reg: any): Promise<any> {
  if (!reg) return reg
  
  // Collect encrypted fields
  const fields: string[] = []
  if (reg.name && typeof reg.name === 'string') fields.push(reg.name)
  if (reg.email && typeof reg.email === 'string') fields.push(reg.email)
  if (reg.phone && typeof reg.phone === 'string') fields.push(reg.phone)
  
  // If no encrypted fields, return as-is
  if (fields.length === 0) return reg
  
  // On client-side, use Supabase Edge Function or API route for batch decryption
  if (typeof window !== 'undefined') {
    try {
      // Try Supabase Edge Function first
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      if (supabaseUrl && supabaseAnonKey) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/decrypt-data`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({ fields }),
          })
          
          if (response.ok) {
            const result = await response.json()
            const decryptedMap = result.decrypted || {}
            
            return {
              ...reg,
              name: reg.name ? (decryptedMap[reg.name] || reg.name) : reg.name,
              email: reg.email ? (decryptedMap[reg.email] || reg.email) : reg.email,
              phone: reg.phone ? (decryptedMap[reg.phone] || reg.phone) : reg.phone,
            }
          }
        } catch (edgeFunctionError) {
          console.warn('Supabase Edge Function failed, trying API route:', edgeFunctionError)
        }
      }
      
      // Fallback to API route
      const response = await fetch('/api/decrypt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ fields }),
      })
      
      if (response.ok) {
        const result = await response.json()
        const decryptedMap = result.decrypted || {}
        
        return {
          ...reg,
          name: reg.name ? (decryptedMap[reg.name] || reg.name) : reg.name,
          email: reg.email ? (decryptedMap[reg.email] || reg.email) : reg.email,
          phone: reg.phone ? (decryptedMap[reg.phone] || reg.phone) : reg.phone,
        }
      }
    } catch (error) {
      console.warn('Failed to decrypt via API/Edge Function, using direct decryption:', error)
    }
  }
  
  // Fallback to direct decryption (works on server-side or if ENCRYPTION_KEY is available)
  return {
    ...reg,
    name: reg.name ? safeDecrypt(String(reg.name)) : reg.name,
    email: reg.email ? safeDecrypt(String(reg.email)) : reg.email,
    phone: reg.phone ? safeDecrypt(String(reg.phone)) : reg.phone,
  }
}

// Input sanitization
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '')
  
  // Trim whitespace
  sanitized = sanitized.trim()
  
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  
  return sanitized
}

export function sanitizeEmail(email: string): string {
  const sanitized = sanitizeInput(email)
  return sanitized.toLowerCase()
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

// Validate password strength
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('Mật khẩu phải có ít nhất 8 ký tự')
  }
  
  if (password.length > 128) {
    errors.push('Mật khẩu không được vượt quá 128 ký tự')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Mật khẩu phải có ít nhất một chữ cái thường')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Mật khẩu phải có ít nhất một chữ cái hoa')
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Mật khẩu phải có ít nhất một chữ số')
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

// Generate secure random token
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

// Hash sensitive data (one-way)
export function hashSensitiveData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}


