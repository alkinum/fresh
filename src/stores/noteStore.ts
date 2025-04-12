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
  const viewMode = ref<'list' | 'grid'>('list');

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

    // Sort by date
    filtered.sort((a, b) => {
      const dateA = new Date(a.date.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2')).getTime();
      const dateB = new Date(b.date.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2')).getTime();
      return sortOrder.value === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  });

  // Actions
  async function fetchNotes(page = 1, limit = 20) {
    try {
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
    notes.value = [];
    currentPage.value = 1;
    fetchNotes(1);
  }

  function toggleFavorite(noteId: string) {
    const note = notes.value.find(n => n.id === noteId);
    if (note) {
      note.isFavorite = !note.isFavorite;

      // Update the note on the server
      fetch(`/api/note?id=${noteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isFavorite: note.isFavorite }),
      }).catch(error => {
        console.error('Error updating favorite status:', error);
        // Revert the change if the request fails
        note.isFavorite = !note.isFavorite;
      });
    }
  }

  function toggleSortOrder() {
    sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc';
  }

  function toggleViewMode() {
    viewMode.value = viewMode.value === 'list' ? 'grid' : 'list';
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query;
  }

  // Initialize notes with server data if available
  function initializeNotes(initialData: PaginatedNotes) {
    notes.value = initialData.items || [];
    totalPages.value = initialData.totalPages || 0;
    currentPage.value = initialData.currentPage || 1;
  }

  return {
    // State
    notes,
    currentPage,
    totalPages,
    isLoading,
    searchQuery,
    sortOrder,
    viewMode,
    selectedTagId,
    tags,
    tagCurrentPage,
    tagTotalPages,
    isTagLoading,

    // Computed
    filteredNotes,

    // Actions
    fetchNotes,
    fetchTags,
    selectTag,
    toggleFavorite,
    toggleSortOrder,
    toggleViewMode,
    setSearchQuery,
    initializeNotes
  };
}); 