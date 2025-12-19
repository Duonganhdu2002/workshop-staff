# Hướng dẫn Deploy Supabase Edge Function

## Bước 1: Cài đặt Supabase CLI

```bash
npm install -g supabase
```

## Bước 2: Login vào Supabase

```bash
supabase login
```

## Bước 3: Link project

```bash
cd supabase
supabase link --project-ref kihyqkbnuehkpjxlyejf
```

**Lưu ý:** Thay `kihyqkbnuehkpjxlyejf` bằng project-ref của bạn (có thể lấy từ URL Supabase dashboard).

## Bước 4: Set ENCRYPTION_KEY (nếu chưa set)

```bash
supabase secrets set ENCRYPTION_KEY=wydanhdutnf-vn@12042002
```

Hoặc đã set qua Dashboard rồi thì bỏ qua bước này.

## Bước 5: Deploy Function

```bash
supabase functions deploy decrypt-data
```

## Bước 6: Kiểm tra Function

Sau khi deploy, function sẽ có URL:
```
https://kihyqkbnuehkpjxlyejf.supabase.co/functions/v1/decrypt-data
```

## Test Function

```bash
curl -X POST 'https://kihyqkbnuehkpjxlyejf.supabase.co/functions/v1/decrypt-data' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"data": "your-encrypted-data-here"}'
```

## Xem Logs

```bash
supabase functions logs decrypt-data --follow
```

## Troubleshooting

### Lỗi: "ENCRYPTION_KEY not configured"
- Kiểm tra secret đã được set: `supabase secrets list`
- Set lại nếu cần: `supabase secrets set ENCRYPTION_KEY=your-key`

### Lỗi: "Function not found"
- Đảm bảo đã deploy: `supabase functions deploy decrypt-data`
- Kiểm tra function list: `supabase functions list`

### Lỗi: "Failed to decrypt"
- Kiểm tra ENCRYPTION_KEY có đúng không
- Kiểm tra format dữ liệu encrypted
- Xem logs để biết lỗi cụ thể: `supabase functions logs decrypt-data`

## Sau khi deploy thành công

Code trong `workshop-staff` sẽ tự động sử dụng Edge Function này để giải mã dữ liệu. Không cần thay đổi gì thêm trong code!




