/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'primary': '#0f3b8a',
        'primary-light': '#1d4ed8',
        'primary-dark': '#0f2362',
        'background': '#1c1c1c',
        'surface': '#252525',
        'surface-light': '#303030',
        'surface-dark': '#1e1e1e',
        'text-primary': '#e2e8f0',
        'text-secondary': '#94a3b8'
      },
      boxShadow: {
        'inner-light': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
        'glow': '0 0 15px rgba(30, 64, 175, 0.15)'
      }
    }
  },
  plugins: [],
}