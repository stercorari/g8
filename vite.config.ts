import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  base: '/g8/',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: '*.gltf',
          dest: '.'
        },
        {
          src: '*.png',
          dest: '.'
        },
        {
          src: 'materials/**/*',
          dest: 'materials'
        }
      ]
    })
  ]
});
