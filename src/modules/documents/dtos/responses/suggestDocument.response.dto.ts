export class SuggestDocumentResponseDto {
  id: string;
  title: string;
  faculty: string;
  subject: string;
  uploadDate: Date;
  downloadCount: number;
  constructor(partial: Partial<SuggestDocumentResponseDto>) {
    Object.assign(this, partial);
  }
}
