import { Controller, Get, Post, Patch, Delete, Param, Body, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ValidationRequestPipe } from '@/shared/pipes/validation-request.pipe';
import { ManageRoomMembersUseCase } from '@/application/room/use-case/manage-room-members.use-case';
import { AddRoomMemberRequest, UpdateRoomMemberRequest } from '@/presentation/requests/room/room-member.request';
import { User } from '@/presentation/decorators/user.decorator';
import { User as UserEntity } from '@/infrastructure/entities/user.entity';

@ApiTags('Room members')
@ApiBearerAuth()
@Controller('room/:room_public_id/members')
export class RoomMembersController {
  constructor(@Inject(ManageRoomMembersUseCase) private readonly members: ManageRoomMembersUseCase) {}

  @Get()
  @ApiOperation({ summary: 'List the owner and invited members of a room' })
  @ApiParam({ name: 'room_public_id' })
  list(@Param('room_public_id') room: string, @User() user: UserEntity) {
    return this.members.list(room, user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a friend as member/admin (owner or admin)' })
  add(
    @Param('room_public_id') room: string,
    @Body(ValidationRequestPipe) data: AddRoomMemberRequest,
    @User() user: UserEntity,
  ) {
    return this.members.add(room, user.id, data.user_public_id, data.role);
  }

  @Patch(':user_public_id')
  @ApiOperation({ summary: 'Change a member role (owner only)' })
  setRole(
    @Param('room_public_id') room: string,
    @Param('user_public_id') target: string,
    @Body(ValidationRequestPipe) data: UpdateRoomMemberRequest,
    @User() user: UserEntity,
  ) {
    return this.members.setRole(room, user.id, target, data.role);
  }

  @Delete(':user_public_id')
  @ApiOperation({ summary: 'Remove a member (owner/admin) or leave the room yourself' })
  remove(@Param('room_public_id') room: string, @Param('user_public_id') target: string, @User() user: UserEntity) {
    return this.members.remove(room, user.id, target);
  }
}
