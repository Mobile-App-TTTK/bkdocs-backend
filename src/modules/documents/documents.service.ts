import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, ILike, Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { Subject } from './entities/subject.entity';
import { Faculty } from './entities/falcuty.entity';
import { DetailsDocumentResponseDto } from './dtos/responses/detailsDocument.response.dto';
import { SearchDocumentsDto } from './dtos/responses/search-documents.dto';
import { S3Service } from '@modules/s3/s3.service';
import { FacultyYearSubject } from './entities/faculty-year-subject.entity';
import { UsersService } from '@modules/users/user.service';


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
    private readonly s3Service: S3Service,
    @InjectRepository(FacultyYearSubject) private readonly fysRepo: Repository<FacultyYearSubject>,
    private readonly usersService: UsersService,
  ) {}
  
  async search(q: SearchDocumentsDto): Promise<(Document & { rank?: number })[]> {
    const faculty = q.faculty?.trim();
    const subject = q.subject?.trim();
    const keyword = q.keyword?.trim();

    const qb = this.documentRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.subject', 'subject')
      .leftJoinAndSelect('d.faculty', 'faculty');

    if (faculty) {
      qb.andWhere('faculty.name ILIKE :facultyName', { facultyName: `%${faculty}%` });
    }

    if (subject) {
      qb.andWhere('subject.name ILIKE :subjectName', { subjectName: `%${subject}%` });
    }

    if (keyword) {
      qb.andWhere(new Brackets(b => {
        b.where('d.title ILIKE :kw')
        .orWhere('d.description ILIKE :kw')
        .orWhere('d.fileKey ILIKE :kw');
      }), { kw: `%${keyword}%` });
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

  async getDownloadUrl(id: string): Promise<string> {
    const document = await this.documentRepo.findOne({ where: { id } });

    if (!document) {
      throw new NotFoundException(`Document with ID "${id}" not found`);
    }

    const fileKey: string = document.fileKey;
    const fileName: string = document.title || 'downloaded-file';
    const isDownload: boolean = true;
    if (!fileKey) {
      throw new NotFoundException(`Document "${id}" does not have an attached file`);
    }

    const url = await this.s3Service.getPresignedDownloadUrl(fileKey, fileName, isDownload);

    this.logger.log(` Generated presigned URL for document: ${id}`);
    return url;
  }

  async getDocumentById(id: string): Promise<DetailsDocumentResponseDto> {
    const document: Document | null = await this.documentRepo.findOne({
      where: { id },
      relations: ['subject', 'faculty', 'uploader', 'ratings', 'images'],
    });

    if (!document) {
      throw new NotFoundException(`Document with ID "${id}" not found`);
    }

    const overallRating: number =
      document.ratings && document.ratings.length > 0
        ? document.ratings.reduce((sum, rating) => sum + rating.score, 0) / document.ratings.length
        : 0;

    const images: string[] = await Promise.all(
      document.images.map(
        async (image) => await this.s3Service.getPresignedDownloadUrl(image.fileKey, image.fileKey)
      )
    );
    return new DetailsDocumentResponseDto({
      id: document.id,
      title: document.title,
      description: document.description,
      fileKey: document.fileKey,
      uploadDate: document.uploadDate,
      subject: document.subject ? document.subject.name : null,
      faculty: document.faculty ? document.faculty.name : null,
      uploader: document.uploader ? document.uploader.name : null,
      downloadCount: document.downloadCount,
      status: document.status,
      images: images ? images : [],
      thumbnailKey: document.thumbnailKey,
      overallRating,
    });
  }

  async suggestSubjectsForUser(userID: string): Promise<Subject[]> {
    const user = await this.usersService.findByIdWithFaculty(userID);
    if (!user) throw new NotFoundException('User not found');

    const year = (user as any).yearOfStudy ?? (user as any).year_of_study;
    if (!year || !user.faculty?.id) {
      throw new BadRequestException('User must have faculty and year_of_study set');
    }

    const maps = await this.fysRepo.find({
      where: {
        faculty: { id: user.faculty.id },
        year: Number(year),
      },
      relations: ['subject'],
    });

    return maps.map((m) => m.subject).filter(Boolean);
  }
}
