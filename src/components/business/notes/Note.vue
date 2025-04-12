<script setup lang="ts">
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
</script>

<template>
  <div class="note-card bg-surface border border-surface-light-10 rounded-lg p-3 mb-3 shadow-md hover-shadow-glow transition duration-200 relative overflow-hidden"
    @click="handleOpenNote">
    <!-- Color indicator -->
    <div class="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b" :class="`bg-${colorIndicator}-500 from-${colorIndicator}-400 to-${colorIndicator}-600`"></div>

    <div class="ml-2 flex justify-between items-center mb-2">
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

    <div class="ml-2 prose prose-invert">
      <h3 class="text-base font-medium mb-1">{{ title }}</h3>
      <div class="text-sm text-secondary note-content" v-html="renderedContent"></div>
    </div>

    <div class="mt-2 ml-2 flex gap-1">
      <span v-for="tag in tags" :key="tag.id" class="inline-block bg-surface-light-30 text-xs px-2 py-0.5 rounded border"
        :class="`text-${tag.color}-400 border-${tag.color}-400/20`"># {{ tag.name }}</span>
    </div>
  </div>
</template>

<style scoped>
.note-content {
  max-height: 100px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.note-content :deep(p) {
  margin-bottom: 0.5rem;
}

.note-content :deep(img) {
  max-width: 100%;
  height: auto;
}

.note-content :deep(pre) {
  margin: 0;
  padding: 0.5rem;
  border-radius: 0.25rem;
  overflow-x: auto;
}
</style>