import { Module } from '@nestjs/common';
import { RatesController } from './ratings.controller';
import { RatesService } from './ratings.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rating } from './entities/rating.entity';
import { Type } from 'class-transformer';

@Module({
  controllers: [RatesController],
  providers: [RatesService],
  imports: [TypeOrmModule.forFeature([Rating])],
})
export class RatesModule {}
