import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { dataAttribution } from './data-attribution'

export default defineConfig({
  base: './',
  plugins: [svelte(), dataAttribution()],
  worker: { format: 'es' },
  build: { target: 'es2022', outDir: '../../dist', emptyOutDir: true }
})
