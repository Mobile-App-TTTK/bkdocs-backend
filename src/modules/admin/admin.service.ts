import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { Document } from '@modules/documents/entities/document.entity';
import { Status } from '@common/enums/status.enum';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  async getStatistics(): Promise<{
    totalUsers: number;
    pendingDocuments: number;
  }> {
    const [totalUsers, pendingDocuments] = await Promise.all([
      this.userRepository.count(),
      this.documentRepository.count({
        where: { status: Status.PENDING },
      }),
    ]);

    return {
      totalUsers,
      pendingDocuments,
    };
  }
}
