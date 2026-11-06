import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserTypeOrmRepository } from '@/infrastructure/repositories/user.repository';
import { AppErrors } from '@/presentation/errors';

@Injectable()
export class LoginUserUseCase {
  constructor(private readonly usersRepository: UserTypeOrmRepository) {}

  async execute(data: { email: string; password: string }) {
    const user = await this.usersRepository.findByEmail(data.email);
    if (!user || !user.password) {
      throw AppErrors.unauthorized('Credenciais inválidas');
    }

    const isValid = await bcrypt.compare(data.password, user.password);
    if (!isValid) {
      throw AppErrors.unauthorized('Credenciais inválidas');
    }

    return user;
  }
}
