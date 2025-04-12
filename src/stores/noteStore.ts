import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { NoteItem, PaginatedNotes, PaginatedTags, Tag } from '@/types/note';

export const useNoteStore = defineStore('note', () => {
  // State
  const notes = ref<NoteItem[]>([]);
  const currentPage = ref(1);
  const totalPages = ref(0);
  const isLoading = ref(false);
  const selectedTagId = ref<string | null>(null);
  const searchQuery = ref('');
  const sortOrder = ref<'asc' | 'desc'>('desc');

  // Cache for notes by tag
  const notesByTag = ref<Record<string, {
    notes: NoteItem[];
    currentPage: number;
    totalPages: number;
    lastFetched: number;
  }>>({});

  // Tags state
  const tags = ref<Tag[]>([]);
  const tagCurrentPage = ref(1);
  const tagTotalPages = ref(0);
  const isTagLoading = ref(false);

  // Computed
  const filteredNotes = computed(() => {
    let filtered = [...notes.value];

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter(note =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        note.tags.some(tag => tag.name.toLowerCase().includes(query))
      );
    }

    // First sort by favorite status
    filtered.sort((a, b) => {
      // First priority: favorite status (true comes before false)
      if (a.isFavorite !== b.isFavorite) {
        return a.isFavorite ? -1 : 1;
      }
      
      // Second priority: date based on sort order
      const dateA = new Date(a.date.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2')).getTime();
      const dateB = new Date(b.date.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2')).getTime();
      return sortOrder.value === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  });

  // Getter for currently visible notes (based on filters, sorting, etc.)
  const currentNotes = computed(() => {
    return filteredNotes.value;
  });

  // Handle newly saved note
  function addNewNote(newNote: NoteItem) {
    // Check if there's an active search query
    if (searchQuery.value) {
      // If there's a search query, clear it
      searchQuery.value = '';
    }

    // Check if a tag is currently selected
    if (selectedTagId.value) {
      // Check if the new note contains the currently selected tag
      const hasSelectedTag = newNote.tags.some(tag => tag.id === selectedTagId.value);

      if (!hasSelectedTag) {
        // If the new note doesn't contain the selected tag, clear the tag selection
        selectedTagId.value = null;
      }
    }

    // Add the new note to the beginning of the notes list
    notes.value.unshift(newNote);

    // Update caches
    // Update the "all" cache
    const allCacheKey = 'all';
    if (notesByTag.value[allCacheKey]) {
      notesByTag.value[allCacheKey].notes.unshift(newNote);
      // Update last fetched time and total pages
      notesByTag.value[allCacheKey].lastFetched = Date.now();
      // May need to increase total pages
      if (notesByTag.value[allCacheKey].notes.length % 20 === 1) { // Assuming 20 items per page
        notesByTag.value[allCacheKey].totalPages += 1;
      }
    } else {
      // If no cache exists, create a new one
      notesByTag.value[allCacheKey] = {
        notes: [newNote],
        currentPage: 1,
        totalPages: 1,
        lastFetched: Date.now()
      };
    }

    // For each tag in the new note, update its corresponding cache
    for (const tag of newNote.tags) {
      const tagCacheKey = tag.id;
      if (notesByTag.value[tagCacheKey]) {
        notesByTag.value[tagCacheKey].notes.unshift(newNote);
        notesByTag.value[tagCacheKey].lastFetched = Date.now();
        // May need to increase total pages
        if (notesByTag.value[tagCacheKey].notes.length % 20 === 1) {
          notesByTag.value[tagCacheKey].totalPages += 1;
        }
      } else {
        // If no cache exists for this tag, create a new one
        notesByTag.value[tagCacheKey] = {
          notes: [newNote],
          currentPage: 1,
          totalPages: 1,
          lastFetched: Date.now()
        };
      }
    }
  }

  // Updated to handle edits
  function updateNote(noteId: string, updates: Partial<NoteItem>) {
    // Find the note in the main notes array
    const noteIndex = notes.value.findIndex(n => n.id === noteId);
    if (noteIndex !== -1) {
      // Update the note with the new data
      notes.value[noteIndex] = { ...notes.value[noteIndex], ...updates };
    }

    // Update note in all caches
    for (const key in notesByTag.value) {
      const cachedNoteIndex = notesByTag.value[key].notes.findIndex(n => n.id === noteId);
      if (cachedNoteIndex !== -1) {
        notesByTag.value[key].notes[cachedNoteIndex] = { 
          ...notesByTag.value[key].notes[cachedNoteIndex], 
          ...updates 
        };
      }
    }
  }

  // Add a function to remove a note
  function removeNote(noteId: string) {
    // Remove from main notes array
    notes.value = notes.value.filter(n => n.id !== noteId);

    // Remove from all caches
    for (const key in notesByTag.value) {
      notesByTag.value[key].notes = notesByTag.value[key].notes.filter(n => n.id !== noteId);
      
      // May need to decrease total pages
      const notesPerPage = 20; // Assuming 20 items per page
      const totalItems = notesByTag.value[key].notes.length;
      notesByTag.value[key].totalPages = Math.ceil(totalItems / notesPerPage);
    }
  }

  // Actions
  async function fetchNotes(page = 1, limit = 20, forceRefresh = false) {
    try {
      // Check if we have cached data for this tag and it's not a force refresh
      const cacheKey = selectedTagId.value || 'all';
      const cachedData = notesByTag.value[cacheKey];

      // If we have cached data for this tag, this is page 1, and not forcing refresh
      if (cachedData && page === 1 && !forceRefresh && !searchQuery.value) {
        // Use cached data if it's less than 5 minutes old
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        if (cachedData.lastFetched > fiveMinutesAgo) {
          notes.value = cachedData.notes;
          currentPage.value = cachedData.currentPage;
          totalPages.value = cachedData.totalPages;
          console.log('Using cached notes for', cacheKey);
          return;
        }
      }

      isLoading.value = true;
      let url = `/api/note?page=${page}&limit=${limit}`;

      // Add tagId filter if selected
      if (selectedTagId.value) {
        url += `&tagId=${selectedTagId.value}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch notes: ${response.status}`);
      }

      const data = await response.json() as PaginatedNotes;

      if (page === 1) {
        notes.value = data.items;
      } else {
        // Append new notes to existing ones, avoiding duplicates
        const existingIds = new Set(notes.value.map(note => note.id));
        const newNotes = data.items.filter(note => !existingIds.has(note.id));
        notes.value = [...notes.value, ...newNotes];
      }

      totalPages.value = data.totalPages;
      currentPage.value = data.currentPage;

      // Update the cache for this tag
      notesByTag.value[cacheKey] = {
        notes: [...notes.value],
        currentPage: data.currentPage,
        totalPages: data.totalPages,
        lastFetched: Date.now()
      };

      return data;
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchTags(page = 1, limit = 20) {
    try {
      isTagLoading.value = true;
      const response = await fetch(`/api/noteTag?page=${page}&limit=${limit}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch tags: ${response.status}`);
      }

      const data = await response.json() as PaginatedTags;

      if (page === 1) {
        tags.value = data.items;
      } else {
        // Append new tags to existing ones, avoiding duplicates
        const existingIds = new Set(tags.value.map(tag => tag.id));
        const newTags = data.items.filter((tag: Tag) => !existingIds.has(tag.id));
        tags.value = [...tags.value, ...newTags];
      }

      tagTotalPages.value = data.totalPages;
      tagCurrentPage.value = data.currentPage;
      return data;
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      isTagLoading.value = false;
    }
  }

  function selectTag(tagId: string | null) {
    if (selectedTagId.value === tagId) {
      selectedTagId.value = null;
    } else {
      selectedTagId.value = tagId;
    }

    // Reset notes and refetch with the new tag filter
    currentPage.value = 1;

    // Check if we have cached data for this tag
    const cacheKey = selectedTagId.value || 'all';
    const cachedData = notesByTag.value[cacheKey];

    if (cachedData) {
      // Use cached data temporarily
      notes.value = cachedData.notes;
      currentPage.value = cachedData.currentPage;
      totalPages.value = cachedData.totalPages;
    } else {
      // If no cached data, clear notes and wait for fetch
      notes.value = [];
    }

    // Fetch fresh data (this will use cache if recent)
    fetchNotes(1);
  }

  function toggleFavorite(noteId: string) {
    const note = notes.value.find(n => n.id === noteId);
    if (note) {
      // First, update locally immediately for responsive UI
      const newFavoriteStatus = !note.isFavorite;
      
      // Update the note locally with optimistic UI update
      updateNote(noteId, { isFavorite: newFavoriteStatus });

      // Then update the note on the server
      fetch(`/api/note?id=${noteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isFavorite: newFavoriteStatus }),
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to update favorite status');
        }
        return response.json();
      })
      .then(data => {
        // Update with the data returned from the server
        updateNote(noteId, data as NoteItem);
      })
      .catch(error => {
        console.error('Error updating favorite status:', error);
        // Revert the change if the request fails
        updateNote(noteId, { isFavorite: !newFavoriteStatus });
      });
    }
  }

  function toggleSortOrder() {
    sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc';
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query;
  }

  // Initialize notes with server data if available
  function initializeNotes(initialData: PaginatedNotes) {
    notes.value = initialData.items || [];
    totalPages.value = initialData.totalPages || 0;
    currentPage.value = initialData.currentPage || 1;

    // Also cache the initial data
    const cacheKey = selectedTagId.value || 'all';
    notesByTag.value[cacheKey] = {
      notes: [...notes.value],
      currentPage: initialData.currentPage || 1,
      totalPages: initialData.totalPages || 0,
      lastFetched: Date.now()
    };
  }

  // Clear cache for testing or when needed
  function clearCache() {
    notesByTag.value = {};
  }

  return {
    // State
    notes,
    currentPage,
    totalPages,
    isLoading,
    searchQuery,
    sortOrder,
    selectedTagId,
    tags,
    tagCurrentPage,
    tagTotalPages,
    isTagLoading,

    // Computed
    filteredNotes,
    currentNotes,

    // Actions
    fetchNotes,
    fetchTags,
    selectTag,
    toggleFavorite,
    toggleSortOrder,
    setSearchQuery,
    initializeNotes,
    clearCache,
    addNewNote,
    updateNote,
    removeNote
  };
}); 