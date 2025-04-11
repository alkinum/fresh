import type { Note, Tag } from '@/db/schema';

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

export interface GetNotesOptions extends PaginationParams {
  userId: string;
  tagId?: string;
  isFavorite?: boolean;
}

export interface GetTagsOptions extends PaginationParams {
  userId: string;
}

export interface NoteWithTags extends Note {
  tags: Tag[];
} 