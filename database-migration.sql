-- Migration: Add payment_content and transfer_content columns to registrations table
-- Run this SQL in your Supabase SQL Editor

-- Add transfer_content column (text, nullable)
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS transfer_content TEXT;

-- Add payment_content column (text, nullable)  
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS payment_content TEXT;

-- Add comment to columns for documentation
COMMENT ON COLUMN public.registrations.transfer_content IS 'Nội dung chuyển khoản để nhân viên kiểm tra';
COMMENT ON COLUMN public.registrations.payment_content IS 'Nội dung thanh toán (alternative field name)';

