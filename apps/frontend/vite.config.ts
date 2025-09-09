import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import fs from 'fs';

// Log which env file is being read
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
if (fs.existsSync(envFile)) {
  console.log(`Vite is reading env file: ${envFile}`);
  
} else {
  console.warn(`Vite could not find env file: ${envFile}`);
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
    outDir: 'build',
  },
});
