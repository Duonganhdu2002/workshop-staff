# Hướng dẫn Test và Verify Edge Function

## Bước 1: Kiểm tra Function đã được deploy

1. Vào Supabase Dashboard > Edge Functions
2. Tìm function `decrypt-data`
3. Kiểm tra status là "Active"

## Bước 2: Test Function từ Dashboard

1. Vào function `decrypt-data` > Tab "Code"
2. Click "Invoke function"
3. Test với dữ liệu mẫu:

```json
{
  "fields": [
    "your-encrypted-name-here",
    "your-encrypted-email-here",
    "your-encrypted-phone-here"
  ]
}
```

Hoặc test single string:

```json
{
  "data": "your-encrypted-data-here"
}
```

## Bước 3: Test từ Browser Console

Mở browser console trong trang staff và chạy:

```javascript
// Test Edge Function
const supabaseUrl = 'https://kihyqkbnuehkpjxlyejf.supabase.co'
const supabaseAnonKey = 'YOUR_ANON_KEY' // Lấy từ .env.local

// Lấy một registration từ database để test
const testResponse = await fetch(`${supabaseUrl}/functions/v1/decrypt-data`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  body: JSON.stringify({
    fields: [
      'encrypted-name-from-db',
      'encrypted-email-from-db',
      'encrypted-phone-from-db'
    ]
  })
})

const result = await testResponse.json()
console.log('Decrypted:', result)
```

## Bước 4: Kiểm tra trong ứng dụng

1. **Mở trang Quản lý đăng ký** (`/`)
2. **Mở Developer Tools** (F12)
3. **Vào tab Network**
4. **Filter**: `decrypt-data`
5. **Reload trang**
6. Kiểm tra:
   - Có request đến `/functions/v1/decrypt-data` không?
   - Response status là 200?
   - Dữ liệu có được giải mã không?

## Bước 5: Verify dữ liệu hiển thị đúng

1. Vào trang **Quản lý đăng ký**
2. Kiểm tra:
   - ✅ Tên khách hàng hiển thị dạng plain text (không phải mã hóa)
   - ✅ Email hiển thị dạng plain text
   - ✅ Số điện thoại hiển thị dạng plain text

## Troubleshooting

### Lỗi: "ENCRYPTION_KEY not configured"
- Vào Supabase Dashboard > Edge Functions > Secrets
- Kiểm tra `ENCRYPTION_KEY` đã được set chưa
- Set lại nếu cần: `wydanhdutnf-vn@12042002`

### Lỗi: "Function not found" hoặc 404
- Kiểm tra function name: phải là `decrypt-data`
- Kiểm tra URL: `${supabaseUrl}/functions/v1/decrypt-data`
- Đảm bảo function đã được deploy thành công

### Lỗi: "Failed to decrypt"
- Kiểm tra ENCRYPTION_KEY có đúng không
- Kiểm tra format dữ liệu encrypted
- Xem logs trong Supabase Dashboard > Edge Functions > decrypt-data > Logs

### Dữ liệu vẫn hiển thị mã hóa
- Kiểm tra console logs để xem có lỗi không
- Kiểm tra Network tab để xem request có được gửi không
- Kiểm tra response từ Edge Function
- Code sẽ tự động fallback về API route nếu Edge Function fail

## Xem Logs

1. Vào Supabase Dashboard > Edge Functions > decrypt-data
2. Tab "Logs"
3. Xem real-time logs khi function được gọi

Hoặc dùng CLI:

```bash
supabase functions logs decrypt-data --follow
```

## Kết quả mong đợi

Sau khi test thành công:
- ✅ Edge Function hoạt động và giải mã được dữ liệu
- ✅ Dữ liệu trong bảng hiển thị dạng plain text
- ✅ Không còn hiển thị chuỗi mã hóa dài
- ✅ Code tự động sử dụng Edge Function (không cần server riêng)

## Lưu ý

- Code sẽ tự động fallback về API route `/api/decrypt` nếu Edge Function không khả dụng
- Edge Function chỉ hoạt động khi có `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ENCRYPTION_KEY phải giống nhau giữa user system và staff system



