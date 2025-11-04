import { ApiProperty } from '@nestjs/swagger';

export class AllFacultiesAndSubjectsAndDocumentTypesDto {
  @ApiProperty({ type: [Object], example: [{ id: 'fac1', name: 'Faculty of Science' }] })
  faculties: { id: string; name: string }[];
  @ApiProperty({ type: [Object], example: [{ id: 'sub1', name: 'Mathematics' }] })
  subjects: { id: string; name: string }[];

  @ApiProperty({ type: [Object], example: [{ id: 'dt1', name: 'lecture' }] })
  documentTypes: { id: string; name: string }[];
  constructor(partial: Partial<AllFacultiesAndSubjectsAndDocumentTypesDto>) {
    Object.assign(this, partial);
  }
}
