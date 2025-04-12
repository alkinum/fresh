import { createApp } from 'vue';
import { createPinia } from 'pinia';

// Create pinia instance
const pinia = createPinia();

// Export a function that enables Pinia for all Vue components
export default (app: ReturnType<typeof createApp>) => {
  app.use(pinia);
}; 