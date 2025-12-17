# Hướng dẫn Setup Tự động Kiểm tra Ghế Hết Hạn

Có 2 cách để tự động kiểm tra và hủy ghế hết hạn:

## Cách 1: Sử dụng Vercel Cron Jobs (Đã cấu hình sẵn)

### Yêu cầu:
- Vercel Pro plan (để sử dụng Cron Jobs)
- Đã deploy ứng dụng lên Vercel

### Các bước:

1. **Thiết lập Environment Variable trong Vercel:**
   - Vào Vercel Dashboard > Project Settings > Environment Variables
   - Thêm biến: `CRON_SECRET` với giá trị bất kỳ (ví dụ: một chuỗi ngẫu nhiên dài)
   - Thêm các biến khác nếu chưa có:
     - `STAFF_EMAIL`: Email nhận thông báo
     - `EMAIL_SERVICE`: `resend`, `sendgrid`, `smtp`, hoặc `none`
     - `RESEND_API_KEY` (nếu dùng Resend)
     - `SENDGRID_API_KEY` (nếu dùng SendGrid)
     - `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (nếu dùng SMTP)

2. **Cron job đã được cấu hình trong `vercel.json`:**
   ```json
   "crons": [
     {
       "path": "/api/check-expired-seats",
       "schedule": "*/5 * * * *"
     }
   ]
   ```
   - Chạy mỗi 5 phút
   - Tự động gửi authorization header với `CRON_SECRET`

3. **Kiểm tra:**
   - Vào Vercel Dashboard > Deployments > Functions
   - Xem logs để đảm bảo cron job chạy đúng

---

## Cách 2: Sử dụng Supabase Database Function với pg_cron (Khuyến nghị)

### Yêu cầu:
- Supabase Pro plan (để sử dụng pg_cron extension)
- Hoặc Supabase self-hosted với pg_cron enabled

### Các bước:

1. **Thiết lập Environment Variable trong Vercel:**
   - Thêm `CRON_SECRET` như ở Cách 1

2. **Chạy SQL Script:**
   - Mở Supabase Dashboard > SQL Editor
   - Mở file `supabase-setup-expired-seats.sql`
   - **Thay thế các giá trị:**
     - `YOUR_VERCEL_URL`: URL thực tế của bạn (ví dụ: `https://your-app.vercel.app`)
     - `YOUR_CRON_SECRET`: Giá trị `CRON_SECRET` bạn đã đặt trong Vercel
   - Chạy script

3. **Kiểm tra:**
   ```sql
   -- Xem các scheduled jobs
   SELECT * FROM cron.job;
   
   -- Test function thủ công
   SELECT call_check_expired_seats_api();
   ```

---

## Cách 3: Sử dụng External Cron Service (Đơn giản nhất, không cần Vercel Pro)

Nếu bạn không có Vercel Pro plan, có thể sử dụng dịch vụ cron miễn phí bên ngoài:

### Sử dụng cron-job.org (Miễn phí):

1. **Đăng ký tài khoản:** https://cron-job.org/
2. **Tạo cron job mới:**
   - URL: `https://your-app.vercel.app/api/check-expired-seats`
   - Method: `GET`
   - Headers: 
     - Key: `Authorization`
     - Value: `Bearer YOUR_CRON_SECRET`
   - Schedule: `*/5 * * * *` (mỗi 5 phút)
3. **Lưu và kích hoạt**

### Sử dụng EasyCron (Miễn phí):

1. **Đăng ký:** https://www.easycron.com/
2. **Tạo cron job:**
   - URL: `https://your-app.vercel.app/api/check-expired-seats`
   - HTTP Method: `GET`
   - HTTP Headers: `Authorization: Bearer YOUR_CRON_SECRET`
   - Cron Expression: `*/5 * * * *`
3. **Lưu và kích hoạt**

### Sử dụng GitHub Actions (Miễn phí):

1. **Tạo file `.github/workflows/check-expired-seats.yml`:**
   ```yaml
   name: Check Expired Seats
   on:
     schedule:
       - cron: '*/5 * * * *'  # Mỗi 5 phút
     workflow_dispatch:  # Cho phép chạy thủ công
   
   jobs:
     check:
       runs-on: ubuntu-latest
       steps:
         - name: Call API
           run: |
             curl -X GET "${{ secrets.API_URL }}/api/check-expired-seats" \
               -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
   ```

2. **Thêm Secrets trong GitHub:**
   - `API_URL`: URL của Vercel app
   - `CRON_SECRET`: Secret bạn đã đặt

---

## Cách 4: Sử dụng Supabase Edge Function (Nếu không có pg_cron)

Nếu bạn không có Supabase Pro plan, có thể tạo Supabase Edge Function:

1. **Tạo Edge Function:**
   ```bash
   # Cài đặt Supabase CLI (nếu chưa có)
   npm install -g supabase
   
   # Login vào Supabase
   supabase login
   
   # Link project
   supabase link --project-ref your-project-ref
   
   # Tạo function
   supabase functions new check-expired-seats
   ```

2. **Copy code từ API route vào Edge Function**

3. **Deploy:**
   ```bash
   supabase functions deploy check-expired-seats
   ```

4. **Tạo Database Trigger để gọi Edge Function khi có ghế được chọn**

---

## Kiểm tra Email có hoạt động không

1. **Test thủ công API:**
   ```bash
   curl -X GET "https://your-app.vercel.app/api/check-expired-seats" \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

2. **Kiểm tra logs:**
   - Vercel Dashboard > Deployments > Functions > check-expired-seats
   - Xem console logs để debug

3. **Đảm bảo có ghế hết hạn để test:**
   - Tạo một ghế với `status = 'selected'` và `selected_at` cách đây hơn 10 phút
   - Chạy API để kiểm tra

---

## Troubleshooting

### Không nhận được email:
1. Kiểm tra `STAFF_EMAIL` đã được cấu hình đúng chưa
2. Kiểm tra `EMAIL_SERVICE` đã được set đúng chưa
3. Kiểm tra API keys (RESEND_API_KEY, SENDGRID_API_KEY, hoặc SMTP config)
4. Xem logs trong Vercel để tìm lỗi

### Cron job không chạy:
1. Đảm bảo bạn đang dùng Vercel Pro plan
2. Kiểm tra cron job trong Vercel Dashboard
3. Xem logs để tìm lỗi

### pg_cron không hoạt động:
1. Đảm bảo bạn đang dùng Supabase Pro plan
2. Kiểm tra extension đã được enable chưa: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
3. Sử dụng Cách 3 (Edge Function) thay thế

---

## Lưu ý quan trọng:

- **CRON_SECRET**: Luôn sử dụng một chuỗi ngẫu nhiên dài và phức tạp để bảo mật
- **Schedule**: Hiện tại set là mỗi 5 phút (`*/5 * * * *`), bạn có thể thay đổi theo nhu cầu
- **Email Service**: Đảm bảo đã cấu hình đúng một trong các service (Resend, SendGrid, hoặc SMTP)

