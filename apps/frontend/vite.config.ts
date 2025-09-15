import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import fs from 'fs';

// Always check for .env and log its presence
if (fs.existsSync('.env')) {
  console.log('Vite is reading env file: .env');
} else {
  console.warn('Vite could not find env file: .env');
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    host: true,
    origin: "http://0.0.0.0:3000",
  },
  build: {
    outDir: 'dist',
  },
});
