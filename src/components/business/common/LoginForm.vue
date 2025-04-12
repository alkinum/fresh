<script setup lang="ts">
import { ref } from 'vue';
import { createAuthClient } from "better-auth/vue";

const authClient = createAuthClient();

const emit = defineEmits<{
  closeLoginForm: [];
}>();

const closeModal = () => {
  emit('closeLoginForm');
};

// For tracking login state
const loading = ref(false);

// GitHub login handler
const loginWithGitHub = async () => {
  loading.value = true;

  try {
    // Use Better Auth client for GitHub login
    await authClient.signIn.social({
      provider: 'github',
    });
  } catch (error) {
    console.error('GitHub login error:', error);
    loading.value = false;
  }
};
</script>

<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
    <div class="bg-surface rounded-lg shadow-lg p-6 w-full max-w-md">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Sign in to FreshWrite</h2>
        <button @click="closeModal" class="text-secondary hover:text-primary">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="flex flex-col gap-4 mt-6">
        <button @click="loginWithGitHub" :disabled="loading"
          class="flex items-center justify-center gap-2 py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors">
          <span v-if="loading">
            <i class="fas fa-circle-notch fa-spin"></i>
          </span>
          <span v-else>
            <i class="fab fa-github"></i>
          </span>
          <span>Continue with GitHub</span>
        </button>
      </div>

      <p class="text-xs text-secondary mt-4 text-center">
        By signing in, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  </div>
</template>
