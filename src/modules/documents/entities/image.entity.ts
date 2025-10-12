import { Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { Document } from "@modules/documents/entities/document.entity";

@Entity('images')
export class Image {
    @PrimaryColumn({ name: 'file_key' })
    fileKey: string;

    @ManyToOne(() => Document, (document) => document.images, { onDelete: 'CASCADE' })
    document: Document;
}