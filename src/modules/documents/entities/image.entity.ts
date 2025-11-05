import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Document } from '@modules/documents/entities/document.entity';
import { Comment } from '@modules/comments/entities/comment.entity';

@Entity('images')
export class Image {
  @PrimaryColumn({ name: 'file_key' })
  fileKey: string;

  @ManyToOne(() => Comment, (comment) => comment.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: Comment;

  @ManyToOne(() => Document, (document) => document.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: Document;
}
