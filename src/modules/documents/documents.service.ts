import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { DetailsDocumentResponseDto } from './dtos/responses/detailsDocument.response.dto';
import { SearchDocumentsDto } from './dtos/responses/search-documents.dto';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
  ) {}
  
  async search(q: SearchDocumentsDto): Promise<(Document & { rank?: number })[]> {
    console.log('Repo tablePath:', this.documentRepo.metadata.tablePath);

    const qb = this.documentRepo
        .createQueryBuilder('d')
        .leftJoinAndSelect('d.subject', 'subject')
        .leftJoinAndSelect('d.faculty', 'faculty');
  
    const orPredicates: string[] = [];
    const params: Record<string, any> = {};

    if (q.faculty && q.faculty.trim()) {
        params.facultyName = `%${q.faculty.trim()}%`;
        orPredicates.push('LOWER(faculty.name) LIKE LOWER(:facultyName)');
    }

    if (q.subject && q.subject.trim()) {
        params.subjectName =`%${q.subject.trim()}%`;
        orPredicates.push('LOWER(subject.name) = LOWER(:subjectName)');
    }

    if (q.keyword && q.keyword.trim()) {
      params.kw = `%${q.keyword.trim()}%`;
      orPredicates.push(
        '(LOWER(d.title) LIKE LOWER(:kw) OR LOWER(d.description) LIKE LOWER(:kw) OR LOWER(d.file_key) LIKE LOWER(:kw))'
      );
    }

    if (orPredicates.length > 0) {
      qb.where(orPredicates.shift()!, params);
      for (const p of orPredicates) qb.orWhere(p, params);
    }

    return qb.getMany();
  }
}
