import { Injectable } from '@nestjs/common';
import { UlidService } from '@/shared/ulid/ulid.service';
import { RoomTypeOrmRepository } from '@/infrastructure/repositories/room.repository';
import { RoomParticipantTypeOrmRepository } from '@/infrastructure/repositories/room-participant.repository';
import { FriendsTypeOrmRepository } from '@/infrastructure/repositories/friends.repository';
import { UserTypeOrmRepository } from '@/infrastructure/repositories/user.repository';
import { Room } from '@/infrastructure/entities/room.entity';
import { User } from '@/infrastructure/entities/user.entity';
import { AppErrors } from '@/presentation/errors';
import { RoomAccessService } from '../room-access.service';

type MemberRole = 'member' | 'admin';

@Injectable()
export class ManageRoomMembersUseCase {
  constructor(
    private readonly roomsRepository: RoomTypeOrmRepository,
    private readonly participantsRepository: RoomParticipantTypeOrmRepository,
    private readonly friendsRepository: FriendsTypeOrmRepository,
    private readonly usersRepository: UserTypeOrmRepository,
    private readonly roomAccess: RoomAccessService,
    private readonly ulidService: UlidService,
  ) {}

  /** Owner + invited members/admins. Visible to the owner and to anyone who is a member. */
  async list(room_public_id: string, user_id: number) {
    const room = await this.findRoom(room_public_id);
    const role = await this.roomAccess.getRole(room, user_id);
    if (role === 'visitor') throw AppErrors.forbidden('Você não faz parte deste quarto');

    const [owner, members] = await Promise.all([
      this.usersRepository.findById(room.owner_id),
      this.participantsRepository.listMembers(room.id),
    ]);

    return {
      my_role: role,
      members: [
        ...(owner ? [{ ...this.toPublic(owner), role: 'owner' as const }] : []),
        ...members.filter((m) => m.user_id !== room.owner_id).map((m) => ({ ...this.toPublic(m.user), role: m.role })),
      ],
    };
  }

  async add(room_public_id: string, user_id: number, target_public_id: string, role: MemberRole = 'member') {
    const room = await this.findRoom(room_public_id);
    const myRole = await this.requireEditor(room, user_id);
    if (role === 'admin' && myRole !== 'owner') {
      throw AppErrors.forbidden('Apenas o dono pode promover administradores');
    }

    const target = await this.usersRepository.findByPublicId(target_public_id);
    if (!target) throw AppErrors.notFound('Usuário não encontrado');
    if (target.id === room.owner_id) throw AppErrors.badRequest('Este usuário já é o dono do quarto');

    const friendship = await this.friendsRepository.findByUsers(user_id, target.id);
    if (!friendship?.accepted_at) throw AppErrors.forbidden('Você só pode adicionar amigos ao quarto');

    const existing = await this.participantsRepository.findByRoomAndUser(room.id, target.id);
    if (existing) {
      if (existing.role === 'admin' && myRole !== 'owner') {
        throw AppErrors.forbidden('Apenas o dono pode alterar administradores');
      }
      await this.participantsRepository.updateRole(existing.id, role);
    } else {
      await this.participantsRepository.create({
        public_id: this.ulidService.generateId(),
        room_id: room.id,
        user_id: target.id,
        joined_at: new Date(),
        is_admin: role === 'admin',
        role,
      });
    }
    return { ...this.toPublic(target), role };
  }

  async setRole(room_public_id: string, user_id: number, target_public_id: string, role: MemberRole) {
    const room = await this.findRoom(room_public_id);
    if (room.owner_id !== user_id) throw AppErrors.forbidden('Apenas o dono pode alterar papéis');

    const participant = await this.findMember(room, target_public_id);
    await this.participantsRepository.updateRole(participant.id, role);
    return { updated: true };
  }

  async remove(room_public_id: string, user_id: number, target_public_id: string) {
    const room = await this.findRoom(room_public_id);
    const me = await this.usersRepository.findById(user_id);
    const leavingMyself = me?.public_id === target_public_id;

    if (leavingMyself) {
      if (room.owner_id === user_id) throw AppErrors.badRequest('O dono não pode sair do próprio quarto');
    } else {
      const myRole = await this.requireEditor(room, user_id);
      const target = await this.findMember(room, target_public_id);
      if (target.role === 'admin' && myRole !== 'owner') {
        throw AppErrors.forbidden('Apenas o dono pode remover administradores');
      }
    }

    const participant = await this.findMember(room, target_public_id);
    await this.participantsRepository.updateRole(participant.id, 'visitor');
    return { removed: true };
  }

  private async findRoom(public_id: string): Promise<Room> {
    const room = await this.roomsRepository.findByPublicId(public_id);
    if (!room) throw AppErrors.notFound('Quarto não encontrado');
    return room;
  }

  private async requireEditor(room: Room, user_id: number) {
    const role = await this.roomAccess.getRole(room, user_id);
    if (!this.roomAccess.canEdit(role)) throw AppErrors.forbidden('Você não tem permissão para gerenciar este quarto');
    return role;
  }

  private async findMember(room: Room, target_public_id: string) {
    const target = await this.usersRepository.findByPublicId(target_public_id);
    if (!target) throw AppErrors.notFound('Usuário não encontrado');
    const participant = await this.participantsRepository.findByRoomAndUser(room.id, target.id);
    if (!participant || participant.role === 'visitor') throw AppErrors.notFound('Este usuário não é membro do quarto');
    return participant;
  }

  private toPublic(user: User) {
    return { public_id: user.public_id, username: user.username, name: user.name, avatar_url: user.avatar_url ?? null };
  }
}
