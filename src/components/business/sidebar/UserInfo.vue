<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  username: string;
  isLoggedIn: boolean;
}>();

const emit = defineEmits<{
  toggleSidebar: [];
  openLoginForm: [];
}>();

const toggleSidebar = () => {
  emit('toggleSidebar');
};

const openLoginForm = () => {
  emit('openLoginForm');
};

// Get first letter of username for avatar
const avatarText = computed(() => {
  if (!props.isLoggedIn) return 'F';
  return props.username.charAt(0).toUpperCase();
});

// Generate random but consistent color based on username
const getAvatarColor = computed(() => {
  if (!props.isLoggedIn) return 'bg-primary';

  // Simple hash function for consistent color
  const hash = props.username.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);

  // List of pleasant background colors
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500'
  ];

  return colors[hash % colors.length];
});
</script>

<template>
  <div class="p-3 flex items-center space-x-2 border-b border-surface-light-10 shadow-inner-light">
    <!-- Avatar with first letter -->
    <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-md text-white font-medium" :class="getAvatarColor">
      <span class="text-sm">{{ avatarText }}</span>
    </div>

    <!-- Username or app name -->
    <span class="font-medium text-sm">{{ isLoggedIn ? username : 'FreshWrite' }}</span>

    <!-- Login button if not logged in -->
    <button v-if="!isLoggedIn" class="ml-auto mr-2 text-xs py-1 px-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors" @click="openLoginForm">
      Login
    </button>

    <!-- Toggle sidebar button (mobile only) -->
    <button class="ml-auto md:hidden text-secondary hover:text-primary" @click="toggleSidebar">
      <i class="fas fa-chevron-left"></i>
    </button>
  </div>
</template>