<script setup lang="ts">
const props = defineProps<{
  name: string;
  color: string;
  count: number;
  selected?: boolean;
}>();

const emit = defineEmits<{
  select: [name: string];
}>();

const handleSelect = () => {
  emit('select', props.name);
};
</script>

<template>
  <a 
    href="#" 
    class="flex items-center py-1.5 px-3 rounded-md text-sm hover-bg-surface-light-30 text-primary group transition duration-150"
    :class="{ 'bg-surface-light-30': selected }"
    @click.prevent="handleSelect"
  >
    <span 
      class="w-2 h-2 rounded-full mr-2 shadow-sm" 
      :class="`bg-${color}-400 shadow-${color}-400/50`"
    ></span>
    <span>{{ name }}</span>
    <span class="ml-auto text-xs text-secondary opacity-0 group-hover:opacity-100">{{ count }}</span>
  </a>
</template>