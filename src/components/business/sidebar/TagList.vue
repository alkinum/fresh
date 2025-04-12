<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useIntersectionObserver } from '@vueuse/core';
import { useNoteStore } from '@/stores/noteStore';
import type { PaginatedTags } from '@/types/note';
import TagListItem from './TagListItem.vue';

const props = defineProps<{
  initialTags?: PaginatedTags | null;
  isLoggedIn?: boolean;
}>();

// Initialize the note store
const noteStore = useNoteStore();

// Initialize tags from props if available
if (props.initialTags) {
  noteStore.tags = props.initialTags.items;
  noteStore.tagCurrentPage = props.initialTags.currentPage;
  noteStore.tagTotalPages = props.initialTags.totalPages;
}

// Computed property for selected tag
const selectedTagId = computed(() => noteStore.selectedTagId);
const isUserLoggedIn = computed(() => props.isLoggedIn === true);

// Create a target element for infinite scrolling
const tagsContainer = ref<HTMLElement | null>(null);
const loadingIndicator = ref<HTMLElement | null>(null);

// Set up intersection observer for infinite scrolling
const { stop } = useIntersectionObserver(
  loadingIndicator,
  (entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry && entry.isIntersecting && !noteStore.isTagLoading && noteStore.tagCurrentPage < noteStore.tagTotalPages && isUserLoggedIn.value) {
      fetchMoreTags();
    }
  },
  { threshold: 0.1 }
);

// Method to select a tag and filter notes
const selectTag = (tagId: string) => {
  noteStore.selectTag(tagId);
};

// Method to load more tags
const fetchMoreTags = async () => {
  if (noteStore.isTagLoading || noteStore.tagCurrentPage >= noteStore.tagTotalPages || !isUserLoggedIn.value) {
    return;
  }

  await noteStore.fetchTags(noteStore.tagCurrentPage + 1);
};

// Handle idle time to fetch more tags
let idleTimer: number | null = null;
const idleCheck = () => {
  if (idleTimer) {
    window.clearTimeout(idleTimer);
  }

  idleTimer = window.setTimeout(() => {
    if (!noteStore.isTagLoading && noteStore.tagCurrentPage < noteStore.tagTotalPages && isUserLoggedIn.value) {
      fetchMoreTags();
    }
  }, 3000); // 3 seconds of idle time
};

// Event listeners for idle detection
const setupIdleListeners = () => {
  window.addEventListener('mousemove', idleCheck);
  window.addEventListener('keypress', idleCheck);
  window.addEventListener('scroll', idleCheck);
  window.addEventListener('touchstart', idleCheck);
};

const cleanupIdleListeners = () => {
  window.removeEventListener('mousemove', idleCheck);
  window.removeEventListener('keypress', idleCheck);
  window.removeEventListener('scroll', idleCheck);
  window.removeEventListener('touchstart', idleCheck);

  if (idleTimer) {
    window.clearTimeout(idleTimer);
  }
};

const emit = defineEmits<{
  createTag: [];
}>();

// Lifecycle hooks
onMounted(() => {
  // Fetch tags if not already loaded from SSR and user is logged in
  if (!props.initialTags && isUserLoggedIn.value) {
    noteStore.fetchTags();
  }

  // Set up idle listeners only if user is logged in
  if (isUserLoggedIn.value) {
    setupIdleListeners();
  }
});

onUnmounted(() => {
  // Clean up observers and listeners
  stop();
  cleanupIdleListeners();
});
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Tags section -->
    <div class="p-3 border-b border-surface-light-10">
      <div class="text-xs text-secondary uppercase tracking-wider font-medium">Tags</div>
    </div>

    <!-- Content based on login state -->
    <template v-if="isUserLoggedIn">
      <!-- Tag list -->
      <nav class="flex-1 overflow-y-auto" ref="tagsContainer">
        <div class="p-2">
          <!-- Tags as menu items -->
          <div class="space-y-0.5" v-if="noteStore.tags.length > 0">
            <TagListItem v-for="tag in noteStore.tags" :key="tag.id" :name="tag.name" :color="tag.color" :count="tag.count || 0" :selected="selectedTagId === tag.id"
              @select="selectTag(tag.id)" />
          </div>
          
          <!-- Empty state when no tags are available -->
          <div v-else class="py-4 text-center text-secondary text-sm">
            <div class="mb-2">No tags yet</div>
            <div class="text-xs">
              Tags help you organize your notes
            </div>
          </div>

          <!-- Loading indicator for infinite scrolling -->
          <div v-if="noteStore.tagCurrentPage < noteStore.tagTotalPages" ref="loadingIndicator" class="py-2 text-center">
            <div v-if="noteStore.isTagLoading" class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary"></div>
            <span v-else class="text-xs text-secondary">Scroll for more tags</span>
          </div>
        </div>
      </nav>
    </template>
    
    <!-- Not logged in state -->
    <template v-else>
      <div class="flex-1 flex flex-col items-center justify-center p-4 text-center">
        <div class="text-sm text-secondary mb-2">
          Sign in to access your tags
        </div>
        <div class="text-xs text-tertiary">
          Create and manage tags to organize your notes
        </div>
      </div>
    </template>
  </div>
</template>