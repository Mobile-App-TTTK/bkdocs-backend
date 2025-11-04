import {
  BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards, UploadedFile, UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RatesService } from './ratings.service';
import { ApiTags, ApiOkResponse, ApiOperation, ApiQuery, ApiParam, ApiBody, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ReviewItemDto } from './dtos/review-item.dto';
import { ReviewScoreFilter } from './dtos/reviews.query.dto';
import { CreateReviewDto } from './dtos/create-review.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/role.guard';
import { LimitedReviewItemDto } from './dtos/limited-review-item.dto';

@ApiTags('rates')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Get('counts')
  @ApiOperation({ summary: 'Đánh giá và số lượng' })
  @ApiOkResponse({ description: 'List các cặp score và số lượng', type: [Object] })
  async getScoreCounts() {
    return this.ratesService.getScoreCounts();
  }

  @Get('document/:id')
  @ApiOperation({ summary: 'Get đánh giá và nhận xét' })
  @ApiOkResponse({ type: [ReviewItemDto] })
  @ApiQuery({ name: 'score', required: false, enum: ReviewScoreFilter })
  async getAllDocument(@Param('id') id: string, @Query('score') score?: string): Promise<ReviewItemDto[]> {
    if (!id) throw new BadRequestException('documentId (param :id) is required');
    const parsed = score !== undefined ? Number(score) : undefined;
    if (parsed !== undefined && ![1, 2, 3, 4, 5].includes(parsed)) {
      throw new BadRequestException('score must be one of 1,2,3,4,5');
    }
    return this.ratesService.getAllDocument({ documentId: id, score: parsed as any });
  }

  @Post('document/:documentId')
  @ApiOperation({ summary: 'Tạo/cập nhật đánh giá và thêm nhận xét cho tài liệu (kèm ảnh)' })
  @ApiParam({ name: 'documentId', description: 'ID tài liệu' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        score: { type: 'number', example: 5 },
        content: { type: 'string', example: 'Tài liệu rất hữu ích!' },
        image: { type: 'string', format: 'binary', description: 'Ảnh đính kèm bình luận (tuỳ chọn)' },
      },
      required: ['score', 'content'],
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  async createReview(
    @Param('documentId') documentId: string,
    @Body() dto: CreateReviewDto,
    @UploadedFile() image: Express.Multer.File | undefined,
    @Req() req: any
  ): Promise<void> {
    await this.ratesService.createOrUpdateRatingAndComment(documentId, (req as any).user.userId, dto, image);
  }

  @Get('document/:id/top')
  @ApiOperation({ summary: 'Lấy k đánh giá+bình luận gần nhất của tài liệu' })
  @ApiParam({ name: 'id', description: 'ID tài liệu' })
  @ApiQuery({ name: 'k', required: false, description: 'Số item cần lấy (mặc định 10, tối đa 100)' })
  @ApiQuery({ name: 'score', required: false, description: 'Lọc theo điểm 1..5' })
  @ApiOkResponse({ type: [LimitedReviewItemDto] })
  async getTopKDocumentReviews(@Param('id') id: string, @Query('k') k?: string, @Query('score') score?: string,) : Promise<LimitedReviewItemDto[]> {
    if (!id) throw new BadRequestException('documentId is required');

    const limitRaw = Number.isFinite(Number(k)) ? Number(k) : 10;
    const limit = Math.max(1, Math.min(100, limitRaw)); 

    const scoreParsed = score !== undefined ? Number(score) : undefined;
    if (scoreParsed !== undefined && ![1, 2, 3, 4, 5].includes(scoreParsed)) {
      throw new BadRequestException('score must be one of 1, 2, 3, 4, 5');
    }

    return this.ratesService.getTopKDocumentReviews({
      documentId: id,
      k: limit,
      score: scoreParsed as any,
    });
  }
}