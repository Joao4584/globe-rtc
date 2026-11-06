import { Injectable } from '@nestjs/common';
import { UserTypeOrmRepository } from '@/infrastructure/repositories/user.repository';
import { ListUserRoomsUseCase } from './list-user-rooms.use-case';
import { AppErrors } from '@/presentation/errors';

@Injectable()
export class GetUserRoomsUseCase {
  constructor(
    private readonly usersRepository: UserTypeOrmRepository,
    private readonly listUserRoomsUseCase: ListUserRoomsUseCase,
  ) {}

  async execute(
    user_public_id: string,
    options: {
      order?: 'ASC' | 'DESC';
      sort?: 'recent' | 'alphabetical' | 'players';
    },
    viewer_id: number,
  ) {
    const user = await this.usersRepository.findByPublicId(user_public_id);
    if (!user) {
      throw AppErrors.notFound('Usuário não encontrado');
    }

    return this.listUserRoomsUseCase.execute(user.id, { ...options, owner_only: true }, viewer_id);
  }
}
