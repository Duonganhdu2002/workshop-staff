/**
 * Migration script to hash existing plain text passwords
 * Run this once to migrate all passwords from plain text to bcrypt hashes
 * 
 * Usage: npx ts-node scripts/migrate-passwords.ts
 */

import { createClient } from '@supabase/supabase-js'
import { hashPassword, comparePassword } from '../lib/security'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase configuration')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function migratePasswords() {
  console.log('🔐 Starting password migration...\n')

  try {
    // Fetch all staff with plain text passwords (not starting with $2a$ or $2b$)
    const { data: staffList, error } = await supabase
      .from('staff')
      .select('id, email, password')
      .not('password', 'like', '$2a$%')
      .not('password', 'like', '$2b$%')

    if (error) {
      console.error('❌ Error fetching staff:', error)
      process.exit(1)
    }

    if (!staffList || staffList.length === 0) {
      console.log('✅ No passwords to migrate. All passwords are already hashed.')
      return
    }

    console.log(`📋 Found ${staffList.length} staff members with plain text passwords\n`)

    let successCount = 0
    let errorCount = 0

    for (const staff of staffList) {
      try {
        // Hash the password
        const hashedPassword = await hashPassword(staff.password)

        // Update in database
        const { error: updateError } = await supabase
          .from('staff')
          .update({ password: hashedPassword })
          .eq('id', staff.id)

        if (updateError) {
          console.error(`❌ Failed to update password for ${staff.email}:`, updateError.message)
          errorCount++
        } else {
          // Verify the hash works
          const isValid = await comparePassword(staff.password, hashedPassword)
          if (isValid) {
            console.log(`✅ Migrated password for ${staff.email}`)
            successCount++
          } else {
            console.error(`❌ Hash verification failed for ${staff.email}`)
            errorCount++
          }
        }
      } catch (err: any) {
        console.error(`❌ Error processing ${staff.email}:`, err.message)
        errorCount++
      }
    }

    console.log(`\n📊 Migration Summary:`)
    console.log(`   ✅ Success: ${successCount}`)
    console.log(`   ❌ Errors: ${errorCount}`)
    console.log(`\n✅ Password migration completed!`)
  } catch (error: any) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

migratePasswords()


