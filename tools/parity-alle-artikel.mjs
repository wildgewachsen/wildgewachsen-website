// tools/parity-alle-artikel.mjs
// Laesst den Block-Paritaets-Check ueber ALLE Artikel-Paare laufen (DE + EN,
// Slugs identisch zwischen live und dist). Zero-Agent-Verifikation fuer Phase 4/5.
import { readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RD = resolve(HERE, '..');
const LIVE = resolve(RD, '..', 'website');

const paare = [];
for (const f of readdirSync(resolve(LIVE, 'blog')).filter((f) => f.endsWith('.html') && !f.includes('template'))) {
  paare.push([`blog/${f}`, `blog/${f}`]);
}
for (const f of readdirSync(resolve(LIVE, 'en')).filter((f) => f.endsWith('.html'))) {
  // nur Artikel: Seiten wie index/about/blog/contact/our-journey/privacy auslassen
  if (['index.html', 'about.html', 'blog.html', 'contact.html', 'our-journey.html', 'privacy.html'].includes(f)) continue;
  paare.push([`en/${f}`, `en/${f}`]);
}

let ok = 0;
const probleme = [];
for (const [livePfad, distPfad] of paare) {
  const dist = resolve(RD, 'dist', distPfad);
  if (!existsSync(dist)) {
    probleme.push(`${distPfad}: DIST-DATEI FEHLT`);
    continue;
  }
  try {
    execFileSync('node', [resolve(HERE, 'text-parity.mjs'), resolve(LIVE, livePfad), dist], { stdio: 'pipe' });
    ok++;
  } catch (e) {
    const out = e.stdout?.toString() ?? '';
    const fehlend = out.split('\n').filter((l) => l.startsWith('  - '));
    probleme.push(`${distPfad}: ${fehlend.length} Bloecke fehlen\n${fehlend.slice(0, 4).join('\n')}`);
  }
}

console.log(`Paare geprueft: ${paare.length} · PASS: ${ok} · Probleme: ${probleme.length}`);
for (const p of probleme) console.log('\n' + p);
process.exit(probleme.length ? 1 : 0);
