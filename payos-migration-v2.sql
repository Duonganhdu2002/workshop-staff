-- Migration: Update payos_payments to support registration creation after payment
-- Run this SQL in your Supabase SQL Editor
-- This allows storing registration data temporarily before payment is completed

-- 1. Drop the NOT NULL constraint on registration_id (make it nullable)
ALTER TABLE public.payos_payments 
ALTER COLUMN registration_id DROP NOT NULL;

-- 2. Add temporary registration data fields
ALTER TABLE public.payos_payments 
ADD COLUMN IF NOT EXISTS temp_name TEXT,
ADD COLUMN IF NOT EXISTS temp_email TEXT,
ADD COLUMN IF NOT EXISTS temp_phone TEXT,
ADD COLUMN IF NOT EXISTS temp_seat_number INTEGER;

-- 3. Add index for temp_email to check duplicates
CREATE INDEX IF NOT EXISTS idx_payos_payments_temp_email ON public.payos_payments(temp_email) WHERE temp_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payos_payments_temp_phone ON public.payos_payments(temp_phone) WHERE temp_phone IS NOT NULL;

-- 4. Update comments
COMMENT ON COLUMN public.payos_payments.registration_id IS 'ID của registration (NULL nếu chưa thanh toán)';
COMMENT ON COLUMN public.payos_payments.temp_name IS 'Tên người đăng ký (tạm thời, sẽ được chuyển vào registrations khi thanh toán thành công)';
COMMENT ON COLUMN public.payos_payments.temp_email IS 'Email người đăng ký (tạm thời, sẽ được chuyển vào registrations khi thanh toán thành công)';
COMMENT ON COLUMN public.payos_payments.temp_phone IS 'Số điện thoại người đăng ký (tạm thời, sẽ được chuyển vào registrations khi thanh toán thành công)';
COMMENT ON COLUMN public.payos_payments.temp_seat_number IS 'Số ghế đã chọn (tạm thời, sẽ được chuyển vào registrations khi thanh toán thành công)';


