import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    files: {
      assets: 'public'
    },
    adapter: adapter({
      platformProxy: {
        configPath: 'wrangler.jsonc'
      }
    }),
    alias: {
      '@/*': './src/*'
    }
  }
};

export default config;
