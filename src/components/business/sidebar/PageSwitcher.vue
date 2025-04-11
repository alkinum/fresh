<script setup lang="ts">
interface Page {
  id: string;
  name: string;
  icon: string;
  active?: boolean;
}

const props = defineProps<{
  pages: Page[];
}>();

const emit = defineEmits<{
  switchPage: [id: string];
}>();

const handleSwitchPage = (pageId: string) => {
  emit('switchPage', pageId);
};
</script>

<template>
  <div class="p-3 space-y-2">
    <button 
      v-for="page in pages"
      :key="page.id"
      :class="[
        'w-full py-1.5 px-3 rounded-md text-sm flex items-center transition duration-150 shadow-md text-white',
        page.active 
          ? 'bg-primary' 
          : 'bg-gradient-to-r from-primary to-primary-dark hover-gradient-primary'
      ]"
      @click="handleSwitchPage(page.id)"
    >
      <i :class="`fas ${page.icon} mr-2`"></i>
      <span>{{ page.name }}</span>
    </button>
  </div>
</template> 