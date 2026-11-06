import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { RoomTypeOrmRepository } from '@/infrastructure/repositories/room.repository';
import { AppErrors } from '@/presentation/errors';

type RoomAccessTokenPayload = {
  kind: 'room_access';
  room_public_id: string;
};

const ROOM_ACCESS_TOKEN_EXPIRATION = '10m';

@Injectable()
export class VerifyRoomPasswordUseCase {
  constructor(private readonly roomsRepository: RoomTypeOrmRepository) {}

  async execute(public_id: string, password: string) {
    const room = await this.roomsRepository.findByPublicId(public_id);
    if (!room) {
      throw AppErrors.notFound('Quarto não encontrado');
    }

    if (room.is_public) {
      return { authorized: true };
    }

    if (!room.password) {
      throw AppErrors.forbidden('Quarto privado sem senha configurada');
    }

    const isValid = await bcrypt.compare(password, room.password);
    if (!isValid) {
      throw AppErrors.forbidden('Senha do quarto inválida');
    }

    return this.issueAccessToken(public_id);
  }

  /** Owner, admins and members skip the password of a private room. */
  grantAccess(public_id: string) {
    return this.issueAccessToken(public_id);
  }

  verifyAccessToken(public_id: string, accessToken: string) {
    if (!accessToken) {
      throw AppErrors.forbidden('Token de acesso do quarto ausente');
    }

    let decoded: RoomAccessTokenPayload;
    try {
      decoded = jwt.verify(accessToken, process.env.JWT_SECRET || 'default-secret') as RoomAccessTokenPayload;
    } catch {
      throw AppErrors.forbidden('Token de acesso do quarto inválido ou expirado');
    }

    if (decoded?.kind !== 'room_access' || decoded?.room_public_id !== public_id) {
      throw AppErrors.forbidden('Token de acesso do quarto inválido');
    }

    return { authorized: true };
  }

  private issueAccessToken(public_id: string) {
    const payload: RoomAccessTokenPayload = {
      kind: 'room_access',
      room_public_id: public_id,
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'default-secret', {
      expiresIn: ROOM_ACCESS_TOKEN_EXPIRATION,
    });

    return {
      authorized: true,
      accessToken,
      expiresIn: ROOM_ACCESS_TOKEN_EXPIRATION,
    };
  }
}
