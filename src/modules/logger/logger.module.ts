import { Global, Module, Logger } from '@nestjs/common';
import { AppLoggerService } from './logger.service';

@Global() //    để module này dùng được ở mọi nơi
@Module({
  providers: [
    {
      provide: Logger,
      useClass: AppLoggerService,
    },
  ],
  exports: [Logger], //  export để module khác dùng
})
export class LoggerModule {}
