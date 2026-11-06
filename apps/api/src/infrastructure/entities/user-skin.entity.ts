import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

/** The character a user built in the Character page: the pieces picked and the spritesheet saved in uploads/character. One per user. */
@Entity('user_skin')
export class UserSkin {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ type: 'integer', unique: true, name: 'user_id' })
  user_id: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** The `SkinSelection` (@globe-rtc/skin-generator) the sheet was rendered from. */
  @Column({ type: 'jsonb', name: 'selection' })
  selection: Record<string, unknown>;

  /** File name inside uploads/character (the same file is overwritten on every update). */
  @Column({ type: 'varchar', name: 'file_name' })
  file_name: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
