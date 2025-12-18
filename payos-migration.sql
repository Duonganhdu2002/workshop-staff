-- Migration: Add PayOS payment integration
-- Run this SQL in your Supabase SQL Editor

-- 1. Add payment_method column to registrations table
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'payos'));

-- 2. Create payos_payments table to track PayOS payment transactions
CREATE TABLE IF NOT EXISTS public.payos_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
    payos_code TEXT NOT NULL UNIQUE,
    amount INTEGER NOT NULL,
    description TEXT,
    account_number TEXT,
    account_name TEXT,
    payment_link_id TEXT,
    payment_link TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'expired')),
    webhook_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payos_payments_registration_id ON public.payos_payments(registration_id);
CREATE INDEX IF NOT EXISTS idx_payos_payments_payos_code ON public.payos_payments(payos_code);
CREATE INDEX IF NOT EXISTS idx_payos_payments_status ON public.payos_payments(status);
CREATE INDEX IF NOT EXISTS idx_registrations_payos_payment_id ON public.registrations(payos_payment_id);

-- 3.5. Add payos_payment_id column to registrations table (after payos_payments table is created)
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS payos_payment_id UUID REFERENCES public.payos_payments(id) ON DELETE SET NULL;

-- 4. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_payos_payments_updated_at ON public.payos_payments;
CREATE TRIGGER update_payos_payments_updated_at
    BEFORE UPDATE ON public.payos_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Add comments for documentation
COMMENT ON TABLE public.payos_payments IS 'Lưu trữ thông tin các giao dịch thanh toán qua PayOS';
COMMENT ON COLUMN public.payos_payments.payos_code IS 'Mã giao dịch từ PayOS (code)';
COMMENT ON COLUMN public.payos_payments.amount IS 'Số tiền thanh toán (đơn vị: VNĐ)';
COMMENT ON COLUMN public.payos_payments.payment_link_id IS 'ID của payment link từ PayOS';
COMMENT ON COLUMN public.payos_payments.payment_link IS 'URL thanh toán từ PayOS';
COMMENT ON COLUMN public.payos_payments.status IS 'Trạng thái thanh toán: pending, paid, cancelled, expired';
COMMENT ON COLUMN public.payos_payments.webhook_data IS 'Dữ liệu webhook từ PayOS';
COMMENT ON COLUMN public.registrations.payment_method IS 'Phương thức thanh toán: bank_transfer hoặc payos';
COMMENT ON COLUMN public.registrations.payos_payment_id IS 'ID của bản ghi trong bảng payos_payments';

-- 7. Enable Row Level Security (RLS) if needed
ALTER TABLE public.payos_payments ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to access all records
CREATE POLICY "Service role can access all payos_payments"
    ON public.payos_payments
    FOR ALL
    USING (true)
    WITH CHECK (true);

