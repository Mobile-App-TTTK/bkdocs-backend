import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Hàm đọc biến môi trường (ưu tiên Docker secrets)
function getEnv(key: string, defaultValue?: string): string | undefined {
  const filePath = process.env[`${key}`]; // VD: DATABASE_PASSWORD_FILE=/run/secrets/db_password
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8').trim();
  }
  return process.env[key] || defaultValue;
}

// Load .env theo NODE_ENV (vd: .env.development, .env.production)
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
config({ path: envFile });

const isProd = process.env.NODE_ENV === 'production';

export default new DataSource({
  type: 'postgres',
  host: getEnv('DATABASE_HOST', 'localhost'),
  port: Number(getEnv('DATABASE_PORT', '5432')),
  username: getEnv('DATABASE_USER', 'mobileuser'),
  password: getEnv('DATABASE_PASSWORD', 'mobilepass'),
  database: getEnv('DATABASE_NAME', 'mobileappdb'),

  // Prod dùng file build (dist), Dev dùng src
  entities: isProd
    ? [path.join(__dirname, '/**/*.entity.{js,ts}')]
    : ['src/**/*.entity.ts'],
  migrations: isProd
    ? [path.join(__dirname, '/migrations/*.{js,ts}')]
    : ['src/migrations/*.ts'],

  synchronize: false, // KHÔNG bao giờ bật trong prod
  logging: !isProd, // log khi dev
});
