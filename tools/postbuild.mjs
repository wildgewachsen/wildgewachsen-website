// tools/postbuild.mjs
// Laeuft nach jedem astro build: entfernt die internen Styleguide-Seiten aus
// dist/, damit sie nie deployed werden (Dev-Server zeigt sie weiterhin).
import { readdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
let entfernt = 0;
for (const f of readdirSync(DIST)) {
  if (f.startsWith('styleguide') && f.endsWith('.html')) {
    rmSync(resolve(DIST, f));
    entfernt++;
  }
}
console.log(`postbuild: ${entfernt} Styleguide-Seite(n) aus dist entfernt`);
