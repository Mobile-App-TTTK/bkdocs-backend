import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { RolesGuard } from '@common/guards/role.guard';
import { DocumentsModule } from './modules/documents/documents.module';
import { CommentsModule } from './modules/comments/comments.module';
import { RatesModule } from './modules/ratings/ratings.module';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,            // dùng ở mọi nơi không cần import lại
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

    CommentsModule,

    RatesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
  ],
})
export class AppModule {
    constructor(private dataSource: DataSource) {
    console.log('✅ Connected entities:', this.dataSource.entityMetadatas.map(m => m.name));
  }
}
