import { desc, eq, and, sql } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { noteTags, tags, notes, type NewTag, type Tag } from '@/db/schema';
import { getDb } from '@/db';
import { CacheService } from '@/utils/cache';
import type { GetTagsOptions, PaginatedResult } from '@/types/note';
import { StreamService } from '@/services/StreamService';

export class NoteTagService {
  private cache: CacheService;
  private db;
  private streamService: StreamService;

  constructor(d1: D1Database) {
    this.cache = new CacheService('tags');
    this.db = getDb(d1);
    this.streamService = StreamService.getInstance();
  }

  /**
   * Invalidates tag-related cache entries
   */
  private async invalidateCache(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Get a paginated list of tags
   */
  async list(options: GetTagsOptions): Promise<PaginatedResult<Tag>> {
    const { page = 1, limit = 20, userId } = options;
    const offset = (page - 1) * limit;

    // Create cache key based on query parameters
    const cacheKey = `list:${userId}:${page}:${limit}`;

    // Try to get from cache first
    const cachedData = await this.cache.get<PaginatedResult<Tag>>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Count total for pagination
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(tags)
      .where(eq(tags.userId, userId))
      .execute();

    const totalItems = countResult[0]?.count || 0;
    const totalPages = Math.ceil(totalItems / limit);

    // Get tags ordered by lastNoteModifiedAt
    const tagsList = await this.db
      .select()
      .from(tags)
      .where(eq(tags.userId, userId))
      .orderBy(desc(tags.lastNoteModifiedAt))
      .limit(limit)
      .offset(offset)
      .execute();

    const result: PaginatedResult<Tag> = {
      items: tagsList,
      totalItems,
      totalPages,
      currentPage: page,
    };

    // Save to cache
    await this.cache.set(cacheKey, result);

    return result;
  }

  /**
   * Get a single tag by id
   */
  async getById(id: string): Promise<Tag | undefined> {
    const cacheKey = `tag:${id}`;

    // Try to get from cache first
    const cachedData = await this.cache.get<Tag>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const result = await this.db
      .select()
      .from(tags)
      .where(eq(tags.id, id))
      .execute();

    const tag = result[0];
    if (tag) {
      // Save to cache
      await this.cache.set(cacheKey, tag);
    }

    return tag;
  }

  /**
   * Create a new tag
   */
  async create(tag: Omit<NewTag, 'id' | 'createdAt' | 'updatedAt' | 'lastNoteModifiedAt'>): Promise<Tag> {
    const newTag: NewTag = {
      ...tag,
      id: crypto.randomUUID(),
      lastNoteModifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [createdTag] = await this.db
      .insert(tags)
      .values(newTag)
      .returning();

    await this.invalidateCache();
    
    // Send a notification about the new tag
    this.streamService.sendTagChange(
      tag.userId, 
      'create', 
      createdTag.id, 
      { name: createdTag.name }
    );
    
    return createdTag;
  }

  /**
   * Update an existing tag
   */
  async update(id: string, data: Partial<Omit<NewTag, 'id' | 'createdAt' | 'updatedAt' | 'lastNoteModifiedAt'>>): Promise<Tag | undefined> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    const [updatedTag] = await this.db
      .update(tags)
      .set(updateData)
      .where(eq(tags.id, id))
      .returning();

    await this.invalidateCache();
    
    if (updatedTag) {
      // Send a notification about the updated tag
      this.streamService.sendTagChange(
        updatedTag.userId, 
        'update', 
        updatedTag.id, 
        { name: updatedTag.name }
      );
    }
    
    return updatedTag;
  }

  /**
   * Delete a tag by id
   */
  async delete(id: string): Promise<boolean> {
    // First get the tag to know the userId
    const tagToDelete = await this.getById(id);
    if (!tagToDelete) {
      return false;
    }
    
    const result = await this.db
      .delete(tags)
      .where(eq(tags.id, id))
      .returning();

    await this.invalidateCache();
    
    if (result.length > 0) {
      // Send a notification about the deleted tag
      this.streamService.sendTagChange(
        tagToDelete.userId, 
        'delete', 
        id
      );
      return true;
    }
    
    return false;
  }

  /**
   * Associate a tag with a note
   */
  async addTagToNote(noteId: string, tagId: string): Promise<void> {
    // Check if the association already exists
    const existing = await this.db
      .select()
      .from(noteTags)
      .where(and(
        eq(noteTags.noteId, noteId),
        eq(noteTags.tagId, tagId)
      ))
      .execute();

    if (existing.length === 0) {
      // Create the association
      await this.db
        .insert(noteTags)
        .values({
          noteId,
          tagId,
        })
        .execute();

      // Update the lastNoteModifiedAt field for the tag
      await this.db
        .update(tags)
        .set({ lastNoteModifiedAt: new Date() })
        .where(eq(tags.id, tagId))
        .execute();

      await this.invalidateCache();
      
      // Get tag and note information for notification
      const tag = await this.getById(tagId);
      const noteResult = await this.db
        .select()
        .from(notes)
        .where(eq(notes.id, noteId))
        .execute();
      
      const note = noteResult[0];
      
      if (tag && note) {
        // Send notification about tag association
        this.streamService.sendTagChange(
          tag.userId, 
          'update', 
          tagId, 
          { 
            name: tag.name,
            action: 'addToNote',
            noteId,
            noteTitle: note.title 
          }
        );
      }
    }
  }

  /**
   * Remove a tag from a note
   */
  async removeTagFromNote(noteId: string, tagId: string): Promise<void> {
    // Get tag and note information for notification before deleting
    const tag = await this.getById(tagId);
    const noteResult = await this.db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .execute();
    
    const note = noteResult[0];
    
    await this.db
      .delete(noteTags)
      .where(and(
        eq(noteTags.noteId, noteId),
        eq(noteTags.tagId, tagId)
      ))
      .execute();

    await this.invalidateCache();
    
    if (tag && note) {
      // Send notification about tag removal
      this.streamService.sendTagChange(
        tag.userId, 
        'update', 
        tagId, 
        { 
          name: tag.name,
          action: 'removeFromNote',
          noteId,
          noteTitle: note.title 
        }
      );
    }
  }

  /**
   * Get all tags for a specific note
   */
  async getTagsForNote(noteId: string): Promise<Tag[]> {
    const cacheKey = `note-tags:${noteId}`;

    // Try to get from cache first
    const cachedData = await this.cache.get<Tag[]>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const queryResult = await this.db
      .select({ tag: tags })
      .from(noteTags)
      .innerJoin(tags, eq(noteTags.tagId, tags.id))
      .where(eq(noteTags.noteId, noteId))
      .execute();

    const tagsList = queryResult.map(r => r.tag);

    // Save to cache
    await this.cache.set(cacheKey, tagsList);

    return tagsList;
  }

  /**
   * Get all notes for a specific tag
   */
  async getNoteIdsForTag(tagId: string): Promise<string[]> {
    const cacheKey = `tag-notes:${tagId}`;

    // Try to get from cache first
    const cachedData = await this.cache.get<string[]>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const queryResult = await this.db
      .select({ noteId: noteTags.noteId })
      .from(noteTags)
      .where(eq(noteTags.tagId, tagId))
      .execute();

    const noteIds = queryResult.map(r => r.noteId);

    // Save to cache
    await this.cache.set(cacheKey, noteIds);

    return noteIds;
  }

  /**
   * Update lastNoteModifiedAt for a tag when a related note is modified
   */
  async updateLastModified(tagId: string): Promise<void> {
    // Get the tag to know the userId
    const tag = await this.getById(tagId);
    if (!tag) {
      return;
    }
    
    await this.db
      .update(tags)
      .set({ lastNoteModifiedAt: new Date() })
      .where(eq(tags.id, tagId))
      .execute();

    await this.invalidateCache();
    
    // Send notification about the tag being updated
    this.streamService.sendTagChange(
      tag.userId, 
      'update', 
      tagId, 
      { name: tag.name, lastNoteModifiedAt: new Date() }
    );
  }

  /**
   * Update lastNoteModifiedAt for all tags associated with a note
   */
  async updateLastModifiedForNote(noteId: string): Promise<void> {
    // Get all tags for this note
    const tagIds = await this.getNoteIdsForTag(noteId);

    // Update each tag's lastNoteModifiedAt
    for (const tagId of tagIds) {
      await this.updateLastModified(tagId);
    }
  }
}
