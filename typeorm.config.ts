import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { User } from '@modules/users/entities/user.entity';
import { Document } from '@modules/documents/entities/document.entity';
import { Rating } from '@modules/ratings/entities/rating.entity';
import { Subject } from '@modules/documents/entities/subject.entity';
import { Faculty } from '@modules/documents/entities/falcuty.entity';
import { Notification } from '@modules/notifications/entities/notification.entity';
import { Comment } from '@modules/comments/entities/comment.entity';
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
  entities: ['src/**/*.entity.ts'],
  // entities: [
  //   User,
  //   Document,
  //   Rating,
  //   Subject,
  //   Faculty,
  //   Notification,
  //   Comment,
  // ],
  migrations: isProd ? [path.join(__dirname, 'src/migrations/*.{js,ts}')] : ['src/migrations/*.ts'],
  synchronize: false, // KHÔNG bao giờ bật trong prod
  logging: !isProd, // log khi dev
});
