import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  // This worktree shares dependencies with the main checkout, but not Vite's cache.
  cacheDir: 'node_modules/.vite-dungeon-sector-map',
  plugins: [react(), viteSingleFile()],
  base: './',
})
