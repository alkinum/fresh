<script setup lang="ts">
import { ref } from 'vue';
import UserInfo from './UserInfo.vue';
import TagList from './TagList.vue';
import PageSwitcher from './PageSwitcher.vue';

interface Tag {
  id: string;
  name: string;
  color: string;
  count: number;
}

interface Page {
  id: string;
  name: string;
  icon: string;
  active?: boolean;
}

const props = defineProps<{
  username: string;
  visible: boolean;
}>();

const emit = defineEmits<{
  toggleSidebar: [];
  createTag: [];
  switchPage: [id: string];
}>();

// Mock page data
const pages = ref<Page[]>([
  { id: 'all-notes', name: 'All Notes', icon: 'fa-notes-medical', active: true }
]);

// Mock tags data
const tags = ref<Tag[]>([
  { id: '1', name: 'General', color: 'blue', count: 23 },
  { id: '2', name: 'Ideas', color: 'green', count: 8 },
  { id: '3', name: 'Work', color: 'yellow', count: 14 },
  { id: '4', name: 'Personal', color: 'red', count: 5 },
  { id: '5', name: 'Projects', color: 'purple', count: 9 }
]);

const handleToggleSidebar = () => {
  emit('toggleSidebar');
};

const handleCreateTag = () => {
  emit('createTag');
};

const handleSwitchPage = (pageId: string) => {
  // Update active state
  pages.value.forEach(page => {
    page.active = page.id === pageId;
  });
  emit('switchPage', pageId);
};
</script>

<template>
  <div 
    class="w-full md:w-56 bg-gradient-sidebar transition-all duration-300 flex flex-col shadow-md border-r border-surface-light-10 relative z-10 h-full"
    :class="{ 'hidden': !visible }"
  >
    <UserInfo 
      :username="username"
      @toggle-sidebar="handleToggleSidebar"
    />
    
    <PageSwitcher
      :pages="pages"
      @switch-page="handleSwitchPage"
    />
    
    <TagList 
      :tags="tags"
      @create-tag="handleCreateTag"
    />
  </div>
</template>