-- ============================================
-- Setup Supabase Database Function để tự động kiểm tra ghế hết hạn
-- ============================================
-- 
-- Hướng dẫn:
-- 1. Mở Supabase Dashboard > SQL Editor
-- 2. Chạy script này để tạo function và schedule
-- 3. Đảm bảo bạn đã cấu hình CRON_SECRET trong Vercel environment variables
-- 4. Thay thế YOUR_VERCEL_URL bằng URL thực tế của bạn (ví dụ: https://your-app.vercel.app)
-- 5. Thay thế YOUR_CRON_SECRET bằng secret bạn đã đặt trong Vercel
--
-- ============================================

-- Bước 1: Enable pg_cron extension (nếu chưa có)
-- Lưu ý: pg_cron chỉ có sẵn trên Supabase Pro plan hoặc self-hosted
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Bước 2: Enable pg_net extension để gọi HTTP (nếu có sẵn)
-- Lưu ý: pg_net chỉ có sẵn trên một số Supabase plans
-- Nếu không có, bạn cần sử dụng Supabase Edge Function (xem Cách 3 trong hướng dẫn)

-- Kiểm tra xem pg_net có sẵn không
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    -- Sử dụng pg_net để gọi HTTP endpoint
    CREATE OR REPLACE FUNCTION call_check_expired_seats_api()
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      api_url TEXT := 'YOUR_VERCEL_URL/api/check-expired-seats';
      cron_secret TEXT := 'YOUR_CRON_SECRET';
      net_request_id BIGINT;
    BEGIN
      -- Gọi API endpoint với authorization header sử dụng pg_net
      SELECT net.http_post(
        url := api_url,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || cron_secret,
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      ) INTO net_request_id;
      
      RAISE NOTICE 'HTTP request sent with ID: %', net_request_id;
    END;
    $$;
  ELSE
    -- Nếu không có pg_net, tạo function đơn giản để log
    -- Bạn sẽ cần sử dụng Supabase Edge Function thay thế
    CREATE OR REPLACE FUNCTION call_check_expired_seats_api()
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      RAISE NOTICE 'pg_net extension not available. Please use Supabase Edge Function instead.';
      RAISE NOTICE 'See SUPABASE_SETUP_GUIDE.md for alternative setup methods.';
    END;
    $$;
  END IF;
END;
$$;

-- Bước 3: Tạo schedule để chạy mỗi 5 phút
-- Lưu ý: Nếu pg_cron không khả dụng, bạn có thể sử dụng Supabase Edge Function thay thế
SELECT cron.schedule(
  'check-expired-seats',           -- Tên job
  '*/5 * * * *',                   -- Chạy mỗi 5 phút (cron format)
  $$SELECT call_check_expired_seats_api();$$
);

-- Kiểm tra các scheduled jobs
SELECT * FROM cron.job;

-- ============================================
-- Nếu pg_cron không khả dụng, sử dụng cách sau:
-- ============================================
-- Tạo Supabase Edge Function thay vì Database Function
-- Xem file: supabase/functions/check-expired-seats/index.ts (sẽ tạo sau)

-- ============================================
-- Để xóa schedule (nếu cần):
-- ============================================
-- SELECT cron.unschedule('check-expired-seats');

-- ============================================
-- Để test function thủ công:
-- ============================================
-- SELECT call_check_expired_seats_api();

