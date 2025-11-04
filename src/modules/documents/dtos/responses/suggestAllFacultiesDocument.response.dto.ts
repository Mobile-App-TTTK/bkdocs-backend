import { ApiProperty } from '@nestjs/swagger';
import { DocumentResponseDto } from './document.response.dto';

export class SuggestAllFacultiesDocumentsResponseDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  facultyId: string;

  @ApiProperty({ example: 'Khoa máy tính' })
  facultyName: string;

  @ApiProperty({ type: [DocumentResponseDto] })
  documents: DocumentResponseDto[];
  constructor(partial: Partial<SuggestAllFacultiesDocumentsResponseDto>) {
    Object.assign(this, partial);
  }
}
