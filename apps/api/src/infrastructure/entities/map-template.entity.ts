import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('map_template')
export class MapTemplate {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ type: 'varchar', length: 26, unique: true, name: 'public_id' })
  public_id: string;

  @Column({ name: 'user_id' })
  user_id: number;

  @Column({ type: 'varchar', length: 80, name: 'name' })
  name: string;

  /** Map layers (floor, walls, objects, collision), ids only. Empty until the editor saves something. */
  @Column({ type: 'jsonb', name: 'data', default: () => `'{}'` })
  data: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true, name: 'deleted_at' })
  deleted_at?: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
