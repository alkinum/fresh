<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import eventBus from '@/utils/eventBus';
import type { Events } from '@/utils/eventBus';

type ToastType = 'default' | 'error' | 'success';

interface ToastConfig {
  message: string;
  type: ToastType;
  duration?: number;
}

const visible = ref(false);
const message = ref('');
const type = ref<ToastType>('default');
const timeoutId = ref<number | null>(null);

const show = (config: ToastConfig) => {
  if (timeoutId.value) {
    clearTimeout(timeoutId.value);
  }

  message.value = config.message;
  type.value = config.type || 'default';
  visible.value = true;

  const duration = config.duration || 3000;
  timeoutId.value = window.setTimeout(() => {
    hide();
  }, duration);
};

const hide = () => {
  visible.value = false;
  if (timeoutId.value) {
    clearTimeout(timeoutId.value);
    timeoutId.value = null;
  }
};

// 监听事件总线的事件
onMounted(() => {
  eventBus.on('toast:show', (config) => {
    show(config);
  });
  
  eventBus.on('toast:hide', hide);
});

// 组件卸载时移除事件监听
onUnmounted(() => {
  eventBus.off('toast:show');
  eventBus.off('toast:hide');
});

// 获取对应类型的图标
const getIcon = () => {
  switch (type.value) {
    case 'success':
      return 'fa-check-circle';
    case 'error':
      return 'fa-exclamation-circle';
    default:
      return 'fa-info-circle';
  }
};

// 获取对应类型的颜色样式
const getTypeClass = () => {
  switch (type.value) {
    case 'success':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'error':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-blue-100 text-blue-800 border-blue-200';
  }
};
</script>

<template>
  <Teleport to="body">
    <transition 
      name="toast-fade"
      enter-active-class="transform transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-[-20px]"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transform transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-[-20px]"
    >
      <div 
        v-if="visible" 
        class="toast-container"
        :class="getTypeClass()"
      >
        <i class="fas" :class="getIcon()"></i>
        <span class="toast-message">{{ message }}</span>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid;
  min-width: 280px;
  max-width: 80vw;
}

.toast-message {
  font-size: 0.875rem;
  line-height: 1.25rem;
  word-break: break-word;
}
</style>
