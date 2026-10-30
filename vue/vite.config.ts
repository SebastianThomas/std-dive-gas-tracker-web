import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      vue(),
      vueDevTools(),
      // Skip under Vitest: it never serves over HTTPS, and mkcert's startup check calls GitHub's
      // API, which flakes out CI with rate-limit 403s (same as the dive-logger frontend).
      ...(process.env.VITEST ? [] : [mkcert()]),
      viteStaticCopy({
        targets: [
          {
            src: 'node_modules/@fortawesome/fontawesome-free/webfonts/*',
            dest: 'webfonts',
          },
        ],
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      https: {},
      port: 5193,
      strictPort: true,
    },
  }
})
