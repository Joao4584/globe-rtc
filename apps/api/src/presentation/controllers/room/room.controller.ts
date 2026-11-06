import { Controller, Post, Body, Get, Param, Delete, Patch, HttpCode, HttpStatus, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ValidationRequestPipe } from '@/shared/pipes/validation-request.pipe';
import { CreateRoomRequest } from '@/presentation/requests/room/create-room.request';
import { ListRecentRoomsQuery } from '@/presentation/requests/room/list-recent-rooms.request';
import { CreateRoomUseCase } from '@/application/room/use-case/create-room.use-case';
import { GetRoomUseCase } from '@/application/room/use-case/get-room.use-case';
import { DeleteRoomUseCase } from '@/application/room/use-case/delete-room.use-case';
import { ListUserRoomsUseCase } from '@/application/room/use-case/list-user-rooms.use-case';
import { GetUserRoomsUseCase } from '@/application/room/use-case/get-user-rooms.use-case';
import { ToggleRoomFavoriteUseCase } from '@/application/room/use-case/toggle-room-favorite.use-case';
import { VerifyRoomPasswordUseCase } from '@/application/room/use-case/verify-room-password.use-case';
import { User as UserEntity } from '@/infrastructure/entities/user.entity';
import { User } from '@/presentation/decorators/user.decorator';
import { AppErrors } from '@/presentation/errors';
import { UpdateRoomRequest } from '@/presentation/requests/room/update-room.request';
import { UpdateRoomUseCase } from '@/application/room/use-case/update-room.use-case';
import { RoomAccessService } from '@/application/room/room-access.service';
import { RoomTypeOrmRepository } from '@/infrastructure/repositories/room.repository';
import { VerifyRoomPasswordRequest } from '@/presentation/requests/room/verify-room-password.request';
import { VerifyRoomAccessTokenRequest } from '@/presentation/requests/room/verify-room-access-token.request';
import { RoomDocs } from './room.doc';

@ApiTags(RoomDocs.tags)
@ApiBearerAuth()
@Controller('room')
export class RoomController {
  constructor(
    private readonly createRoomUseCase: CreateRoomUseCase,
    private readonly getRoomUseCase: GetRoomUseCase,
    private readonly deleteRoomUseCase: DeleteRoomUseCase,
    @Inject(ListUserRoomsUseCase)
    private readonly listUserRoomsUseCase: ListUserRoomsUseCase,
    private readonly getUserRoomsUseCase: GetUserRoomsUseCase,
    private readonly toggleRoomFavoriteUseCase: ToggleRoomFavoriteUseCase,
    private readonly verifyRoomPasswordUseCase: VerifyRoomPasswordUseCase,
    private readonly updateRoomUseCase: UpdateRoomUseCase,
    private readonly roomAccess: RoomAccessService,
    private readonly roomsRepository: RoomTypeOrmRepository,
  ) {}

  @Post()
  @ApiOperation(RoomDocs.create.operation)
  @ApiBody(RoomDocs.create.body)
  @ApiResponse(RoomDocs.create.response)
  async createRoom(@Body(ValidationRequestPipe) data: CreateRoomRequest, @User() user: UserEntity) {
    const room = await this.createRoomUseCase.execute({
      name: data.name,
      description: data.description,
      map_template_public_id: data.map_template_id,
      owner_id: user.id,
      is_public: data.public,
      password: data.password,
    });
    const roomResponse = { ...room } as Record<string, unknown>;
    delete roomResponse.owner_id;
    delete roomResponse.owner;
    delete roomResponse.password;
    delete roomResponse.id;

    return { message: 'Quarto criado com sucesso!', room: roomResponse };
  }

  @Get('recent')
  @ApiOperation(RoomDocs.recent.operation)
  @ApiQuery(RoomDocs.recent.query)
  @ApiResponse(RoomDocs.recent.response)
  async getRecentRooms(@User() user: { id: number }, @Query(ValidationRequestPipe) query: ListRecentRoomsQuery) {
    return await this.listUserRoomsUseCase.execute(user.id, query);
  }

  @Get('user/:public_id')
  @ApiOperation({ summary: "List another user's public_id-owned rooms (quartos)" })
  @ApiParam({ name: 'public_id', description: 'Owner user public id' })
  @ApiQuery(RoomDocs.recent.query)
  async getUserRooms(
    @Param('public_id') public_id: string,
    @User() user: UserEntity,
    @Query(ValidationRequestPipe) query: ListRecentRoomsQuery,
  ) {
    return await this.getUserRoomsUseCase.execute(public_id, query, user.id);
  }

  @Get(':public_id')
  @ApiOperation(RoomDocs.get.operation)
  @ApiParam(RoomDocs.get.param)
  @ApiResponse(RoomDocs.get.response)
  async getRoom(@Param('public_id') public_id: string, @User() user: UserEntity) {
    const room = await this.getRoomUseCase.execute(public_id, user.id);
    if (!room) {
      throw AppErrors.notFound('Quarto não encontrado');
    }
    return room;
  }

  @Patch(':public_id')
  @ApiOperation({ summary: 'Edit room name, description, visibility and password (owner/admin)' })
  @ApiParam({ name: 'public_id', description: 'Room public id' })
  async updateRoom(
    @Param('public_id') public_id: string,
    @Body(ValidationRequestPipe) data: UpdateRoomRequest,
    @User() user: UserEntity,
  ) {
    return await this.updateRoomUseCase.execute(public_id, user.id, data);
  }

  @Delete(':public_id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation(RoomDocs.remove.operation)
  @ApiParam(RoomDocs.remove.param)
  @ApiResponse(RoomDocs.remove.response)
  async deleteRoom(@Param('public_id') public_id: string, @User() user: UserEntity) {
    await this.deleteRoomUseCase.execute(public_id, user.id);
  }

  @Post(':public_id/favorite')
  @ApiOperation(RoomDocs.favorite.operation)
  @ApiParam(RoomDocs.favorite.param)
  @ApiResponse(RoomDocs.favorite.response)
  async toggleFavoriteRoom(@Param('public_id') public_id: string, @User() user: UserEntity) {
    if (!user) {
      throw AppErrors.unauthorized('Usuario nao autenticado');
    }
    const result = await this.toggleRoomFavoriteUseCase.execute(public_id, user);
    return {
      message: result.liked ? 'Quarto favoritado' : 'Favorito removido',
      ...result,
    };
  }

  @Post(':public_id/verify-password')
  @ApiOperation({ summary: 'Verify private room password' })
  @ApiParam({ name: 'public_id', description: 'Room public id' })
  @ApiResponse({
    status: 200,
    description: 'Password accepted',
    schema: { example: { authorized: true } },
  })
  async verifyRoomPassword(
    @Param('public_id') public_id: string,
    @Body(ValidationRequestPipe) data: VerifyRoomPasswordRequest,
    @User() user?: UserEntity,
  ) {
    const room = user ? await this.roomsRepository.findByPublicId(public_id) : null;
    if (room && user && (await this.roomAccess.getRole(room, user.id)) !== 'visitor') {
      return this.verifyRoomPasswordUseCase.grantAccess(public_id);
    }
    return await this.verifyRoomPasswordUseCase.execute(public_id, data.password);
  }

  @Post(':public_id/verify-access-token')
  @ApiOperation({ summary: 'Verify room access token' })
  @ApiParam({ name: 'public_id', description: 'Room public id' })
  @ApiResponse({
    status: 200,
    description: 'Access token accepted',
    schema: { example: { authorized: true } },
  })
  async verifyRoomAccessToken(
    @Param('public_id') public_id: string,
    @Body(ValidationRequestPipe) data: VerifyRoomAccessTokenRequest,
  ) {
    return this.verifyRoomPasswordUseCase.verifyAccessToken(public_id, data.accessToken);
  }
}
