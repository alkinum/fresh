<script setup lang="ts">
import { ref } from 'vue';
import { useNoteStore } from '@/stores/noteStore';
import type { PaginatedTags } from '@/types/note';
import LoginForm from '../common/LoginForm.vue';
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
  isLoggedIn: boolean;
  initialTags?: PaginatedTags | null;
}>();

const emit = defineEmits<{
  toggleSidebar: [];
  createTag: [];
  switchPage: [id: string];
}>();

// Initialize store
const noteStore = useNoteStore();

// Mock page data
const pages = ref<Page[]>([
  { id: 'all-notes', name: 'All Notes', icon: 'fa-notes-medical', active: true }
]);

// Control login form visibility
const showLoginForm = ref(false);

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

const openLoginForm = () => {
  showLoginForm.value = true;
};

const closeLoginForm = () => {
  showLoginForm.value = false;
};
</script>

<template>
  <div 
    class="w-full md:w-56 bg-gradient-sidebar transition-all duration-300 flex flex-col shadow-md border-r border-surface-light-10 relative z-10 h-full"
    :class="{ 'hidden': !visible }"
  >
    <UserInfo 
      :username="username"
      :isLoggedIn="isLoggedIn"
      @toggle-sidebar="handleToggleSidebar"
      @open-login-form="openLoginForm"
    />
    
    <PageSwitcher
      :pages="pages"
      @switch-page="handleSwitchPage"
    />
    
    <TagList 
      :initialTags="initialTags"
      :isLoggedIn="isLoggedIn"
      @create-tag="handleCreateTag"
    />
    
    <!-- Login Form Modal -->
    <LoginForm v-if="showLoginForm" @close-login-form="closeLoginForm" />
  </div>
</template>