<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  username: string;
}>();

const emit = defineEmits<{
  toggleSidebar: [];
}>();

const toggleSidebar = () => {
  emit('toggleSidebar');
};
</script>

<template>
  <div class="p-3 flex items-center space-x-2 border-b border-surface-light-10 shadow-inner-light">
    <div class="w-8 h-8 rounded-full bg-primary bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-md">
      <span class="text-sm">👤</span>
    </div>
    <span class="font-medium text-sm">{{ username }}</span>
    <button
      class="ml-auto md:hidden text-secondary hover-text-primary"
      @click="toggleSidebar"
    >
      <i class="fas fa-chevron-left"></i>
    </button>
  </div>
</template>