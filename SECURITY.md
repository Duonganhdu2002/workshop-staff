# Security Implementation Guide

## Tổng quan về Bảo mật

Ứng dụng đã được nâng cấp với các biện pháp bảo mật mạnh mẽ để chống lại các cuộc tấn công phổ biến.

## Các Tính năng Bảo mật Đã Triển khai

### 1. Password Security
- ✅ **Bcrypt Hashing**: Tất cả mật khẩu được hash bằng bcrypt với 12 salt rounds
- ✅ **Password Migration**: Script migration tự động chuyển đổi mật khẩu plain text sang hash
- ✅ **Password Validation**: Kiểm tra độ mạnh mật khẩu (độ dài, ký tự đặc biệt, v.v.)

### 2. Authentication & Authorization
- ✅ **JWT Tokens**: Sử dụng JSON Web Tokens cho session management
- ✅ **httpOnly Cookies**: Tokens được lưu trong httpOnly cookies để chống XSS
- ✅ **Server-side Authentication**: Tất cả API routes được bảo vệ bằng authentication middleware
- ✅ **Session Expiration**: Tokens tự động hết hạn sau 24 giờ

### 3. Rate Limiting
- ✅ **Login Rate Limiting**: Giới hạn 5 lần đăng nhập mỗi phút
- ✅ **API Rate Limiting**: Giới hạn 100 requests mỗi phút cho API calls
- ✅ **IP-based Tracking**: Rate limiting dựa trên IP address

### 4. Input Validation & Sanitization
- ✅ **Input Sanitization**: Tất cả user input được sanitize
- ✅ **Email Validation**: Kiểm tra format email hợp lệ
- ✅ **Length Limits**: Giới hạn độ dài input để chống DoS
- ✅ **SQL Injection Protection**: Sử dụng Supabase ORM để tránh SQL injection

### 5. CSRF Protection
- ✅ **CSRF Tokens**: Tạo và validate CSRF tokens cho các form submissions
- ✅ **SameSite Cookies**: Cookies được set với SameSite=strict

### 6. Data Encryption
- ✅ **AES-256-GCM Encryption**: Mã hóa dữ liệu nhạy cảm với AES-256-GCM
- ✅ **Secure Key Management**: Encryption keys được quản lý an toàn

### 7. Security Headers
- ✅ **X-Content-Type-Options**: Ngăn MIME type sniffing
- ✅ **X-Frame-Options**: Ngăn clickjacking
- ✅ **X-XSS-Protection**: Bảo vệ chống XSS
- ✅ **Content-Security-Policy**: Giới hạn các nguồn tài nguyên được phép
- ✅ **Referrer-Policy**: Kiểm soát thông tin referrer

### 8. Error Handling
- ✅ **Generic Error Messages**: Không tiết lộ thông tin nhạy cảm trong error messages
- ✅ **Error Logging**: Log chi tiết ở server-side để debugging

## Cấu hình Môi trường

Thêm các biến môi trường sau vào `.env.local`:

```env
# JWT Secret (bắt buộc - tạo một secret mạnh)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Encryption Key (bắt buộc - tạo một key mạnh)
ENCRYPTION_KEY=your-32-character-encryption-key

# Cron Secret (cho cron jobs)
CRON_SECRET=your-cron-secret-key

# Supabase (đã có)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Tạo Keys Mạnh

```bash
# JWT Secret (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Encryption Key (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Cron Secret (32 characters)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

## Migration Passwords

Chạy script migration để hash tất cả mật khẩu hiện tại:

```bash
# Cài đặt dependencies nếu chưa có
npm install

# Chạy migration script
npx ts-node scripts/migrate-passwords.ts
```

**Lưu ý**: Script này sẽ tự động hash tất cả mật khẩu plain text trong database. Đảm bảo bạn đã backup database trước khi chạy.

## API Security

### Protected Endpoints

Tất cả các endpoints sau yêu cầu authentication:
- `/api/send-qr` (POST)
- `/api/test-email` (GET)
- `/api/auth/verify` (GET)
- `/api/auth/csrf` (GET)

### Public Endpoints

Các endpoints sau không yêu cầu authentication (nhưng có rate limiting):
- `/api/auth/login` (POST) - Rate limit: 5 requests/minute
- `/api/auth/logout` (POST)

### Cron Endpoints

- `/api/check-expired-seats` (GET) - Yêu cầu CRON_SECRET hoặc staff authentication

## Best Practices

### 1. Password Management
- Không bao giờ lưu mật khẩu plain text
- Sử dụng password manager để tạo mật khẩu mạnh
- Thay đổi mật khẩu định kỳ

### 2. Environment Variables
- Không commit `.env.local` vào git
- Sử dụng secrets management trong production
- Rotate keys định kỳ

### 3. Monitoring
- Monitor failed login attempts
- Log tất cả authentication events
- Set up alerts cho suspicious activities

### 4. Updates
- Cập nhật dependencies thường xuyên
- Review security patches
- Test sau mỗi lần cập nhật

## Security Checklist

Trước khi deploy production:

- [ ] Đã set JWT_SECRET mạnh
- [ ] Đã set ENCRYPTION_KEY mạnh
- [ ] Đã set CRON_SECRET
- [ ] Đã chạy password migration script
- [ ] Đã test authentication flow
- [ ] Đã test rate limiting
- [ ] Đã test CSRF protection
- [ ] Đã review error messages
- [ ] Đã enable HTTPS
- [ ] Đã set up monitoring

## Reporting Security Issues

Nếu bạn phát hiện lỗ hổng bảo mật, vui lòng:
1. Không công khai lỗ hổng
2. Liên hệ trực tiếp với team phát triển
3. Cung cấp thông tin chi tiết về lỗ hổng

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)


