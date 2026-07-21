import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'pdf',
              test: /node_modules[\\/](jspdf|jspdf-autotable|html2canvas|canvg|dompurify|fflate)/,
            },
            {
              name: 'excel',
              test: /node_modules[\\/](exceljs|file-saver|jszip)/,
            },
          ],
        },
      },
    },
  },
})
