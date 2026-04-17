import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    dbHost: '',
    dbPort: 3306,
    dbUser: '',
    dbPassword: '',
    dbName: 'dash_imapsync',
    adminUsername: 'admin',
    adminPassword: '',
    authSecret: '',
    authSessionTtlHours: 24,
    imapsyncBinary: 'imapsync',
    imapsyncSecretKey: '',
    imapsyncConcurrency: 1,
    imapsyncQueuePollMs: 5000
  }
})
