import { IsString } from 'class-validator';

export class DownloadDocumentUrlResponseDto {
  constructor(partial: Partial<DownloadDocumentUrlResponseDto>) {
    Object.assign(this, partial);
  }
  @IsString()
  url: string;
}