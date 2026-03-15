import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      // Node built-ins that appear in transitive deps (serialport, meshcore tcp_connection)
      // are already externalized by Vite; list them explicitly to suppress the auto-externalize warnings.
      external: ['net', 'stream', 'fs', 'path', 'os', 'util', 'child_process'],
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/'))
            return 'react';
          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/d3-') ||
            id.includes('node_modules/victory-')
          )
            return 'recharts';
          if (
            id.includes('node_modules/leaflet') ||
            id.includes('node_modules/react-leaflet') ||
            id.includes('node_modules/@react-leaflet')
          )
            return 'leaflet';
          if (id.includes('node_modules/@meshtastic') || id.includes('node_modules/protobufjs'))
            return 'meshtastic';
          if (id.includes('node_modules/@liamcottle/meshcore')) return 'meshcore';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  css: {
    postcss: path.resolve(__dirname, 'postcss.config.cjs'),
  },
  server: {
    port: 5173,
  },
});
