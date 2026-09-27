// Tarayıcı içi demo sürümü: sunucu kodu (server/src) tarayıcıda sql.js üzerinde çalışır.
// Çıktı tek bir HTML dosyasına gömülür (bkz. scripts/build-demo.mjs).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

/** Sunucu kodundaki Node'a özgü modülleri tarayıcı karşılıklarıyla değiştirir. */
function browserServer() {
  const swaps = {
    [here('../server/src/crypto.js')]: here('../server/src/crypto.browser.js'),
  };
  return {
    name: 'fimar-browser-server',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source === 'express') return here('./src/demo/express.js');
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved && swaps[resolved.id]) return swaps[resolved.id];
      return null;
    },
  };
}

export default defineConfig({
  plugins: [browserServer(), react()],
  base: './',
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: here('./demo.html'),
      output: { inlineDynamicImports: true },
    },
  },
});
