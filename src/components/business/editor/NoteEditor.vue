<script setup lang="ts">
import { ref, watch } from 'vue';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';

// 编辑器内容
const editorContent = ref('');
const editorId = ref('note-md-editor');

// 向父组件发送保存事件
const emit = defineEmits<{
  save: [content: string];
}>();

// 自定义工具栏配置 - 使用 any[] 类型来避免类型错误
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

function handleSave() {
  emit('save', editorContent.value);
}

// 编辑器内容变化监听
watch(() => editorContent.value, (newValue) => {
  console.log('Editor content changed:', newValue);
});
</script>

<template>
  <div class="p-3 relative z-0">
    <div class="bg-gradient-editor rounded-lg overflow-hidden shadow-lg border border-surface-light-10">
      <!-- Editor content -->
      <div class="relative editor-container">
        <MdEditor
          :id="editorId"
          v-model="editorContent"
          theme="dark"
          :showCodeRowNumber="false"
          :toolbars="toolbars"
          :preview="false"
          :footers="[]"
          placeholder="Write something fresh here..."
          class="md-editor-custom"
        />
        <!-- Bottom toolbar -->
        <div class="flex justify-end items-center p-2 border-t border-surface-light-20 shadow-inner-light">
          <button
            class="send-button text-white px-3 py-1 rounded-md text-sm transition duration-150 shadow-md"
            @click="handleSave"
          >
            <i class="fas fa-paper-plane mr-1"></i>
            <span>Send</span>
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
</style>