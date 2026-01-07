# Cấu hình Sentry cho Backend NestJS

## Hướng dẫn thiết lập Sentry

### 1. Tạo tài khoản và dự án Sentry

1. Truy cập [https://sentry.io](https://sentry.io) và đăng ký tài khoản
2. Tạo một dự án mới cho Node.js/NestJS
3. Lấy DSN (Data Source Name) từ Settings > Projects > [Your Project] > Client Keys (DSN)

### 2. Cấu hình biến môi trường

Thêm các biến sau vào file `.env`:

```env
SENTRY_DSN=https://your-key@sentry.io/your-project-id
NODE_ENV=production  # hoặc development, staging
```

### 3. Các tính năng đã được cài đặt

- ✅ **Error Tracking**: Tự động capture tất cả các exceptions và errors
- ✅ **Performance Monitoring**: Theo dõi performance của ứng dụng
- ✅ **Profiling**: Phân tích hiệu suất chi tiết
- ✅ **Custom Interceptor**: Tự động bắt lỗi từ tất cả các requests

### 4. Cách sử dụng

#### Tự động capture errors

Tất cả các errors trong ứng dụng sẽ tự động được gửi lên Sentry thông qua `SentryInterceptor`.

#### Capture errors thủ công

```typescript
import * as Sentry from '@sentry/node';

// Capture exception
try {
  // your code
} catch (error) {
  Sentry.captureException(error);
}

// Capture message
Sentry.captureMessage('Something went wrong');

// Add context
Sentry.setContext('character', {
  name: 'User Name',
  id: '123',
});

// Add tags
Sentry.setTag('page_locale', 'vi-VN');

// Add user
Sentry.setUser({
  id: '123',
  email: 'user@example.com',
  username: 'user123',
});
```

### 5. Điều chỉnh sample rates cho production

Trong file [main.ts](src/main.ts), bạn nên điều chỉnh các sample rates cho production:

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [new ProfilingIntegration()],
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in production
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.NODE_ENV || 'development',
});
```

### 6. Kiểm tra cài đặt

Để test xem Sentry đã hoạt động chưa, bạn có thể thêm endpoint test trong controller:

```typescript
@Get('test-sentry')
testSentry() {
  throw new Error('Test Sentry Error!');
}
```

Sau đó truy cập endpoint này và kiểm tra trên dashboard Sentry.

### 7. Best Practices

- **Không log thông tin nhạy cảm**: Cấu hình beforeSend để filter data
- **Sử dụng breadcrumbs**: Để theo dõi user actions trước khi error xảy ra
- **Thiết lập alerts**: Cấu hình alerts trên Sentry dashboard
- **Release tracking**: Gắn version/release cho mỗi deployment
- **Environment separation**: Sử dụng các environments khác nhau (dev, staging, prod)

### 8. Cấu hình nâng cao (Optional)

Thêm vào [main.ts](src/main.ts):

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [new ProfilingIntegration()],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.npm_package_version, // Track releases
  beforeSend(event, hint) {
    // Filter sensitive data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers?.authorization;
    }
    return event;
  },
  ignoreErrors: [
    // Add patterns for errors to ignore
    'Non-Error exception captured',
  ],
});
```

## Tài liệu tham khảo

- [Sentry Node.js Documentation](https://docs.sentry.io/platforms/node/)
- [Sentry NestJS Integration](https://docs.sentry.io/platforms/node/guides/nestjs/)
