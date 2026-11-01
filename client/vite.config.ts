import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';

// mode=demo : 서버 없이 도는 체험판을 한 파일(HTML)로 빌드 → 휴대폰 링크로 공유
export default defineConfig(({ mode }) => ({
  root: resolve(import.meta.dirname),
  base: './',
  define: { __DEMO__: JSON.stringify(mode === 'demo') },
  server: { fs: { allow: [resolve(import.meta.dirname, '..')] }, proxy: { '/api': 'http://localhost:2567' } },
  build: {
    outDir: mode === 'demo' ? 'dist-demo' : 'dist',
    emptyOutDir: true,
    assetsInlineLimit: mode === 'demo' ? 100_000_000 : 4096,
    chunkSizeWarningLimit: 3000,
  },
  plugins: mode === 'demo' ? [viteSingleFile()] : [],
}));
