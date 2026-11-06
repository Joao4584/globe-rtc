import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
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
  ) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Pieces available for the skin, per type and part, grouped by style (each style lists its colour variants)' })
  @ApiResponse({ status: 200, description: '{ data: { adult: { body: [{ style, variants: [id] }], ... }, kid: { ... } } }' })
  async catalog() {
    return { data: await this.catalogUseCase.execute() };
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
