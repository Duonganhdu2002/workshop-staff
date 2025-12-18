# Cập nhật Giải mã Dữ liệu User

## Vấn đề

Hệ thống user (`workshop-user`) và hệ thống staff (`workshop-staff`) sử dụng hai format mã hóa khác nhau:

1. **User format**: `salt:iv:tag:encryptedData` (4 parts)
   - Sử dụng PBKDF2 với salt để derive key
   - Salt length: 64 bytes (512 bits)
   - IV length: 16 bytes (128 bits)
   - Tag length: 16 bytes (128 bits)

2. **Staff format**: `iv:authTag:encrypted` (3 parts)
   - Sử dụng scryptSync với fixed salt
   - IV length: 16 bytes (128 bits)

Staff không thể giải mã dữ liệu từ user vì format khác nhau.

## Giải pháp

Đã cập nhật hàm `safeDecrypt` trong `workshop-staff/lib/security.ts` để:

1. **Tự động phát hiện format**: Kiểm tra số lượng parts (3 hoặc 4) để xác định format
2. **Hỗ trợ cả hai format**: 
   - Format 4 parts (user): Sử dụng hàm `decryptUserFormat` với PBKDF2
   - Format 3 parts (staff): Sử dụng hàm `decryptData` với scryptSync
3. **An toàn**: Nếu giải mã thất bại, trả về giá trị gốc thay vì throw error

## Thay đổi chi tiết

### 1. Cập nhật `isEncrypted()`
- Nhận diện cả format 3 parts và 4 parts
- Kiểm tra tất cả parts đều là hex string

### 2. Thêm hàm `decryptUserFormat()`
- Giải mã format của user: `salt:iv:tag:encryptedData`
- Sử dụng PBKDF2 với salt để derive key (giống user system)
- Sử dụng cùng logic lấy encryption key như user system

### 3. Cập nhật `safeDecrypt()`
- Tự động phát hiện format dựa trên số lượng parts
- Thử giải mã format user trước (4 parts)
- Nếu thất bại, thử format staff (3 parts)
- Trả về giá trị gốc nếu cả hai đều thất bại

## Yêu cầu

**QUAN TRỌNG**: Cả hai hệ thống (`workshop-user` và `workshop-staff`) phải sử dụng **CÙNG MỘT** `ENCRYPTION_KEY` trong biến môi trường.

### Cấu hình

Đảm bảo cả hai hệ thống có cùng `ENCRYPTION_KEY` trong `.env.local`:

```env
# workshop-user/.env.local
ENCRYPTION_KEY=your-64-character-hex-key-here

# workshop-staff/.env.local  
ENCRYPTION_KEY=your-64-character-hex-key-here
```

Hoặc nếu sử dụng chuỗi (không phải hex):
```env
ENCRYPTION_KEY=your-strong-random-string-here
```

## Cách hoạt động

1. Khi staff fetch dữ liệu từ database, dữ liệu có thể ở một trong hai format
2. Hàm `safeDecrypt()` tự động phát hiện format:
   - Nếu có 4 parts → giải mã bằng `decryptUserFormat()` (user format)
   - Nếu có 3 parts → giải mã bằng `decryptData()` (staff format)
   - Nếu không phải encrypted → trả về giá trị gốc
3. Staff luôn thấy thông tin đã được giải mã (plain text)

## Các nơi đã sử dụng

Hàm `safeDecrypt()` đã được sử dụng tại:
- ✅ `app/page.tsx` - Danh sách đăng ký
- ✅ `app/scanner/page.tsx` - Quét QR code
- ✅ `app/seats/page.tsx` - Quản lý ghế

Tất cả các nơi này sẽ tự động hỗ trợ cả hai format sau khi cập nhật.

## Lưu ý

- Nếu `ENCRYPTION_KEY` khác nhau giữa hai hệ thống, staff sẽ không thể giải mã dữ liệu từ user
- Đảm bảo backup `ENCRYPTION_KEY` ở nơi an toàn
- Không commit `ENCRYPTION_KEY` vào Git
- Trong production, đảm bảo cả hai hệ thống sử dụng cùng key



