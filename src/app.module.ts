import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@modules/auth/auth.module';
import { RatesModule } from '@modules/ratings/ratings.module';
import { DataSource } from 'typeorm';
import { S3Module } from '@modules/s3/s3.module';
import { DocumentsModule } from '@modules/documents/documents.module';
import { CommentsModule } from '@modules/comments/comments.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // dùng ở mọi nơi không cần import lại
    }),

    // Type orm config
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DATABASE_HOST'),
        port: config.get<number>('DATABASE_PORT'),
        username: config.get<string>('DATABASE_USER'),
        password: config.get<string>('DATABASE_PASSWORD'),
        database: config.get<string>('DATABASE_NAME'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),

    AuthModule,

    DocumentsModule,

    RatesModule,

    S3Module,
    DocumentsModule,
    CommentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  constructor(private dataSource: DataSource) {
    console.log(
      '✅ Connected entities:',
      this.dataSource.entityMetadatas.map((m) => m.name)
    );
  }
}
