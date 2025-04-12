import eventBus from '@/utils/eventBus';

export interface ToastConfig {
  message: string;
  type?: 'default' | 'error' | 'success';
  duration?: number;
}

export function useToast() {
  const show = (config: ToastConfig) => {
    eventBus.emit('toast:show', {
      message: config.message,
      type: config.type || 'default',
      duration: config.duration
    });
  };


  const success = (message: string, duration?: number) => {
    show({
      message,
      type: 'success',
      duration
    });
  };

  const error = (message: string, duration?: number) => {
    show({
      message,
      type: 'error',
      duration
    });
  };

  const hide = () => {
    eventBus.emit('toast:hide');
  };

  return {
    show,
    success,
    error,
    hide
  };
}

export const toast = useToast();
