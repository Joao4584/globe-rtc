import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User as UserEntity } from '@/infrastructure/entities/user.entity';
import { CreateMapTemplateUseCase } from '@/application/map-template/use-case/create-map-template.use-case';
import { ListMapTemplatesUseCase } from '@/application/map-template/use-case/list-map-templates.use-case';
import { GetMapTemplateUseCase } from '@/application/map-template/use-case/get-map-template.use-case';
import { DeleteMapTemplateUseCase } from '@/application/map-template/use-case/delete-map-template.use-case';
import { UpdateMapTemplateUseCase } from '@/application/map-template/use-case/update-map-template.use-case';
import { CreateMapTemplateRequest } from '@/presentation/requests/map-template/create-map-template.request';
import { UpdateMapTemplateRequest } from '@/presentation/requests/map-template/update-map-template.request';
import { ValidationRequestPipe } from '@/shared/pipes/validation-request.pipe';
import { User } from '@/presentation/decorators/user.decorator';

@ApiTags('Map template')
@ApiBearerAuth()
@Controller('map-template')
export class MapTemplateController {
  constructor(
    private readonly createMapTemplateUseCase: CreateMapTemplateUseCase,
    private readonly listMapTemplatesUseCase: ListMapTemplatesUseCase,
    private readonly getMapTemplateUseCase: GetMapTemplateUseCase,
    private readonly updateMapTemplateUseCase: UpdateMapTemplateUseCase,
    private readonly deleteMapTemplateUseCase: DeleteMapTemplateUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar template de mapa (comeca vazio)' })
  @ApiBody({ type: CreateMapTemplateRequest })
  @ApiResponse({ status: 201 })
  async create(@Body(ValidationRequestPipe) body: CreateMapTemplateRequest, @User() user: UserEntity) {
    const template = await this.createMapTemplateUseCase.execute(user.id, body.name);
    return { message: 'Template criado com sucesso', template };
  }

  @Get()
  @ApiOperation({ summary: 'Listar templates de mapa do usuario logado' })
  @ApiQuery({ name: 'sort', required: false, enum: ['recent', 'alphabetical'] })
  async list(@Query('sort') sort: string | undefined, @User() user: UserEntity) {
    const data = await this.listMapTemplatesUseCase.execute(user.id, sort === 'alphabetical' ? 'alphabetical' : 'recent');
    return { data };
  }

  @Get(':public_id')
  @ApiOperation({ summary: 'Detalhe de um template de mapa' })
  @ApiParam({ name: 'public_id', description: 'Public id do template' })
  async get(@Param('public_id') public_id: string, @User() user: UserEntity) {
    return await this.getMapTemplateUseCase.execute(user.id, public_id);
  }

  @Put(':public_id')
  @ApiOperation({ summary: 'Salvar o mapa do template (sobrescreve o JSON anterior)' })
  @ApiParam({ name: 'public_id', description: 'Public id do template' })
  @ApiBody({ type: UpdateMapTemplateRequest })
  async save(@Param('public_id') public_id: string, @Body(ValidationRequestPipe) body: UpdateMapTemplateRequest, @User() user: UserEntity) {
    return await this.updateMapTemplateUseCase.execute(user.id, public_id, body.data);
  }

  @Delete(':public_id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover template de mapa' })
  @ApiParam({ name: 'public_id', description: 'Public id do template' })
  @ApiResponse({ status: 204 })
  async remove(@Param('public_id') public_id: string, @User() user: UserEntity) {
    await this.deleteMapTemplateUseCase.execute(user.id, public_id);
  }
}
