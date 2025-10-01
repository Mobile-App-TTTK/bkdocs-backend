import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from '@common/filters/http-exception.filter';
import { TransformInterceptor } from '@common/interceptors/transform.interceptor';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    // Swagger config
  const config = new DocumentBuilder()
    .setTitle(' Mobile App API - Quản lý tài liệu học tập')
    .setDescription(`
      API cho ứng dụng mobile quản lý tài liệu học tập của sinh viên Đại học Bách Khoa.  
    `)
    .setVersion('1.0.0')
    .addBearerAuth(
      { 
        type: 'http', 
        scheme: 'bearer', 
        bearerFormat: 'JWT', 
        name: 'JWT', 
        in: 'header', 
        description: 'Nhập JWT token' 
      },
      'JWT-auth', // tên schema
    )

    .build();


  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  await app.listen(process.env.PORT ?? 8080);
  console.log(`Server running on http://localhost:${process.env.PORT}`);
  console.log(`Swagger docs on http://localhost:${process.env.PORT}/api-docs`);
}
bootstrap();
