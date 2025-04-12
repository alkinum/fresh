<script setup lang="ts">
import { ref } from 'vue';

interface Tag {
  id: string;
  name: string;
  color: string;
}

const props = defineProps<{
  id: string;
  title: string;
  content: string;
  renderedContent: string;
  date: string;
  tags: Tag[];
  colorIndicator: string;
  isFavorite: boolean;
}>();

const emit = defineEmits<{
  toggleFavorite: [id: string];
  openNote: [id: string];
  showMenu: [id: string, event: MouseEvent];
}>();

// Track expanded state
const isExpanded = ref(false);

const handleToggleFavorite = () => {
  emit('toggleFavorite', props.id);
};

const handleOpenNote = () => {
  emit('openNote', props.id);
};

const handleShowMenu = (event: MouseEvent) => {
  event.stopPropagation();
  emit('showMenu', props.id, event);
};

// Handle double click to expand/collapse
const handleDoubleClick = (event: MouseEvent) => {
  event.stopPropagation(); // Prevent the click from triggering handleOpenNote
  isExpanded.value = !isExpanded.value;
};
</script>

<template>
  <div class="note-card bg-surface border border-surface-light-10 rounded-lg p-2.5 mb-2.5 shadow-md hover-shadow-glow transition duration-200 relative overflow-hidden"
    @click="handleOpenNote" @dblclick="handleDoubleClick">
    <div class="flex justify-between items-center mb-1.5">
      <span class="text-xs text-secondary font-mono">{{ date }}</span>
      <div class="flex items-center space-x-1">
        <button class="p-1 rounded hover-bg-surface-light-30 transition-colors" :class="isFavorite ? 'text-yellow-400' : 'text-secondary hover-text-yellow-400'"
          @click.stop="handleToggleFavorite">
          <i class="fas fa-star text-xs"></i>
        </button>
        <button class="text-secondary hover-text-primary p-1 rounded hover-bg-surface-light-30 transition-colors" @click.stop="handleShowMenu">
          <i class="fas fa-ellipsis-h text-xs"></i>
        </button>
      </div>
    </div>

    <div class="prose prose-invert">
      <h3 class="text-base font-medium mb-1">{{ title }}</h3>
      <div class="text-sm text-secondary note-content markdown-content" 
           :class="{ 'expanded': isExpanded }"
           v-html="renderedContent"></div>
    </div>

    <div class="mt-2 flex flex-wrap gap-1">
      <span v-for="tag in tags" :key="tag.id" 
        class="inline-block text-xs px-2 py-0.5 rounded"
        :style="{ backgroundColor: `${tag.color}30`, color: tag.color, borderColor: `${tag.color}50` }"># {{ tag.name }}</span>
    </div>
    
    <!-- Expand/collapse indicator -->
    <div v-if="isExpanded" class="text-center mt-2">
      <button class="text-xs text-secondary hover-text-primary" @click.stop="isExpanded = false">
        <i class="fas fa-chevron-up mr-1"></i>Collapse
      </button>
    </div>
  </div>
</template>

<style scoped>
.note-content {
  max-height: 90px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  transition: max-height 0.3s ease, -webkit-line-clamp 0.3s ease;
}

.note-content.expanded {
  max-height: none;
  -webkit-line-clamp: unset;
  display: block;
  overflow: auto;
  max-height: 400px; /* Set a reasonable max height for very long notes */
}

/* Markdown content styling */
.markdown-content :deep(p) {
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  margin-top: 0.75rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
  line-height: 1.2;
}

.markdown-content :deep(h1) { font-size: 1.2rem; }
.markdown-content :deep(h2) { font-size: 1.1rem; }
.markdown-content :deep(h3) { font-size: 1rem; }
.markdown-content :deep(h4) { font-size: 0.95rem; }
.markdown-content :deep(h5) { font-size: 0.9rem; }
.markdown-content :deep(h6) { font-size: 0.85rem; }

.markdown-content :deep(code) {
  background-color: rgba(55, 65, 81, 0.3);
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.85em;
}

.markdown-content :deep(pre) {
  margin: 0.5rem 0;
  padding: 0.5rem;
  border-radius: 0.25rem;
  overflow-x: auto;
  background-color: rgba(30, 41, 59, 0.5);
}

.markdown-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
  font-size: 0.8em;
  line-height: 1.5;
}

.markdown-content :deep(blockquote) {
  border-left: 3px solid var(--color-surface-light);
  padding-left: 0.75rem;
  margin: 0.5rem 0;
  color: var(--color-text-secondary);
  font-style: italic;
}

.markdown-content :deep(ul), 
.markdown-content :deep(ol) {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}

.markdown-content :deep(li) {
  margin-bottom: 0.25rem;
}

.markdown-content :deep(a) {
  color: #60a5fa;
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

.markdown-content :deep(hr) {
  border: 0;
  border-top: 1px solid var(--color-surface-light);
  margin: 0.75rem 0;
}

.markdown-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.25rem;
  margin: 0.5rem 0;
}

.markdown-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5rem 0;
  font-size: 0.85em;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-surface-light);
  text-align: left;
}

.markdown-content :deep(th) {
  background-color: rgba(55, 65, 81, 0.3);
}

/* Custom tag styling */
.markdown-content :deep(.note-tag) {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.4rem;
  margin: 0 0.1rem;
  border-radius: 0.25rem;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
  white-space: nowrap;
}

.markdown-content :deep(.note-tag:hover) {
  transform: translateY(-1px);
  filter: brightness(1.1);
}
</style>