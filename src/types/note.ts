import type { Note, Tag as DbTag } from '@/db/schema';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}

export interface GetNotesOptions {
  page?: number;
  limit?: number;
  userId: string;
  tagId?: string;
  isFavorite?: boolean;
}

export interface GetTagsOptions {
  page?: number;
  limit?: number;
  userId: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  count?: number;
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastNoteModifiedAt?: Date;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  renderedContent: string;
  date: string;
  tags: Tag[];
  colorIndicator: string;
  isFavorite: boolean;
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PaginatedNotes = PaginatedResult<NoteItem>;
export type PaginatedTags = PaginatedResult<Tag>;

export interface NoteWithTags extends NoteItem {
  tags: Tag[];
} 