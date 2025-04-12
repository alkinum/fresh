<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { toast } from '@/composable/toast';
import { useNoteStore } from '@/stores/noteStore';
import type { NoteItem } from '@/types/note';

const noteStore = useNoteStore();

const editorContent = ref('');
const editorId = ref('note-md-editor');
const isSaving = ref(false);

// Compute word count
const wordCount = computed(() => {
  if (!editorContent.value) return 0;
  return editorContent.value.trim().length;
});

const toolbars: any[] = [
  'bold',
  'underline',
  'italic',
  'strikeThrough',
  'title',
  'quote',
  '-',
  'unorderedList',
  'orderedList',
  'task',
  '-',
  'code',
  'link',
  'image',
  'table',
  '-',
  'revoke',
  'next',
  'preview',
];

watch(() => editorContent.value, (newValue) => {
  console.log('Editor content changed:', newValue);
});

// Function to save the note
const saveNote = async () => {
  if (!editorContent.value.trim()) {
    toast.error('Cannot save empty note');
    return;
  }

  try {
    isSaving.value = true;

    // Generate a simple title from content (first line or first few words)
    let title = editorContent.value.split('\n')[0].trim();
    if (!title) {
      title = editorContent.value.slice(0, 30).trim();
    }
    // Truncate long titles
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }

    // Get current date
    const today = new Date();
    const date = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;

    // Generate random color for the note
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    const colorIndicator = colors[Math.floor(Math.random() * colors.length)];

    const noteData = {
      title,
      content: editorContent.value,
      date,
      colorIndicator,
      isFavorite: false
    };

    const response = await fetch('/api/note', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(noteData)
    });

    if (!response.ok) {
      const errorData = await response.json() as { error?: string };
      throw new Error(errorData.error || 'Failed to save note');
    }

    const savedNote = await response.json() as NoteItem;

    // Show success message
    toast.success('Note saved successfully');

    // Clear editor content
    editorContent.value = '';

    // Directly pass the new saved note to noteStore, instead of refreshing the entire list
    noteStore.addNewNote(savedNote);

    // No longer need to emit event
    // emit('saved', savedNote);
  } catch (error) {
    console.error('Error saving note:', error);
    toast.error(error instanceof Error ? error.message : 'Failed to save note');
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="p-3 relative z-0">
    <div class="bg-gradient-editor rounded-lg overflow-hidden shadow-lg border border-surface-light-10">
      <!-- Editor content -->
      <div class="relative editor-container">
        <MdEditor :id="editorId" v-model="editorContent" theme="dark" :showCodeRowNumber="false" :toolbars="toolbars" :preview="false" :footers="[]"
          placeholder="Write something fresh here..." class="md-editor-custom" />
        <!-- Bottom toolbar -->
        <div class="flex justify-between items-center p-2 border-t border-surface-light-20 shadow-inner-light">
          <!-- Word count on the left -->
          <div class="text-sm text-secondary">{{ wordCount }}</div>
          <!-- Send button on the right -->
          <button class="send-button text-white px-3 py-1 rounded-md text-sm transition duration-150 shadow-md" @click="saveNote" :disabled="isSaving">
            <i class="fas fa-paper-plane mr-1"></i>
            <span>{{ isSaving ? 'Saving...' : 'Send' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.send-button {
  background-image: linear-gradient(to right, var(--color-primary), var(--color-primary-dark));
}

.send-button:hover {
  background-image: linear-gradient(to right, var(--color-primary-light), var(--color-primary));
}

.send-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.editor-container {
  min-height: 150px;
}

:deep(.md-editor-custom) {
  border: none;
  height: 100%;
  min-height: 150px;
}

:deep(.md-editor) {
  border: none;
}

:deep(.md-editor-dark) {
  --md-color: var(--color-text-primary);
  --md-bk-color: transparent;
}

:deep(.md-editor-toolbar-item) {
  margin: 0;
  padding: 0;
  width: 24px;
  height: 24px;
}

:deep(svg.md-editor-icon) {
  box-sizing: content-box;
  color: var(--color-text-primary);
}

:deep(.md-editor-content) {
  min-height: 10rem;
}

:deep(.md-editor-input) {
  font-size: 0.875rem;
  padding: 0.75rem;
}

:deep(.md-editor-menu) {
  background-color: var(--color-background);
}
</style>