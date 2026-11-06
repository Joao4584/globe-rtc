import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { User } from '@/presentation/decorators/user.decorator';
import { User as UserEntity } from '@/infrastructure/entities/user.entity';
import { UserSkinUseCase } from '@/application/skin/use-case/user-skin.use-case';
import { AppErrors } from '@/presentation/errors';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RenderSkinUseCase } from '@/application/skin/use-case/render-skin.use-case';
import { SkinCatalogUseCase } from '@/application/skin/use-case/skin-catalog.use-case';
import { parseSkinSelection } from '@/application/skin/skin-selection';

// Used by the Character page: the pieces to pick from, and the exact skin for a pick. Both need a logged user.
@ApiTags('Skin')
@ApiBearerAuth()
@Controller('skin')
export class SkinCharacterController {
  constructor(
    private readonly catalogUseCase: SkinCatalogUseCase,
    private readonly renderUseCase: RenderSkinUseCase,
    private readonly userSkinUseCase: UserSkinUseCase,
  ) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Pieces available for the skin, per type and part, grouped by style (each style lists its colour variants)' })
  @ApiResponse({ status: 200, description: '{ data: { adult: { body: [{ style, variants: [id] }], ... }, kid: { ... } } }' })
  async catalog() {
    return { data: await this.catalogUseCase.execute() };
  }

  @Get('me')
  @ApiOperation({ summary: 'The saved character of the current user (null until they create one)' })
  @ApiResponse({ status: 200, description: '{ data: { selection, url, updated_at } | null }' })
  async mine(@User() user: UserEntity) {
    if (!user) throw AppErrors.unauthorized('Usuário não autenticado');
    return { data: await this.userSkinUseCase.get(user) };
  }

  // The first call creates the character; the next ones update it and overwrite the same file in uploads/character.
  @Put('me')
  @ApiOperation({ summary: 'Create or update the character: renders the sheet, saves it in uploads/character and links it to the user' })
  @ApiResponse({ status: 200, description: '{ data: { selection, url, updated_at, created } }' })
  @ApiResponse({ status: 400, description: 'Unknown type or piece' })
  async save(@Body() body: { selection?: unknown }, @User() user: UserEntity) {
    if (!user) throw AppErrors.unauthorized('Usuário não autenticado');
    const selection = await parseSkinSelection(body?.selection);
    return { data: await this.userSkinUseCase.save(user, selection) };
  }

  // Public (no token) so the game and other players can load a character sheet by its URL.
  @Get('file/:filename')
  @ApiOperation({ summary: 'The saved spritesheet (PNG) of a character' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async file(@Param('filename') fileName: string, @Res() reply: FastifyReply) {
    const buffer = await this.userSkinUseCase.readFile(fileName);
    reply.header('Content-Type', 'image/png');
    reply.header('Cache-Control', 'no-cache');
    return reply.send(buffer);
  }

  @HttpCode(HttpStatus.OK)
  @Post('render')
  @ApiOperation({ summary: 'Render exactly this skin: the complete spritesheet (idle, walk, sit, throw, punch, hurt) and how to read it' })
  @ApiBody({
    schema: {
      example: { selection: { type: 'adult', body: 'Body_32x32_01', eyes: 'Eyes_32x32_01', outfit: 'Outfit_01_32x32_01', hairstyle: 'Hairstyle_01_32x32_01', accessory: null } },
    },
  })
  @ApiResponse({ status: 200, description: '{ data: { selection, spritesheet (data URL), layout } }' })
  @ApiResponse({ status: 400, description: 'Unknown type or piece' })
  async render(@Body() body: { selection?: unknown }) {
    const selection = await parseSkinSelection(body?.selection);
    const skin = await this.renderUseCase.execute(selection);
    return {
      data: {
        selection: skin.selection,
        spritesheet: `data:image/png;base64,${skin.spritesheet.toString('base64')}`,
        layout: skin.layout,
      },
    };
  }
}
