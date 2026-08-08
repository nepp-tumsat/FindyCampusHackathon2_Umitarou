import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import ssrPlugin from 'vite-ssr-components/plugin'
import agents from 'agents/vite'

export default defineConfig({
  build: {
    minify: true
  },
  // WSL上の/mnt/c配下ではファイルシステムの変更通知が届かずHMRが効かないため、pollingに切り替える
  server: {
    watch: {
      usePolling: true,
      interval: 300
    }
  },
  plugins: [
    agents(),
    cloudflare(),
    ssrPlugin({
      hotReload: {
        ignore: ['./src/client/**/*.tsx']
      }
    }),
    react()
  ]
})
