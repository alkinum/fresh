// @ts-check
import { defineConfig, envField } from 'astro/config';
import vue from '@astrojs/vue';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  integrations: [vue()],
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()]
  },
  env: {
    schema: {
      BETTER_AUTH_SECRET: envField.string({ access: 'secret', context: 'server' }),
      GITHUB_CLIENT_ID: envField.string({ access: 'public', context: 'server' }),
      GITHUB_CLIENT_SECRET: envField.string({ access: 'secret', context: 'server' }),
    },
  },
});
