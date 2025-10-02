import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

config(); // load .env

// Chọn entities và migrations path khác nhau cho dev/prod
const isProd = process.env.NODE_ENV === 'production';

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: isProd
    ? [path.join(__dirname, '/**/*.entity.{js,ts}')] // dist
    : ['src/**/*.entity.ts'], // dev
  migrations: isProd
    ? [path.join(__dirname, '/migrations/*.{js,ts}')]
    : ['src/migrations/*.ts'],
});
