import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserTypeOrmRepository } from '@/infrastructure/repositories/user.repository';
import { AppErrors } from '@/presentation/errors';

const PASSWORD_SALT_ROUNDS = 12;

@Injectable()
export class RegisterUserUseCase {
  constructor(private readonly usersRepository: UserTypeOrmRepository) {}

  async execute(data: { email: string; name: string; password: string }) {
    const existing = await this.usersRepository.findByEmail(data.email);
    if (existing) {
      throw AppErrors.conflict('E-mail já cadastrado');
    }

    const hashedPassword = await bcrypt.hash(data.password, PASSWORD_SALT_ROUNDS);

    return await this.usersRepository.create({
      email: data.email,
      name: data.name,
      password: hashedPassword,
    });
  }
}
