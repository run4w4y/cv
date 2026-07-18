import cloudflare from '@astrojs/cloudflare'
import react from '@astrojs/react'
import { defineConfig, sessionDrivers } from 'astro/config'

export default defineConfig({
  adapter: cloudflare({
    imageService: 'compile',
  }),
  devToolbar: {
    enabled: false,
  },
  integrations: [react()],
  output: 'server',
  session: {
    driver: sessionDrivers.lruCache(),
  },
  vite: {
    ssr: {
      noExternal: ['@cv/contracts', '@cv/renderer', 'qrcode'],
    },
  },
})
