import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as fs from 'fs';

// Ưu tiên đọc biến từ file _FILE (khi dùng Docker secrets)
function getEnv(key: string, defaultValue?: string): string | undefined {
  const fileKey = process.env[`${key}_FILE`];
  if (fileKey && fs.existsSync(fileKey)) {
    return fs.readFileSync(fileKey, 'utf8').trim();
  }
  return process.env[key] || defaultValue;
}

// Load .env.* (tự detect NODE_ENV)
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
config({ path: envFile });

export default new DataSource({
  type: 'postgres',
  host: getEnv('DATABASE_HOST', 'localhost'),
  port: Number(getEnv('DATABASE_PORT', '5432')),
  username: getEnv('DATABASE_USER', 'postgres'),
  password: getEnv('DATABASE_PASSWORD', 'postgres'),
  database: getEnv('DATABASE_NAME', 'appdb'),
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false, // KHÔNG bật trong production
  logging: true,
});
