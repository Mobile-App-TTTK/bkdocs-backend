# Hướng dẫn fix lỗi Jest "Worker process failed to exit gracefully"

## Lỗi là gì?

Lỗi này xảy ra khi Jest không thể tắt worker process vì có **resources chưa được giải phóng**:

- Database connections (TypeORM)
- WebSocket/Socket.io connections
- HTTP servers
- Timers/Intervals
- Firebase connections

## Các giải pháp đã áp dụng:

### 1. Cấu hình Jest với forceExit

Trong [package.json](package.json):

```json
"jest": {
  "forceExit": true,
  "detectOpenHandles": false,
  "testTimeout": 10000
}
```

- `forceExit`: Bắt buộc thoát sau khi test xong
- `detectOpenHandles`: Tắt để không hiện warning (bật khi debug)
- `testTimeout`: Tăng timeout lên 10s

### 2. Đóng TestingModule sau mỗi test

Trong các file `.spec.ts`:

```typescript
describe('YourController', () => {
  let controller: YourController;
  let app: TestingModule;

  beforeEach(async () => {
    app = await Test.createTestingModule({
      controllers: [YourController],
      providers: [YourService],
    }).compile();

    controller = app.get<YourController>(YourController);
  });

  // ✅ QUAN TRỌNG: Đóng module sau mỗi test
  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
```

### 3. Mock các services có external connections

Mock TypeORM repositories, Firebase, S3, etc.:

```typescript
beforeEach(async () => {
  const app = await Test.createTestingModule({
    controllers: [YourController],
    providers: [
      YourService,
      {
        provide: getRepositoryToken(YourEntity),
        useValue: {
          find: jest.fn(),
          findOne: jest.fn(),
          save: jest.fn(),
        },
      },
      {
        provide: 'FIREBASE_ADMIN',
        useValue: {
          messaging: jest.fn(),
        },
      },
    ],
  }).compile();
});
```

## Debug chi tiết với detectOpenHandles

Để tìm đúng nguồn gốc vấn đề:

```bash
npm test -- --detectOpenHandles
```

Hoặc thêm vào script:

```json
"scripts": {
  "test:debug": "jest --detectOpenHandles --runInBand"
}
```

## Các patterns cần tránh:

❌ **KHÔNG làm:**

```typescript
beforeEach(async () => {
  const app = await Test.createTestingModule({...}).compile();
  const controller = app.get<Controller>(Controller);
  // Không đóng app!
});
```

✅ **NÊN làm:**

```typescript
let app: TestingModule;

beforeEach(async () => {
  app = await Test.createTestingModule({...}).compile();
});

afterEach(async () => {
  await app.close(); // Đóng connections
});
```

## E2E Tests

Với e2e tests, cần đóng app và server:

```typescript
describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200);
  });
});
```

## Kiểm tra lại

Sau khi áp dụng các fixes, chạy:

```bash
npm test
```

Nếu vẫn còn warning, chạy với detectOpenHandles để debug:

```bash
npm test -- --detectOpenHandles --runInBand
```
