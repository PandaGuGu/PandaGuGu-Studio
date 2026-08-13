import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: process.env.VCANVAS_BASE || '/',
  build: {
    outDir: 'dist',
    // Excalidraw 引擎(≈4MB)与第三方 vendor(≈3.5MB)是固有体积,
    // 已拆独立 chunk 便于缓存;主应用 index 仅 ~140kB。
    chunkSizeWarningLimit: 5000,
    rolldownOptions: {
      output: {
        // Code splitting: Excalidraw 引擎单拆 + 其余依赖归 vendor,
        // 避免主 chunk 超 500kB 警告,首屏/缓存粒度更优。
        manualChunks(id: string) {
          if (id.includes('@excalidraw')) return 'excalidraw'
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
})
