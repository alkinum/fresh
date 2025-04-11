<script setup lang="ts">
import { ref } from 'vue';
import TagListItem from './TagListItem.vue';

interface Tag {
  id: string;
  name: string;
  color: string;
  count: number;
}

const props = defineProps<{
  tags: Tag[];
}>();

const selectedTag = ref<string | null>(null);

const selectTag = (tagName: string) => {
  selectedTag.value = tagName === selectedTag.value ? null : tagName;
};

const emit = defineEmits<{
  createTag: [];
}>();

const handleCreateTag = () => {
  emit('createTag');
};
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Tags section -->
    <div class="p-3 border-b border-surface-light-10">
      <div class="text-xs text-secondary uppercase tracking-wider font-medium">Tags</div>
    </div>

    <!-- Tag list -->
    <nav class="flex-1 overflow-y-auto">
      <div class="p-2">
        <!-- Tags as menu items -->
        <div class="space-y-0.5">
          <TagListItem v-for="tag in tags" :key="tag.id" :name="tag.name" :color="tag.color" :count="tag.count" :selected="selectedTag === tag.name" @select="selectTag" />
        </div>
      </div>
    </nav>

    <!-- Create new tag button -->
    <div class="p-3 border-t border-surface-light-10 shadow-inner-light">
      <button
        class="w-full flex items-center justify-center text-xs text-secondary hover-text-primary py-1.5 bg-surface-dark/50 hover-bg-surface-light-30 rounded-md transition duration-150"
        @click="handleCreateTag">
        <i class="fas fa-plus mr-1.5"></i>
        <span>New Tag</span>
      </button>
    </div>
  </div>
</template>