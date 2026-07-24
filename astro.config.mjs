// @ts-check
import { defineConfig } from 'astro/config';

// URL-Paritaet zum Ist-Zustand (Kartierung 2026-07-21):
// - build.format 'file' erzeugt dist/blog/<slug>.html wie im heutigen Website-Repo;
//   Cloudflare Pages liefert diese Dateien extensionslos aus (Clean URLs ohne Slash).
//   Astro-Default 'directory' wuerde alle URLs auf Trailing-Slash aendern -> SEO-Bruch.
// - Canonicals/hreflang werden NICHT generiert, sondern aus migration/site_snapshot.json uebernommen.
export default defineConfig({
  site: 'https://wildgewachsen-australien.de',
  trailingSlash: 'ignore',
  build: {
    // 'preserve' statt 'file': behaelt die Quell-Struktur exakt bei
    // (blog/slug.astro -> blog/slug.html UND en/index.astro -> en/index.html).
    // 'file' hatte en/index.astro faelschlich zu en.html gemacht (URL-Bruch /en/).
    format: 'preserve',
  },
});
