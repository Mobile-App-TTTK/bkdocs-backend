// typeorm.config.js
const path = require('path');
const fs = require('fs');
const { DataSource } = require('typeorm');
require('dotenv').config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

// helper đọc secret file
function getEnv(key, defaultValue) {
  const filePath = process.env[`${key}_FILE`];
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8').trim();
  }
  return process.env[key] || defaultValue;
}

const isProd = process.env.NODE_ENV === 'production';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: getEnv('DATABASE_HOST', 'localhost'),
  port: Number(getEnv('DATABASE_PORT', '5432')),
  username: getEnv('DATABASE_USER', 'mobileuser'),
  password: getEnv('DATABASE_PASSWORD', 'mobilepass'),
  database: getEnv('DATABASE_NAME', 'mobileappdb'),

  entities: isProd
    ? [path.join(__dirname, 'dist/**/*.entity.js')]
    : ['src/**/*.entity.ts'],
  migrations: isProd
    ? [path.join(__dirname, 'dist/migrations/*.js')]
    : ['src/migrations/*.ts'],

  synchronize: false,
  logging: !isProd,
});

// 👉 Bắt buộc export DataSource
module.exports = AppDataSource;
