import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { SkinSelection } from '@globe-rtc/skin-generator';
import { UserSkin } from '@/infrastructure/entities/user-skin.entity';
import { User } from '@/infrastructure/entities/user.entity';
import { getUploadDirectory } from '@/application/upload/upload-path';
import { AppErrors } from '@/presentation/errors';
import { RenderSkinUseCase } from './render-skin.use-case';

const CHARACTER_FOLDER = 'character';

export interface UserSkinOutput {
  selection: Record<string, unknown>;
  /** Public path of the spritesheet (same file on every update; `?v=` changes so caches reload it). */
  url: string;
  updated_at: Date;
}

@Injectable()
export class UserSkinUseCase {
  constructor(
    @InjectRepository(UserSkin) private readonly repository: Repository<UserSkin>,
    private readonly renderSkin: RenderSkinUseCase,
  ) {}

  private folder() {
    return join(getUploadDirectory(), CHARACTER_FOLDER);
  }

  private toOutput(row: UserSkin): UserSkinOutput {
    return { selection: row.selection, url: `/skin/file/${row.file_name}?v=${row.updated_at.getTime()}`, updated_at: row.updated_at };
  }

  async get(user: User): Promise<UserSkinOutput | null> {
    const row = await this.repository.findOne({ where: { user_id: user.id } });
    return row ? this.toOutput(row) : null;
  }

  /** First save creates the row and the file in uploads/character; the next ones update the row and overwrite the same file. */
  async save(user: User, selection: SkinSelection): Promise<UserSkinOutput & { created: boolean }> {
    const skin = await this.renderSkin.execute(selection);
    const fileName = `${user.public_id}.png`;
    await mkdir(this.folder(), { recursive: true });
    await writeFile(join(this.folder(), fileName), skin.spritesheet);

    const existing = await this.repository.findOne({ where: { user_id: user.id } });
    const row = await this.repository.save(
      existing
        ? Object.assign(existing, { selection: { ...selection }, file_name: fileName })
        : this.repository.create({ user_id: user.id, selection: { ...selection }, file_name: fileName }),
    );
    return { ...this.toOutput(row), created: !existing };
  }

  async readFile(fileName: string): Promise<Buffer> {
    // Only plain names are served (no path pieces), and only if some user owns that file.
    if (!/^[A-Za-z0-9_-]+\.png$/.test(fileName) || !(await this.repository.exists({ where: { file_name: fileName } }))) {
      throw AppErrors.notFound('Arquivo nao encontrado');
    }
    return readFile(join(this.folder(), fileName)).catch(() => {
      throw AppErrors.notFound('Arquivo nao encontrado');
    });
  }
}
