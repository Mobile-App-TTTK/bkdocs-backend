import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RatesService } from './ratings.service';
import { ApiTags, ApiOkResponse, ApiOperation, ApiQuery, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewItemDto } from './dtos/review-item.dto';
import { ReviewScoreFilter } from './dtos/reviews.query.dto';
import { CreateReviewDto } from './dtos/create-review.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/role.guard';

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
    @ApiQuery({name: 'score', required: false, enum: ReviewScoreFilter})
    async getAllDocument(@Param('id') id: string, @Query('score') score?: string) : Promise<ReviewItemDto[]> {
        if (!id) throw new BadRequestException('documentId (param :id) is required');

        const parsed = score !== undefined ? Number(score) : undefined;

        if (parsed !== undefined && ![1, 2, 3, 4, 5].includes(parsed)) {
            throw new BadRequestException('score must be one of 1,2,3,4,5');
        }

        return this.ratesService.getAllDocument({ documentId: id, score: parsed as any });
    }

    @Post('document/:documentId')
    @ApiOperation({ summary: 'Tạo/cập nhật đánh giá và thêm nhận xét cho tài liệu' })
    @ApiParam({ name: 'documentId', description: 'ID tài liệu'})
    @ApiBody({ type: CreateReviewDto })
    async createReview(@Param('documentId') documentId: string, @Body() dto: CreateReviewDto, @Req() req: any) : Promise<void> {
        await this.ratesService.createOrUpdateRatingAndComment(documentId, (req as any).user.userId, dto);
    }
}
