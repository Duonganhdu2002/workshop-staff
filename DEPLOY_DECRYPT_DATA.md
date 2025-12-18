# Hướng dẫn Deploy Function decrypt-data

## Vấn đề
Hiện tại chỉ có function `smart-api`, cần deploy function `decrypt-data` để giải mã dữ liệu.

## Cách 1: Deploy qua Supabase Dashboard (Khuyến nghị)

### Bước 1: Tạo Function mới
1. Vào Supabase Dashboard > Edge Functions
2. Click button **"Deploy a new function"** (màu xanh)
3. Chọn **"Create a new function"**

### Bước 2: Đặt tên Function
- **Function name:** `decrypt-data`
- Click **"Create function"**

### Bước 3: Copy code vào Editor
1. Mở file `supabase/functions/decrypt-data/index.ts` trong editor của bạn
2. Copy **TOÀN BỘ** nội dung file
3. Paste vào code editor trong Supabase Dashboard
4. Click **"Deploy"** (hoặc **"Save"**)

### Bước 4: Set ENCRYPTION_KEY Secret
1. Vào **Edge Functions > Secrets**
2. Kiểm tra xem đã có `ENCRYPTION_KEY` chưa
3. Nếu chưa có, click **"Add new secret"**:
   - **Name:** `ENCRYPTION_KEY`
   - **Value:** `wydanhdutnf-vn@12042002`
   - Click **"Save"**

## Cách 2: Deploy qua CLI

### Bước 1: Cài đặt Supabase CLI (nếu chưa có)
```bash
npm install -g supabase
```

### Bước 2: Login
```bash
supabase login
```

### Bước 3: Link project
```bash
cd supabase
supabase link --project-ref kihyqkbnuehkpjxlyejf
```

### Bước 4: Set Secret (nếu chưa set)
```bash
supabase secrets set ENCRYPTION_KEY=wydanhdutnf-vn@12042002
```

### Bước 5: Deploy Function
```bash
supabase functions deploy decrypt-data
```

## Kiểm tra sau khi deploy

1. Vào **Edge Functions** trong Dashboard
2. Bạn sẽ thấy function `decrypt-data` trong danh sách
3. Click vào function để xem chi tiết
4. URL sẽ là: `https://kihyqkbnuehkpjxlyejf.supabase.co/functions/v1/decrypt-data`

## Test Function

Sau khi deploy, test function:

1. Vào function `decrypt-data` > Tab **"Code"**
2. Click **"Invoke function"**
3. Test với dữ liệu mẫu:

```json
{
  "fields": [
    "encrypted-data-1",
    "encrypted-data-2"
  ]
}
```

Hoặc:

```json
{
  "data": "encrypted-data-here"
}
```

## Troubleshooting

### Lỗi: "Function name already exists"
- Function `decrypt-data` đã tồn tại, có thể đã được deploy trước đó
- Kiểm tra trong danh sách functions
- Hoặc xóa function cũ và tạo lại

### Lỗi: "ENCRYPTION_KEY not configured"
- Vào **Edge Functions > Secrets**
- Đảm bảo `ENCRYPTION_KEY` đã được set
- Set lại nếu cần

### Lỗi khi deploy code
- Kiểm tra syntax code có đúng không
- Đảm bảo đã copy đầy đủ code từ file `index.ts`
- Xem error message để biết lỗi cụ thể

## Sau khi deploy thành công

Code trong `workshop-staff` sẽ tự động sử dụng function `decrypt-data` để giải mã dữ liệu. Không cần thay đổi gì thêm!


