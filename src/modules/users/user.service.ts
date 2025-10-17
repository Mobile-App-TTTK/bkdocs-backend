import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async create(name: string, email: string, password: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.usersRepo.create({ name, email, password: hashedPassword });
    return this.usersRepo.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async getAllUsers(): Promise<User[]> {
    return this.usersRepo.find();
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async changePassword(id: string, partial: Partial<User>) {
    const ok = await this.usersRepo.update(id, partial);
    if (ok.affected === 0) throw new NotFoundException('User not found');
    return this.usersRepo.findOne({ where: { id } });
  }

  async findByIdWithFaculty(id: string) {
    return this.usersRepo.findOne({ where: { id }, relations: ['faculty'] });
  }
}
