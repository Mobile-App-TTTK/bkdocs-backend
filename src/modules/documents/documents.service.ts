import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { Subject } from './entities/subject.entity';
import { Faculty } from './entities/falcuty.entity';
import { DetailsDocumentResponseDto } from './dtos/responses/detailsDocument.response.dto';
import { SearchDocumentsDto } from './dtos/responses/search-documents.dto';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(Faculty)
    private readonly facultyRepo: Repository<Faculty>,
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

  async suggest(keyword: string): Promise<string[]> {
    const kw = keyword.trim();
    if (kw.length < 2) return [];

    const [docs, subs, facs] = await Promise.all([
      this.documentRepo.find({
        select: ['id', 'title'],
        where: { title: ILike(`%${kw}%`) },
        take: 5,
        order: { title: 'ASC' },
      }),

      this.subjectRepo.find({
        select: ['id', 'name'],
        where: { name: ILike(`%${kw}%`) },
        take: 5,
        order: { name: 'ASC' },
      }),

      this.facultyRepo.find({
        select: ['id', 'name'],
        where: { name: ILike(`%${kw}%`) },
        take: 5,
        order: { name: 'ASC' },
      }),
    ]);

    type Hit = { name: string };
    const hits: Hit[] = [
      ...docs.map(d => ({ name: d.title })),
      ...subs.map(s => ({ name: s.name })),
      ...facs.map(f => ({ name: f.name })),
    ];

    const score = (name: string) => {
      const n = name.toLowerCase();
      const k = kw.toLowerCase();
      const pos = n.indexOf(k);
      const posScore = pos === -1 ? 999 : pos;          
      const lenPenalty = Math.abs(n.length - k.length);
      return posScore * 1000 + lenPenalty;
    };

    hits.sort((a, b) => score(a.name) - score(b.name));

    return hits.slice(0, 5).map(h => h.name);
  }
}
