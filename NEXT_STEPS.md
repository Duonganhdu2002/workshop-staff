# Bước tiếp theo sau khi tạo Edge Function

## ✅ Đã hoàn thành

1. ✅ Tạo Supabase Edge Function `decrypt-data`
2. ✅ Set ENCRYPTION_KEY trong Supabase secrets
3. ✅ Code đã được cập nhật để tự động sử dụng Edge Function

## 🔍 Bước tiếp theo

### 1. Test Function

**Cách 1: Test từ Supabase Dashboard**
1. Vào Supabase Dashboard > Edge Functions > `decrypt-data`
2. Click "Invoke function"
3. Test với dữ liệu encrypted thực tế từ database

**Cách 2: Test từ ứng dụng**
1. Mở trang Quản lý đăng ký (`/`)
2. Mở Developer Tools (F12) > Network tab
3. Filter: `decrypt-data`
4. Reload trang và kiểm tra request

### 2. Verify Function hoạt động

Kiểm tra:
- ✅ Function có được gọi không? (xem Network tab)
- ✅ Response status là 200?
- ✅ Dữ liệu có được giải mã không?
- ✅ Dữ liệu hiển thị dạng plain text trong bảng?

### 3. Kiểm tra Logs

Nếu có lỗi, xem logs:
- Supabase Dashboard > Edge Functions > decrypt-data > Logs
- Hoặc: `supabase functions logs decrypt-data --follow`

### 4. Troubleshooting

**Nếu dữ liệu vẫn hiển thị mã hóa:**
1. Kiểm tra console logs có lỗi không
2. Kiểm tra Network tab xem request có được gửi không
3. Kiểm tra response từ Edge Function
4. Code sẽ tự động fallback về API route nếu Edge Function fail

**Nếu Edge Function không hoạt động:**
- Kiểm tra ENCRYPTION_KEY đã được set chưa
- Kiểm tra function name đúng chưa (`decrypt-data`)
- Kiểm tra URL đúng chưa (`/functions/v1/decrypt-data`)

## 🎯 Kết quả mong đợi

Sau khi hoàn thành:
- ✅ Staff có thể xem thông tin user dạng plain text
- ✅ Không cần server riêng (sử dụng Supabase Edge Function)
- ✅ Tự động scale theo traffic
- ✅ Bảo mật tốt (ENCRYPTION_KEY trong Supabase secrets)

## 📝 Lưu ý

- Code đã tự động detect và sử dụng Edge Function khi có sẵn
- Nếu Edge Function không khả dụng, sẽ fallback về API route
- ENCRYPTION_KEY phải giống nhau giữa user và staff system
- Không cần restart server sau khi deploy Edge Function




