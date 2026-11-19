import { defineConfig } from 'vite'
import { siteContent } from './plugins/site-content.ts'

export default defineConfig({
  plugins: [siteContent()],
  server: { host: true },
})
