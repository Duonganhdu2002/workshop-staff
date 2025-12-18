# Hướng dẫn thiết lập PayOS

## Tổng quan

Đã tích hợp thành công chức năng thanh toán qua PayOS vào hệ thống đăng ký workshop. Người dùng có thể chọn thanh toán qua PayOS hoặc chuyển khoản ngân hàng truyền thống.

## Các bước thiết lập

### 1. Chạy Migration SQL

Chạy file `payos-migration.sql` trong Supabase SQL Editor để tạo các bảng và cột cần thiết:

```sql
-- File: workshop-staff/payos-migration.sql
```

Migration này sẽ:
- Thêm cột `payment_method` vào bảng `registrations`
- Thêm cột `payos_payment_id` vào bảng `registrations`
- Tạo bảng `payos_payments` để lưu trữ thông tin giao dịch PayOS
- Tạo các index và trigger cần thiết

### 2. Cấu hình biến môi trường

Thêm các biến môi trường sau vào file `.env.local` của cả `workshop-user` và `workshop-staff`:

```env
# PayOS Configuration
PAYOS_CLIENT_ID=your_client_id
PAYOS_API_KEY=your_api_key
PAYOS_CHECKSUM_KEY=your_checksum_key

# Base URL (cho webhook và redirect)
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

**Lưu ý:** 
- Lấy các giá trị `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, và `PAYOS_CHECKSUM_KEY` từ trang quản trị PayOS của bạn
- `NEXT_PUBLIC_BASE_URL` phải là URL đầy đủ của ứng dụng (ví dụ: `https://workshop-user.vercel.app`)

### 3. Cấu hình Webhook PayOS

Webhook là cơ chế để PayOS thông báo cho hệ thống của bạn khi có sự kiện thanh toán xảy ra (thanh toán thành công, hủy, hết hạn). Đây là bước quan trọng để hệ thống tự động cập nhật trạng thái thanh toán.

#### 3.1. Đăng nhập vào PayOS Dashboard

1. Truy cập: https://my.payos.vn
2. Đăng nhập bằng tài khoản PayOS của bạn
3. Sau khi đăng nhập, bạn sẽ thấy dashboard với các menu bên trái

#### 3.2. Tìm phần cấu hình Webhook

1. Trong menu bên trái, tìm và click vào **"Kênh thanh toán"** (Payment channel)
2. Chọn kênh thanh toán bạn đã tạo (ví dụ: "Workshop - TNFVN")
3. Trong trang chi tiết kênh thanh toán, bạn sẽ thấy các tab:
   - **"Thông tin tích hợp"** (Integration information) - Tab này chứa thông tin API
   - **"Cài đặt"** (Settings) - Tab này có thể chứa cấu hình webhook

**Lưu ý:** Vị trí cấu hình webhook có thể khác nhau tùy theo phiên bản PayOS. Thường nằm ở:
- Trong tab **"Thông tin tích hợp"** → phần **"Webhook URL"**
- Hoặc trong tab **"Cài đặt"** → phần **"Webhook"**
- Hoặc trong menu **"Thiết lập"** → **"Webhook"**

#### 3.3. Thêm Webhook URL

1. Tìm trường **"Webhook URL"** hoặc **"URL nhận thông báo"**
2. Nhập URL webhook của bạn:
   ```
   https://your-domain.com/api/payos/webhook
   ```
   
   **Ví dụ cụ thể:**
   - Nếu deploy trên Vercel: `https://workshop-user.vercel.app/api/payos/webhook`
   - Nếu deploy trên domain riêng: `https://workshop.yourdomain.com/api/payos/webhook`
   
   **⚠️ Lưu ý quan trọng:**
   - URL phải là HTTPS (không được dùng HTTP)
   - URL phải có thể truy cập công khai từ internet (không được là localhost)
   - URL phải chính xác 100%, bao gồm cả đường dẫn `/api/payos/webhook`
   - Không có dấu cách hoặc ký tự đặc biệt ở cuối URL

3. Click **"Lưu"** hoặc **"Cập nhật"** để lưu webhook URL

#### 3.4. Xác nhận Webhook URL

Sau khi bạn lưu webhook URL, PayOS sẽ tự động gửi một request test đến URL đó để xác nhận:

1. **PayOS sẽ gửi request POST** đến webhook URL của bạn với payload test
2. **Hệ thống của bạn phải trả về status 200** để xác nhận webhook hợp lệ
3. Trong PayOS dashboard, bạn sẽ thấy trạng thái:
   - ✅ **"Đã xác nhận"** hoặc **"Active"** - Webhook đã được xác nhận thành công
   - ❌ **"Chưa xác nhận"** hoặc **"Pending"** - Webhook chưa được xác nhận
   - ⚠️ **"Lỗi"** hoặc **"Failed"** - Webhook không thể kết nối

**Nếu webhook chưa được xác nhận:**

1. **Kiểm tra URL có đúng không:**
   - Mở trình duyệt và truy cập trực tiếp URL webhook (sẽ thấy JSON response với `{"success": true, "message": "Webhook endpoint is active"}` - đây là bình thường)
   - Nếu thấy 404 Not Found → URL sai hoặc route chưa được deploy
   - Nếu thấy 405 Method Not Allowed → Có thể do cache, thử lại sau khi deploy

2. **Kiểm tra server logs:**
   - Xem log của server (Vercel Dashboard → Functions → Logs)
   - Tìm các request đến `/api/payos/webhook`
   - Kiểm tra có lỗi gì không

3. **Kiểm tra biến môi trường:**
   - Đảm bảo `PAYOS_CHECKSUM_KEY` đã được set đúng trong environment variables
   - Restart server sau khi thay đổi environment variables

4. **Test webhook thủ công:**
   ```bash
   # Sử dụng curl để test webhook
   curl -X POST https://your-domain.com/api/payos/webhook \
     -H "Content-Type: application/json" \
     -d '{
       "code": "test",
       "desc": "success",
       "data": {
         "orderCode": 1234567890,
         "amount": 399000,
         "description": "Test webhook"
       },
       "signature": "test_signature"
     }'
   ```

#### 3.5. Kiểm tra Webhook đã hoạt động

Sau khi webhook được xác nhận thành công:

1. **Tạo một đăng ký test:**
   - Tạo đăng ký mới với phương thức thanh toán PayOS
   - Copy payment link PayOS

2. **Thực hiện thanh toán test:**
   - Mở payment link trong trình duyệt
   - Thực hiện thanh toán test (PayOS có chế độ sandbox/test)
   - Hoàn tất thanh toán

3. **Kiểm tra webhook được gọi:**
   - Xem server logs để thấy webhook request từ PayOS
   - Kiểm tra trong Supabase:
     - Bảng `payos_payments`: Trạng thái đã được cập nhật thành `paid`
     - Bảng `registrations`: `payment_status` đã được cập nhật thành `verified`
     - Cột `webhook_data` trong `payos_payments` chứa dữ liệu webhook

#### 3.6. Các sự kiện Webhook

PayOS sẽ gửi webhook cho các sự kiện sau:

- **Thanh toán thành công** (`desc: "success"`):
  - Hệ thống sẽ cập nhật `payos_payments.status` = `paid`
  - Cập nhật `registrations.payment_status` = `verified`
  - Gửi thông báo cho staff

- **Thanh toán bị hủy** (`desc: "cancelled"`):
  - Hệ thống sẽ cập nhật `payos_payments.status` = `cancelled`

- **Link thanh toán hết hạn** (`desc: "expired"`):
  - Hệ thống sẽ cập nhật `payos_payments.status` = `expired`

#### 3.7. Lưu ý quan trọng về Webhook

1. **Webhook có thể bị retry:**
   - Nếu hệ thống không phản hồi 200, PayOS sẽ retry webhook
   - Đảm bảo webhook handler luôn trả về 200 ngay cả khi có lỗi xử lý

2. **Webhook có thể bị delay:**
   - Webhook có thể đến sau vài giây hoặc vài phút sau khi thanh toán
   - Không nên dựa vào webhook để hiển thị trạng thái real-time cho người dùng

3. **Bảo mật:**
   - Luôn verify webhook signature (đã được implement trong code)
   - Không tin tưởng dữ liệu từ webhook nếu signature không hợp lệ

4. **Monitoring:**
   - Nên monitor webhook logs thường xuyên
   - Thiết lập alert nếu webhook fail nhiều lần liên tiếp

#### 3.8. Troubleshooting Webhook

**Vấn đề: Webhook không được gọi**

- ✅ Kiểm tra URL webhook trong PayOS dashboard có đúng không
- ✅ Kiểm tra webhook URL có thể truy cập từ internet không (dùng browser hoặc curl)
- ✅ Kiểm tra server có đang chạy không
- ✅ Kiểm tra firewall/security settings có block request từ PayOS không

**Vấn đề: Webhook được gọi nhưng trả về lỗi**

- ✅ Kiểm tra `PAYOS_CHECKSUM_KEY` có đúng không
- ✅ Kiểm tra server logs để xem lỗi cụ thể
- ✅ Kiểm tra database connection có hoạt động không
- ✅ Kiểm tra code webhook handler có lỗi syntax không

**Vấn đề: Webhook được gọi nhưng không cập nhật database**

- ✅ Kiểm tra `payos_code` trong webhook có khớp với database không
- ✅ Kiểm tra Supabase RLS policies có cho phép update không
- ✅ Kiểm tra service role key có đúng không
- ✅ Xem `webhook_data` trong database để debug

### 4. Kiểm tra hoạt động

1. **Tạo đăng ký mới:**
   - Chọn ghế và điền thông tin
   - Chọn phương thức thanh toán "Thanh toán qua PayOS"
   - Xác nhận đăng ký
   - Link thanh toán PayOS sẽ được hiển thị

2. **Kiểm tra webhook:**
   - Thực hiện thanh toán test trên PayOS
   - Kiểm tra log để đảm bảo webhook được nhận và xử lý đúng
   - Kiểm tra trong Supabase để xem trạng thái thanh toán đã được cập nhật chưa

## Cấu trúc dữ liệu

### Bảng `payos_payments`

Lưu trữ thông tin các giao dịch thanh toán qua PayOS:

- `id`: UUID (Primary Key)
- `registration_id`: UUID (Foreign Key → registrations.id)
- `payos_code`: Mã giao dịch từ PayOS (orderCode)
- `amount`: Số tiền thanh toán (VNĐ)
- `description`: Mô tả giao dịch
- `payment_link_id`: ID của payment link từ PayOS
- `payment_link`: URL thanh toán
- `status`: Trạng thái (`pending`, `paid`, `cancelled`, `expired`)
- `webhook_data`: Dữ liệu webhook từ PayOS (JSONB)
- `created_at`, `updated_at`: Timestamp

### Bảng `registrations`

Đã thêm các cột:
- `payment_method`: `bank_transfer` hoặc `payos`
- `payos_payment_id`: UUID tham chiếu đến `payos_payments.id`

## Luồng xử lý

### 1. Tạo đăng ký với PayOS

1. Người dùng chọn phương thức thanh toán PayOS
2. Sau khi đăng ký thành công, hệ thống gọi API `/api/payos/create-payment`
3. API tạo payment link từ PayOS và lưu vào database
4. Link thanh toán được hiển thị cho người dùng

### 2. Xử lý thanh toán

1. Người dùng click vào link thanh toán và hoàn tất thanh toán trên PayOS
2. PayOS gửi webhook đến `/api/payos/webhook`
3. Webhook handler:
   - Xác thực chữ ký webhook
   - Cập nhật trạng thái thanh toán trong `payos_payments`
   - Nếu thanh toán thành công (`paid`):
     - Cập nhật `payment_status` trong `registrations` thành `verified`
     - Gửi thông báo cho staff

### 3. Quản lý trên trang Staff

- Hiển thị phương thức thanh toán (PayOS hoặc Chuyển khoản)
- Hiển thị thông tin giao dịch PayOS (mã, trạng thái)
- Link đến payment link PayOS (nếu có)

## API Endpoints

### POST `/api/payos/create-payment`

Tạo payment link PayOS cho một đăng ký.

**Request:**
```json
{
  "registrationId": "uuid",
  "amount": 399000,
  "description": "Thanh toán đăng ký workshop - Ghế số 1"
}
```

**Response:**
```json
{
  "paymentLink": "https://pay.payos.vn/...",
  "paymentLinkId": "string",
  "payosCode": "string",
  "payosPaymentId": "uuid"
}
```

### POST `/api/payos/webhook`

Nhận và xử lý webhook từ PayOS.

**Request:** (từ PayOS)
```json
{
  "code": "string",
  "desc": "success",
  "data": { ... },
  "signature": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

## Troubleshooting

### Webhook không hoạt động

1. Kiểm tra URL webhook trong PayOS dashboard
2. Kiểm tra biến môi trường `PAYOS_CHECKSUM_KEY` có đúng không
3. Kiểm tra log của server để xem có lỗi gì không
4. Đảm bảo webhook URL có thể truy cập công khai (không phải localhost)

### Payment link không được tạo

1. Kiểm tra các biến môi trường PayOS
2. Kiểm tra console log để xem lỗi cụ thể
3. Đảm bảo `NEXT_PUBLIC_BASE_URL` được cấu hình đúng

### Thanh toán thành công nhưng không cập nhật trạng thái

1. Kiểm tra webhook có được gửi đến không
2. Kiểm tra log của webhook handler
3. Kiểm tra database để xem webhook data có được lưu không

## Tài liệu tham khảo

- [PayOS Documentation](https://payos.vn/docs)
- [PayOS Node SDK](https://github.com/payOSHQ/payos-lib-node)

