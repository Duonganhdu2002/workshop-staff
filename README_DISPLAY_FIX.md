# Fix Hiển thị Dữ liệu - Không Mã hóa cho Người dùng

## Vấn đề
Dữ liệu đang hiển thị dạng mã hóa (encrypted) thay vì thông tin thực tế cho người dùng.

## Giải pháp đã triển khai

### 1. Tạo hàm `safeDecrypt` trong `lib/security.ts`
- Tự động phát hiện dữ liệu có bị mã hóa không
- Decrypt nếu cần, giữ nguyên nếu không phải encrypted
- An toàn - không throw error nếu decrypt fail

### 2. Cập nhật `app/page.tsx`
- Decrypt dữ liệu name, email, phone trước khi hiển thị
- Đảm bảo người dùng luôn thấy thông tin gốc (plain text)

### 3. Cập nhật `app/scanner/page.tsx`
- Decrypt dữ liệu khi fetch từ database
- Hiển thị thông tin khách hàng đúng định dạng

### 4. Cập nhật `app/seats/page.tsx`
- Decrypt registration data khi hiển thị trong seat management

## Nguyên tắc

**QUAN TRỌNG**: 
- ✅ **KHÔNG mã hóa dữ liệu khi hiển thị cho người dùng**
- ✅ **Luôn decrypt dữ liệu trước khi hiển thị**
- ✅ **Dữ liệu trong database có thể được mã hóa để bảo mật**
- ✅ **Nhưng khi hiển thị cho người dùng, phải là plain text**

## Cách sử dụng

```typescript
import { safeDecrypt } from '@/lib/security'

// Khi fetch dữ liệu từ database
const data = await fetchFromDatabase()

// Decrypt trước khi hiển thị
const displayData = {
  ...data,
  name: safeDecrypt(data.name),
  email: safeDecrypt(data.email),
  phone: safeDecrypt(data.phone),
}
```

## Lưu ý

- Hàm `safeDecrypt` tự động phát hiện dữ liệu có bị mã hóa không
- Nếu không phải encrypted format, sẽ trả về giá trị gốc
- Nếu decrypt fail, sẽ trả về giá trị gốc (không throw error)
- Đảm bảo hiển thị luôn an toàn và không crash

