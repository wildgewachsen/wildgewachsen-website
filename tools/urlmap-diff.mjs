// tools/urlmap-diff.mjs
// URL-Kontinuitaets-Beweis: jede HTML-Datei + jedes Static der Live-Site muss
// im dist an IDENTISCHEM Pfad liegen (Templates ausgenommen). Extras werden
// gelistet (nach postbuild sollten keine da sein).
import { readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RD = resolve(HERE, '..');
const LIVE = resolve(RD, '..', 'website');
const DIST = resolve(RD, 'dist');

function htmlDateien(root, skipDirs) {
  const out = [];
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (!skipDirs.includes(e.name)) walk(p);
      } else if (e.name.endsWith('.html') || ['robots.txt', 'sitemap.xml'].includes(e.name)) {
        out.push(relative(root, p).replaceAll('\\', '/'));
      }
    }
  })(root);
  return out;
}

const liveSet = htmlDateien(LIVE, ['assets', 'css', 'js']).filter((f) => !f.includes('template'));
const distSet = htmlDateien(DIST, ['assets', 'css', 'js', '_astro']);

const fehlend = liveSet.filter((f) => !distSet.includes(f));
const extra = distSet.filter((f) => !liveSet.includes(f));

console.log(`Live-Dateien: ${liveSet.length} · Dist-Dateien: ${distSet.length}`);
if (fehlend.length) {
  console.log('\nFEHLT IM DIST:');
  for (const f of fehlend) console.log('  - ' + f);
}
if (extra.length) {
  console.log('\nEXTRA IM DIST (nicht live):');
  for (const f of extra) console.log('  + ' + f);
}
if (!fehlend.length && !extra.length) console.log('URL-MAP IDENTISCH.');
process.exit(fehlend.length ? 1 : 0);
