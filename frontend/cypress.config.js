import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    setupNodeEvents(on, config) {
      // Nenhum plugin necessário por enquanto
    },
  },
  env: {
    apiUrl: 'http://localhost:3333',
  },
})
