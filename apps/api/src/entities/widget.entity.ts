import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
@Entity('widgets')
@Index(['organizationId'])
export class Widget {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', length: 120 }) organizationId: string;
  @Column({ length: 255 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
