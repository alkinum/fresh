import { and, desc, eq, sql } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { notes, noteTags, tags, type NewNote, type Note } from '@/db/schema';
import { getDb } from '@/db';
import { CacheService } from '@/utils/cache';
import type { GetNotesOptions, NoteWithTags, PaginatedResult } from '@/types/note';
import { MarkdownRenderer } from '@/utils/markdown';
import { StreamService } from '@/services/StreamService';

export class NoteService {
  private cache: CacheService;
  private db;
  private markdownRenderer: MarkdownRenderer;
  private streamService: StreamService;

  constructor(d1: D1Database) {
    this.cache = new CacheService('notes');
    this.db = getDb(d1);
    this.markdownRenderer = MarkdownRenderer.getInstance();
    this.streamService = StreamService.getInstance();
  }

  /**
   * Extracts tags from content while respecting markdown block structures
   * Ignores tags in blockquotes, code blocks, and other blocks where they shouldn't be parsed
   */
  public extractTags(content: string): string[] {
    // Split content into lines to analyze blocks
    const lines = content.split('\n');
    let inCodeBlock = false;
    let inBlockQuote = false;
    let preprocessedLines: string[] = [];

    // First, preprocess the content to ignore block structures
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for code block boundaries (```code```)
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        preprocessedLines.push(''); // Add empty line to maintain line count
        continue;
      }
      
      // Check for blockquote
      if (line.trim().startsWith('>')) {
        inBlockQuote = true;
        preprocessedLines.push(''); // Add empty line to maintain line count
        continue;
      } else if (inBlockQuote && line.trim() === '') {
        // End of blockquote
        inBlockQuote = false;
      }
      
      // Only include lines that are not in special blocks
      if (!inCodeBlock && !inBlockQuote) {
        preprocessedLines.push(line);
      } else {
        preprocessedLines.push(''); // Add empty line to maintain line count
      }
    }
    
    // Join the preprocessed lines back into a single string
    const preprocessedContent = preprocessedLines.join('\n');
    
    // Use word boundary to ensure we only catch standalone tags
    const tagRegex = /\B#(\w+)\b/g;
    const matches = [...preprocessedContent.matchAll(tagRegex)];
    
    // Return unique tag names
    return [...new Set(matches.map(match => match[1]))];
  }

  /**
   * Transforms tags in content to a custom syntax for rendering
   * Returns an object with extracted tags and transformed content
   */
  public processContentTags(content: string): { 
    transformedContent: string; 
    tags: string[] 
  } {
    // Extract tags first
    const tags = this.extractTags(content);
    
    // Don't transform content if no tags
    if (tags.length === 0) {
      return { transformedContent: content, tags };
    }
    
    // Split content into lines to analyze blocks
    const lines = content.split('\n');
    let inCodeBlock = false;
    let inBlockQuote = false;
    let transformedLines: string[] = [];
    
    // Process line by line
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Check for code block boundaries
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        transformedLines.push(line);
        continue;
      }
      
      // Check for blockquote
      if (line.trim().startsWith('>')) {
        inBlockQuote = true;
        transformedLines.push(line);
        continue;
      } else if (inBlockQuote && line.trim() === '') {
        // End of blockquote
        inBlockQuote = false;
      }
      
      // Only transform tags in regular content (not in blocks)
      if (!inCodeBlock && !inBlockQuote) {
        // Replace #tag with our custom syntax
        // Using the format %%tag%% which is unlikely to conflict with other markdown
        line = line.replace(/\B#(\w+)\b/g, (match, tagName) => {
          // Make sure this tag is in our extracted list (it should be)
          if (tags.includes(tagName)) {
            return `%%tag:${tagName}%%`;
          }
          // If not in our list for some reason, leave it unchanged
          return match;
        });
      }
      
      transformedLines.push(line);
    }
    
    return {
      transformedContent: transformedLines.join('\n'),
      tags
    };
  }

  /**
   * Invalidates note-related cache entries
   */
  private async invalidateCache(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Get a paginated list of notes
   */
  async list(options: GetNotesOptions): Promise<PaginatedResult<NoteWithTags>> {
    const { page = 1, limit = 20, userId, tagId, isFavorite } = options;
    const offset = (page - 1) * limit;

    // Create cache key based on query parameters
    const cacheKey = `list:${userId}:${tagId || 'all'}:${isFavorite !== undefined ? isFavorite : 'all'}:${page}:${limit}`;

    // Try to get from cache first
    const cachedData = await this.cache.get<PaginatedResult<NoteWithTags>>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Apply filters
    let whereConditions = and(eq(notes.userId, userId));

    if (isFavorite !== undefined) {
      whereConditions = and(whereConditions, eq(notes.isFavorite, isFavorite));
    }

    // If filtering by tagId, we need to get the note IDs first
    if (tagId) {
      // Get note IDs that have the specified tag
      const taggedNotes = await this.db
        .select({ noteId: noteTags.noteId })
        .from(noteTags)
        .where(eq(noteTags.tagId, tagId))
        .execute();

      if (taggedNotes.length === 0) {
        return {
          items: [],
          totalItems: 0,
          totalPages: 0,
          currentPage: page,
        };
      }

      const noteIds = taggedNotes.map(n => n.noteId);

      // Count total for pagination
      const countResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(notes)
        .where(and(
          whereConditions,
          sql`${notes.id} IN (${noteIds.join(',')})`
        ))
        .execute();

      const totalItems = countResult[0]?.count || 0;
      const totalPages = Math.ceil(totalItems / limit);

      // Get notes with pagination - Order by isFavorite first, then by updatedAt
      const dbNotes = await this.db
        .select()
        .from(notes)
        .where(and(
          whereConditions,
          sql`${notes.id} IN (${noteIds.join(',')})`
        ))
        .orderBy(desc(notes.isFavorite), desc(notes.updatedAt))
        .limit(limit)
        .offset(offset)
        .execute();

      // Fetch tags for each note
      const notesWithTags: NoteWithTags[] = await Promise.all(
        dbNotes.map(async (note) => {
          const noteTags = await this.getNoteTags(note.id);
          return { ...note, tags: noteTags };
        })
      );

      const result: PaginatedResult<NoteWithTags> = {
        items: notesWithTags,
        totalItems,
        totalPages,
        currentPage: page,
      };

      // Save to cache
      await this.cache.set(cacheKey, result);

      return result;
    }

    // No tag filtering - simpler query path
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .where(whereConditions)
      .execute();

    const totalItems = countResult[0]?.count || 0;
    const totalPages = Math.ceil(totalItems / limit);

    // Get the actual items with pagination - Order by isFavorite first, then by updatedAt
    const dbNotes = await this.db
      .select()
      .from(notes)
      .where(whereConditions)
      .orderBy(desc(notes.isFavorite), desc(notes.updatedAt))
      .limit(limit)
      .offset(offset)
      .execute();

    // Fetch tags for each note
    const notesWithTags: NoteWithTags[] = await Promise.all(
      dbNotes.map(async (note) => {
        const noteTags = await this.getNoteTags(note.id);
        return { ...note, tags: noteTags };
      })
    );

    const result: PaginatedResult<NoteWithTags> = {
      items: notesWithTags,
      totalItems,
      totalPages,
      currentPage: page,
    };

    // Save to cache
    await this.cache.set(cacheKey, result);

    return result;
  }

  /**
   * Get a single note by id with its tags
   */
  async getById(id: string): Promise<NoteWithTags | undefined> {
    const cacheKey = `note:${id}`;

    // Try to get from cache first
    const cachedData = await this.cache.get<NoteWithTags>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const result = await this.db
      .select()
      .from(notes)
      .where(eq(notes.id, id))
      .execute();

    const note = result[0];
    if (!note) {
      return undefined;
    }

    // Get tags for this note
    const noteTags = await this.getNoteTags(id);
    const noteWithTags: NoteWithTags = { ...note, tags: noteTags };

    // Save to cache
    await this.cache.set(cacheKey, noteWithTags);

    return noteWithTags;
  }

  /**
   * Get tags for a specific note
   */
  private async getNoteTags(noteId: string): Promise<typeof tags.$inferSelect[]> {
    const result = await this.db
      .select({ tag: tags })
      .from(noteTags)
      .innerJoin(tags, eq(noteTags.tagId, tags.id))
      .where(eq(noteTags.noteId, noteId))
      .execute();

    return result.map(r => r.tag);
  }

  /**
   * Create a new note
   */
  async create(note: Omit<NewNote, 'id' | 'createdAt' | 'updatedAt' | 'renderedContent'>): Promise<Note> {
    // Ensure markdown renderer is initialized
    await this.markdownRenderer.initialize();
    
    // Process content to extract tags and transform tag syntax
    const { transformedContent, tags: extractedTags } = this.processContentTags(note.content);

    // Render the transformed markdown content
    const renderedContent = this.markdownRenderer.render(transformedContent);

    const newNote: NewNote = {
      ...note,
      content: transformedContent, // Store the transformed content
      renderedContent,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [createdNote] = await this.db
      .insert(notes)
      .values(newNote)
      .returning();

    await this.invalidateCache();

    // Send a notification about the new note
    this.streamService.sendNoteChange(
      note.userId,
      'create',
      createdNote.id,
      { title: createdNote.title }
    );

    return createdNote;
  }

  /**
   * Update an existing note
   */
  async update(id: string, data: Partial<Omit<NewNote, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Note | undefined> {
    let updateData: Record<string, any> = {
      ...data,
      updatedAt: new Date(),
    };

    // If content is being updated, re-render the markdown
    if (data.content !== undefined) {
      // Ensure markdown renderer is initialized
      await this.markdownRenderer.initialize();
      
      // Process content to extract tags and transform tag syntax
      const { transformedContent, tags: extractedTags } = this.processContentTags(data.content);
      
      // Set the transformed content and render it
      updateData.content = transformedContent;
      updateData.renderedContent = this.markdownRenderer.render(transformedContent);
    }

    const [updatedNote] = await this.db
      .update(notes)
      .set(updateData)
      .where(eq(notes.id, id))
      .returning();

    await this.invalidateCache();

    if (updatedNote) {
      // Send a notification about the updated note
      this.streamService.sendNoteChange(
        updatedNote.userId,
        'update',
        updatedNote.id,
        { title: updatedNote.title }
      );
    }

    return updatedNote;
  }

  /**
   * Delete a note by id
   */
  async delete(id: string): Promise<boolean> {
    // First get the note to know the userId
    const noteToDelete = await this.getById(id);
    if (!noteToDelete) {
      return false;
    }

    const result = await this.db
      .delete(notes)
      .where(eq(notes.id, id))
      .returning();

    await this.invalidateCache();

    if (result.length > 0) {
      // Send a notification about the deleted note
      this.streamService.sendNoteChange(
        noteToDelete.userId as string,
        'delete',
        id
      );
      return true;
    }

    return false;
  }
}
