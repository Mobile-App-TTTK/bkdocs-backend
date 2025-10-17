import { ApiProperty } from '@nestjs/swagger';

export class SuggestDocumentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  uploadDate: Date;

  @ApiProperty()
  downloadCount: number;
  constructor(partial: Partial<SuggestDocumentResponseDto>) {
    Object.assign(this, partial);
  }
}

export class SuggestDocumentsResponseDto {
  @ApiProperty({ type: [SuggestDocumentResponseDto] })
  documents: SuggestDocumentResponseDto[];
  constructor(partial: Partial<SuggestDocumentsResponseDto>) {
    Object.assign(this, partial);
  }
}
