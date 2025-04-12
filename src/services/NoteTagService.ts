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

  // Color generation parameters
  private static readonly GOLDEN_RATIO_CONJUGATE = 0.618033988749895;
  private static readonly BASE_HUE = Math.random(); // Random starting hue
  private static readonly COLOR_CACHE = new Map<string, string>(); // Cache colors by tag name

  constructor(d1: D1Database) {
    this.cache = new CacheService('tags');
    this.db = getDb(d1);
    this.streamService = StreamService.getInstance();
  }

  /**
   * Generates a pastel color using the golden ratio conjugate
   * This ensures colors are visually distinct but still harmonious
   * @param seed - String to use as seed for the color
   * @returns Hex color code
   */
  private generateTagColor(seed: string): string {
    // Check if we already generated a color for this seed
    if (NoteTagService.COLOR_CACHE.has(seed)) {
      return NoteTagService.COLOR_CACHE.get(seed)!;
    }

    // Generate a deterministic hash value from the seed string
    let hashValue = 0;
    for (let i = 0; i < seed.length; i++) {
      hashValue = ((hashValue << 5) - hashValue) + seed.charCodeAt(i);
      hashValue = hashValue & hashValue; // Convert to 32bit integer
    }
    
    // Normalize the hash to 0-1 range
    const normalizedHash = Math.abs(hashValue) / 2147483647;
    
    // Use golden ratio conjugate to generate a sequence of values
    let hue = (NoteTagService.BASE_HUE + normalizedHash * NoteTagService.GOLDEN_RATIO_CONJUGATE) % 1;
    
    // Generate pastel HSL color with lower saturation
    // Adjust these values to change the pastel quality
    const saturation = 0.4 + normalizedHash * 0.2; // 40-60% saturation
    const lightness = 0.65 + normalizedHash * 0.1; // 65-75% lightness
    
    // Convert HSL to RGB
    const rgb = this.hslToRgb(hue, saturation, lightness);
    
    // Convert RGB to hex
    const hexColor = `#${rgb.map(c => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('')}`;
    
    // Cache the result
    NoteTagService.COLOR_CACHE.set(seed, hexColor);
    
    return hexColor;
  }

  /**
   * Converts HSL color to RGB
   * @param h - Hue (0 to 1)
   * @param s - Saturation (0 to 1)
   * @param l - Lightness (0 to 1)
   * @returns RGB values as array of numbers (0 to 1)
   */
  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return [r, g, b];
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
    // Generate a color for the tag if one is not provided
    const tagData = { ...tag };
    if (!tagData.color || tagData.color === '') {
      tagData.color = this.generateTagColor(tagData.name);
    }

    const newTag: NewTag = {
      ...tagData,
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

    // If name changed, regenerate the color
    if (data.name && !data.color) {
      const tag = await this.getById(id);
      if (tag && tag.name !== data.name) {
        updateData.color = this.generateTagColor(data.name);
      }
    }

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
