import { defineConfig } from 'vite';

export default defineConfig({
  // Chemins relatifs : le build fonctionne quel que soit le dossier où il est servi.
  base: './',
  // Les sprites restent dans assets/ à la racine du monorepo et sont servis tels quels.
  publicDir: '../assets',
  // Accessible depuis les autres machines du réseau local.
  server: { port: 5173, host: true },
  preview: { host: true },
  build: {
    target: 'es2022',
    // Phaser pèse à lui seul plus d'un mégaoctet minifié.
    chunkSizeWarningLimit: 2000,
  },
});
