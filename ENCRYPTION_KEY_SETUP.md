# Hướng dẫn Cấu hình ENCRYPTION_KEY

## Tổng quan

Để staff có thể giải mã và xem thông tin user từ database, cả hai hệ thống (`workshop-user` và `workshop-staff`) phải sử dụng **CÙNG MỘT** `ENCRYPTION_KEY`.

## Cấu hình

### 1. Thêm ENCRYPTION_KEY vào cả hai project

**workshop-user/.env.local:**
```env
ENCRYPTION_KEY=wydanhdutnf-vn@12042002
```

**workshop-staff/.env.local:**
```env
ENCRYPTION_KEY=wydanhdutnf-vn@12042002
```

### 2. Restart Server

Sau khi thêm `ENCRYPTION_KEY`, bạn cần **restart server** để biến môi trường được load:

```bash
# Trong workshop-user
npm run dev

# Trong workshop-staff (terminal khác)
npm run dev
```

## Cách hoạt động

### Server-side (API Routes)
- `ENCRYPTION_KEY` được đọc trực tiếp từ `process.env.ENCRYPTION_KEY`
- Giải mã được thực hiện trực tiếp trong code

### Client-side (React Components)
- `ENCRYPTION_KEY` **KHÔNG** có sẵn ở client-side (bảo mật)
- Code tự động sử dụng API route `/api/decrypt` để giải mã ở server-side
- API route sử dụng `ENCRYPTION_KEY` từ server để giải mã

## Các hàm đã được cập nhật

### 1. `safeDecrypt(data: string)`
- Giải mã đồng bộ
- Hoạt động tốt ở server-side
- Ở client-side, sẽ trả về giá trị gốc nếu không thể giải mã (cần dùng `decryptRegistration`)

### 2. `decryptRegistration(reg: any)`
- Giải mã một registration object hoàn chỉnh
- Tự động sử dụng API route khi ở client-side
- Batch decrypt nhiều fields cùng lúc để tối ưu hiệu suất

### 3. API Route `/api/decrypt`
- Giải mã ở server-side
- Hỗ trợ cả single string và batch decryption
- Yêu cầu authentication (chỉ staff đã đăng nhập mới dùng được)

## Các file đã được cập nhật

1. ✅ `lib/security.ts` - Thêm `decryptUserFormat()` và `decryptRegistration()`
2. ✅ `app/api/decrypt/route.ts` - API route để giải mã ở server-side
3. ✅ `app/page.tsx` - Sử dụng `decryptRegistration()` để giải mã danh sách đăng ký
4. ✅ `app/scanner/page.tsx` - Sử dụng `decryptRegistration()` để giải mã khi quét QR
5. ✅ `app/seats/page.tsx` - Sử dụng `decryptRegistration()` để giải mã thông tin ghế

## Kiểm tra

Sau khi restart server, kiểm tra:

1. **Console Logs**: Mở Developer Tools và kiểm tra console
   - Nếu thấy warning về ENCRYPTION_KEY không có sẵn, đó là bình thường ở client-side
   - API route sẽ tự động được gọi để giải mã

2. **Network Tab**: Kiểm tra requests đến `/api/decrypt`
   - Nếu thấy requests này, nghĩa là code đang hoạt động đúng
   - Response sẽ chứa dữ liệu đã được giải mã

3. **Hiển thị dữ liệu**: 
   - Dữ liệu trong bảng phải hiển thị dạng plain text (tên, email, số điện thoại)
   - Không còn hiển thị các chuỗi mã hóa dài

## Troubleshooting

### Vấn đề: Dữ liệu vẫn hiển thị dạng mã hóa

**Nguyên nhân có thể:**
1. Server chưa được restart sau khi thêm ENCRYPTION_KEY
2. ENCRYPTION_KEY khác nhau giữa hai project
3. API route bị lỗi authentication

**Giải pháp:**
1. Restart cả hai server (workshop-user và workshop-staff)
2. Kiểm tra ENCRYPTION_KEY trong cả hai `.env.local` phải giống nhau
3. Kiểm tra console logs để xem lỗi cụ thể
4. Kiểm tra Network tab để xem API `/api/decrypt` có được gọi và response như thế nào

### Vấn đề: Lỗi "Failed to decrypt data"

**Nguyên nhân:**
- ENCRYPTION_KEY không đúng
- Dữ liệu được mã hóa bằng key khác

**Giải pháp:**
- Đảm bảo ENCRYPTION_KEY giống nhau ở cả hai project
- Nếu dữ liệu cũ được mã hóa bằng key khác, cần giải mã lại bằng key cũ rồi mã hóa lại bằng key mới

## Lưu ý bảo mật

⚠️ **QUAN TRỌNG:**
- `ENCRYPTION_KEY` là thông tin nhạy cảm
- **KHÔNG** commit file `.env.local` vào Git
- **KHÔNG** expose `ENCRYPTION_KEY` ra client-side
- Backup key ở nơi an toàn
- Nếu mất key, dữ liệu đã mã hóa sẽ **KHÔNG THỂ** giải mã được

## Production

Khi deploy lên production (Vercel, etc.):

1. Thêm `ENCRYPTION_KEY` vào Environment Variables trong dashboard
2. Đảm bảo cả hai project (user và staff) sử dụng cùng một key
3. Không sử dụng `NEXT_PUBLIC_ENCRYPTION_KEY` (không an toàn)


