# Hướng dẫn Setup Supabase Edge Function để Giải mã Dữ liệu

## Tổng quan

Thay vì sử dụng API route trong Next.js server, bạn có thể sử dụng Supabase Edge Function để giải mã dữ liệu. Điều này giúp:
- ✅ Không cần build server riêng
- ✅ Tự động scale
- ✅ Chạy gần database (nhanh hơn)
- ✅ Bảo mật tốt hơn (ENCRYPTION_KEY trong Supabase secrets)

## Cài đặt

### 1. Cài đặt Supabase CLI

```bash
npm install -g supabase
```

### 2. Login vào Supabase

```bash
supabase login
```

### 3. Link project

```bash
cd supabase
supabase link --project-ref your-project-ref
```

Để lấy project-ref:
- Vào Supabase Dashboard
- Chọn project của bạn
- Vào Settings > General
- Copy "Reference ID"

Hoặc nếu chưa có project:
```bash
supabase init
```

### 4. Set Environment Variable (ENCRYPTION_KEY)

Thêm `ENCRYPTION_KEY` vào Supabase secrets:

```bash
supabase secrets set ENCRYPTION_KEY=wydanhdutnf-vn@12042002
```

**Hoặc qua Supabase Dashboard:**
1. Vào Project Settings > Edge Functions > Secrets
2. Click "Add new secret"
3. Name: `ENCRYPTION_KEY`
4. Value: `wydanhdutnf-vn@12042002`
5. Click "Save"

### 5. Deploy Edge Function

```bash
supabase functions deploy decrypt-data
```

## Kiểm tra

Sau khi deploy, kiểm tra function:

```bash
# Test function
curl -X POST 'https://your-project-ref.supabase.co/functions/v1/decrypt-data' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"data": "your-encrypted-data-here"}'
```

## Cách hoạt động

Code đã được cập nhật để tự động sử dụng Supabase Edge Function khi:
1. ✅ Có `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. ✅ Function `decrypt-data` đã được deploy
3. ✅ Edge Function hoạt động thành công

Nếu Edge Function không khả dụng, code sẽ tự động fallback về API route `/api/decrypt`.

## Cập nhật Code

Code đã được cập nhật trong `lib/security.ts`:
- Hàm `decryptRegistration()` tự động thử Supabase Edge Function trước
- Nếu thất bại, sẽ fallback về API route
- Nếu cả hai đều thất bại, sẽ thử giải mã trực tiếp (nếu ENCRYPTION_KEY có sẵn)

## Lợi ích so với API Route

| Tính năng | API Route | Edge Function |
|-----------|----------|---------------|
| Server riêng | ❌ Cần | ✅ Không cần |
| Scaling | ⚠️ Manual | ✅ Tự động |
| Latency | ⚠️ Cao hơn | ✅ Thấp hơn |
| Cost | ⚠️ Server cost | ✅ Pay per use |
| Setup | ⚠️ Phức tạp | ✅ Đơn giản |

## Troubleshooting

### Lỗi: "Function not found"
- Đảm bảo đã deploy: `supabase functions deploy decrypt-data`
- Kiểm tra project-ref đúng chưa

### Lỗi: "ENCRYPTION_KEY not configured"
- Đảm bảo đã set secret: `supabase secrets set ENCRYPTION_KEY=your-key`
- Hoặc set qua Dashboard

### Lỗi: "Unauthorized"
- Kiểm tra `NEXT_PUBLIC_SUPABASE_ANON_KEY` đúng chưa
- Đảm bảo Authorization header có format: `Bearer YOUR_ANON_KEY`

### Function không hoạt động
- Kiểm tra logs: `supabase functions logs decrypt-data`
- Kiểm tra function có được deploy không: `supabase functions list`

## Xem Logs

```bash
# Xem logs real-time
supabase functions logs decrypt-data --follow

# Xem logs của một invocation cụ thể
supabase functions logs decrypt-data --invocation-id <id>
```

## Update Function

Khi cần cập nhật function:

```bash
# Sửa code trong supabase/functions/decrypt-data/index.ts
# Sau đó deploy lại
supabase functions deploy decrypt-data
```

## Xóa Function

```bash
supabase functions delete decrypt-data
```

## Lưu ý

- ⚠️ ENCRYPTION_KEY phải giống nhau giữa user system và staff system
- ⚠️ Không commit ENCRYPTION_KEY vào Git
- ⚠️ Backup ENCRYPTION_KEY ở nơi an toàn
- ✅ Edge Function tự động scale theo traffic
- ✅ Không cần quản lý server



