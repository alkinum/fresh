<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import Note from './Note.vue';
import { useNoteStore } from '@/stores/noteStore';
import type { PaginatedNotes } from '@/types/note';

// Props definition
const props = defineProps<{
  initialNotes?: PaginatedNotes | null;
  isLoggedIn: boolean;
}>();

// Initialize the note store
const noteStore = useNoteStore();

// Initialize the store with SSR data if available
if (props.initialNotes) {
  noteStore.initializeNotes(props.initialNotes);
}

// Set up local refs
const hasInitialData = ref(!!props.initialNotes);
let scrollContainer: HTMLElement | null = null;

// Use store values and computed properties
const loadMoreThreshold = 200; // pixels from bottom

function handleScroll() {
  if (!scrollContainer || noteStore.isLoading || noteStore.currentPage >= noteStore.totalPages) {
    return;
  }

  const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
  const bottomReached = scrollHeight - scrollTop - clientHeight < loadMoreThreshold;

  if (bottomReached) {
    noteStore.fetchNotes(noteStore.currentPage + 1);
  }
}

// Expose store methods
const toggleFavorite = (noteId: string) => {
  noteStore.toggleFavorite(noteId);
};

const openNote = (noteId: string) => {
  console.log('Opening note:', noteId);
  // Logic to open the note in editor would go here
};

const showNoteMenu = (noteId: string, event: MouseEvent) => {
  console.log('Showing menu for note:', noteId, event);
  // Logic to show context menu would go here
};

// Lifecycle hooks
onMounted(() => {
  if (props.isLoggedIn) {
    // Set up scroll listener
    scrollContainer = document.querySelector('.notes-container');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
    }

    // If we don't have initial data from SSR, fetch it
    if (!hasInitialData.value) {
      noteStore.fetchNotes();
    }
  }
});

// Clean up the scroll listener
onUnmounted(() => {
  if (scrollContainer) {
    scrollContainer.removeEventListener('scroll', handleScroll);
  }
});

// Watch for search query changes to reset the list
watch(() => noteStore.searchQuery, (newValue) => {
  if (newValue === '') {
    // Only refetch if we cleared the search and had previous results
    if (noteStore.notes.length > 0) {
      noteStore.fetchNotes();
    }
  }
});

// Watch for tag selection changes
watch(() => noteStore.selectedTagId, (newTagId) => {
  console.log('Selected tag changed to:', newTagId);
});
</script>

<template>
  <div class="flex-1 overflow-auto p-3 relative z-0 notes-container">
    <!-- Section header with search -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 space-y-2 sm:space-y-0">
      <h2 class="text-lg font-semibold">
        <template v-if="noteStore.selectedTagId">
          <span>
            Notes tagged with
            <span class="font-bold" v-for="tag in noteStore.tags.filter(t => t.id === noteStore.selectedTagId)" :key="tag.id" :style="`color: ${tag.color}`">
              {{ tag.name }}
            </span>
          </span>
        </template>
        <template v-else>All Notes</template>
      </h2>
      <div class="flex items-center w-full sm:w-auto">
        <!-- Search bar -->
        <div class="relative flex-1 sm:w-64 mr-2">
          <i class="fas fa-search absolute left-3 top-2.5 text-secondary text-xs"></i>
          <input v-model="noteStore.searchQuery" type="text" placeholder="Search notes..."
            class="w-full bg-surface border border-surface-light-20 text-primary py-1.5 pl-8 pr-3 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-light/50 shadow-md">
        </div>
        <!-- Sort option only -->
        <div class="flex">
          <button class="p-1.5 rounded-md hover-bg-surface text-secondary hover-text-primary text-sm" @click="noteStore.toggleSortOrder">
            <i class="fas" :class="noteStore.sortOrder === 'desc' ? 'fa-sort-amount-down' : 'fa-sort-amount-up'"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Notes list (only list mode now) -->
    <div>
      <Note v-for="note in noteStore.currentNotes" :key="note.id" v-bind="note" @toggle-favorite="toggleFavorite" @open-note="openNote" @show-menu="showNoteMenu" />
    </div>

    <!-- Loading indicator -->
    <div v-if="noteStore.isLoading" class="text-center py-4">
      <div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
      <p class="mt-2 text-sm text-secondary">Loading more notes...</p>
    </div>

    <!-- Empty state -->
    <div v-if="noteStore.currentNotes.length === 0 && !noteStore.isLoading" class="text-center text-secondary mt-16">
      <div class="text-4xl mb-4">✏️</div>
      <p class="text-sm">
        <template v-if="isLoggedIn">
          <template v-if="noteStore.selectedTagId">
            No notes with this tag yet. Write something and add the tag!
          </template>
          <template v-else>
            No notes yet. Write something!
          </template>
        </template>
        <template v-else>
          Please log in to view your notes.
        </template>
      </p>
    </div>

    <!-- End of list indicator -->
    <div v-if="noteStore.currentNotes.length > 0 && noteStore.currentPage >= noteStore.totalPages && !noteStore.isLoading" class="text-center py-4 text-sm text-secondary">
      No more notes to load
    </div>
  </div>
</template>

<style scoped>
.notes-container {
  height: 100%;
  scrollbar-width: thin;
  scrollbar-color: var(--color-primary-light) transparent;
}

.notes-container::-webkit-scrollbar {
  width: 6px;
}

.notes-container::-webkit-scrollbar-track {
  background: transparent;
}

.notes-container::-webkit-scrollbar-thumb {
  background-color: var(--color-primary-light);
  border-radius: 6px;
}
</style>