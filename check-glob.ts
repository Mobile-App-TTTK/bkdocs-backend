import * as fg from 'fast-glob';

(async () => {
  const files = await fg(['src/**/*.entity.ts']); // 👈 thay pattern bạn muốn kiểm tra
  console.log('🔍 Found entities:', files);
})();
