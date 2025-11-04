// vite.config.js

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        calculatorEn: 'calculator-en.html',
        calculatorZh: 'calculator-zh.html',
        poke: 'poke-team-predictor.html',
        podcast: 'podcast-project.html',
        medicalScribe: 'medical-scribe.html',
        littleScholarsBot: 'little-scholars-bot.html' // <-- add this
      }
    }
  }
})