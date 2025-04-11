<script setup lang="ts">
import { ref, computed } from 'vue';
import Note from './Note.vue';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface NoteItem {
  id: string;
  title: string;
  content: string;
  date: string;
  tags: Tag[];
  colorIndicator: string;
  isFavorite: boolean;
}

// Mock notes data
const notes = ref<NoteItem[]>([
  {
    id: '1',
    title: 'Development Roadmap',
    content: 'Q2 2025 development plan with key milestones and feature prioritization.',
    date: '2025/04/01',
    tags: [{ id: '5', name: 'Projects', color: 'purple' }],
    colorIndicator: 'purple',
    isFavorite: false
  },
  {
    id: '2',
    title: 'Product Design Ideas',
    content: 'Collection of new design concepts for the mobile application interface.',
    date: '2025/04/05',
    tags: [
      { id: '2', name: 'Ideas', color: 'green' },
      { id: '3', name: 'Work', color: 'yellow' }
    ],
    colorIndicator: 'green',
    isFavorite: true
  },
  {
    id: '3',
    title: 'Meeting Notes',
    content: 'Notes from the weekly team sync about project progress and blockers.',
    date: '2025/04/09',
    tags: [{ id: '1', name: 'General', color: 'blue' }],
    colorIndicator: 'blue',
    isFavorite: false
  }
]);

const searchQuery = ref('');
const sortOrder = ref('desc'); // 'asc' or 'desc'
const viewMode = ref('list'); // 'list' or 'grid'

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

const toggleFavorite = (noteId: string) => {
  const note = notes.value.find(n => n.id === noteId);
  if (note) {
    note.isFavorite = !note.isFavorite;
  }
};

const openNote = (noteId: string) => {
  console.log('Opening note:', noteId);
  // Logic to open the note in editor would go here
};

const showNoteMenu = (noteId: string, event: MouseEvent) => {
  console.log('Showing menu for note:', noteId, event);
  // Logic to show context menu would go here
};

const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc';
};

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'list' ? 'grid' : 'list';
};
</script>

<template>
  <div class="flex-1 overflow-auto p-3 relative z-0">
    <!-- Section header with search -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 space-y-2 sm:space-y-0">
      <h2 class="text-lg font-semibold">All Notes</h2>
      <div class="flex items-center w-full sm:w-auto">
        <!-- Search bar -->
        <div class="relative flex-1 sm:w-64 mr-2">
          <i class="fas fa-search absolute left-3 top-2.5 text-secondary text-xs"></i>
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Search notes..." 
            class="w-full bg-surface border border-surface-light-20 text-primary py-1.5 pl-8 pr-3 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-light/50 shadow-md"
          >
        </div>
        <!-- View options -->
        <div class="flex">
          <button 
            class="p-1.5 rounded-md hover-bg-surface text-secondary hover-text-primary text-sm"
            @click="toggleSortOrder"
          >
            <i class="fas" :class="sortOrder === 'desc' ? 'fa-sort-amount-down' : 'fa-sort-amount-up'"></i>
          </button>
          <button 
            class="p-1.5 rounded-md hover-bg-surface text-secondary hover-text-primary text-sm"
            @click="toggleViewMode"
          >
            <i class="fas" :class="viewMode === 'list' ? 'fa-th-list' : 'fa-th'"></i>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Notes list -->
    <div :class="viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3' : ''">
      <Note 
        v-for="note in filteredNotes"
        :key="note.id"
        v-bind="note"
        @toggle-favorite="toggleFavorite"
        @open-note="openNote"
        @show-menu="showNoteMenu"
      />
    </div>
    
    <!-- Empty state -->
    <div 
      v-if="filteredNotes.length === 0" 
      class="text-center text-secondary mt-8"
    >
      <div class="text-3xl mb-2">✏️</div>
      <p class="text-sm">No notes yet. Write something!</p>
    </div>
  </div>
</template> 