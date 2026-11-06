import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UlidService } from '@/shared/ulid/ulid.service';
import { generateUniqueUsername } from '@/shared/username/username';

export type IntegrationProvider = 'google' | 'github';

export interface IntegrationUser {
  type: IntegrationProvider;
  email: string;
  email_verified?: boolean;
  name: string;
  avatar_url: string;
  password?: string;
  id?: string;
  github_link?: string;
  bio?: string;
}

export interface CreateUserInput {
  email: string;
  name: string;
  avatar_url?: string;
  password?: string;
  github_id?: string;
  github_link?: string;
  bio?: string;
  google_id?: string;
}

export interface PublicUserInfoRecord {
  public_id: string;
  username: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  created_at: Date;
}

@Injectable()
export class UserTypeOrmRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly ulidService: UlidService,
  ) {}

  async create(data: CreateUserInput): Promise<User> {
    // Start of the email (before the @); on collision `_1`, `_2`, ...
    const username = await generateUniqueUsername(data.email, (candidate) => this.usernameExists(candidate));
    const newUser = this.userRepository.create({
      public_id: this.ulidService.generateId(),
      username,
      email: data.email,
      name: data.name || 'Unknown',
      avatar_url: data.avatar_url,
      github_id: data.github_id,
      github_link: data.github_link,
      bio: data.bio,
      google_id: data.google_id,
      password: data.password,
    });
    const saved = await this.userRepository.save(newUser);
    return saved;
  }

  async usernameExists(username: string): Promise<boolean> {
    // withDeleted: a soft-deleted user still holds the unique value in the database.
    return await this.userRepository.exist({ where: { username }, withDeleted: true });
  }

  async findByPublicId(public_id: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { public_id } });
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { email } });
    return user;
  }

  async findById(id: number): Promise<User | null> {
    return await this.userRepository.findOne({ where: { id } });
  }

  async findPublicInfoByPublicId(public_id: string): Promise<PublicUserInfoRecord | null> {
    return await this.userRepository
      .createQueryBuilder('user')
      .select(['user.public_id', 'user.username', 'user.name', 'user.avatar_url', 'user.bio', 'user.created_at'])
      .where('user.public_id = :public_id', { public_id })
      .getOne();
  }

  async findByIntegration(data: IntegrationUser): Promise<User | null> {
    const { type, id } = data;
    if (!id) {
      return null;
    }

    const query = {
      where: {
        [`${type}_id`]: String(id),
      },
    };

    const user = await this.userRepository.findOne(query);
    return user;
  }

  async searchByName(term: string, limit = 10): Promise<User[]> {
    // `@joao` and `joao` are the same search; `_` and `%` are wildcards in ILIKE, so escape them.
    const cleaned = term.replace(/^@/, '').trim();
    const escaped = cleaned.replace(/[\\%_]/g, (char) => `\\${char}`);

    // Searches by name or username only. The email is private and must not be matchable or returned.
    return await this.userRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.public_id', 'user.username', 'user.name', 'user.avatar_url'])
      .where('user.name ILIKE :term OR user.username ILIKE :term', {
        term: `%${escaped}%`,
      })
      // Exact username first, then usernames that start with the term.
      .orderBy('CASE WHEN "user"."username" = :exact THEN 0 WHEN "user"."username" ILIKE :prefix THEN 1 ELSE 2 END')
      .addOrderBy('"user"."name"')
      .setParameters({ exact: cleaned.toLowerCase(), prefix: `${escaped}%` })
      .limit(limit)
      .getMany();
  }

  async exists(user_id: number): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: user_id } });
    return !!user;
  }

  async update(id: number, data: Partial<User>): Promise<User> {
    await this.userRepository.update(id, data);
    const user = await this.userRepository.findOneByOrFail({ id });
    return user;
  }
}
