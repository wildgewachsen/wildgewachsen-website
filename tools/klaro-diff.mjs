// tools/klaro-diff.mjs
// Vergleicht die Klaro-Einbindung Seite fuer Seite: live vs dist (1:1-Mandat).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RD = resolve(HERE, '..');
const LIVE = resolve(RD, '..', 'website');
const DIST = resolve(RD, 'dist');

function walk(root) {
  const out = [];
  (function w(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (!['assets', 'css', 'js', '_astro'].includes(e.name)) w(p);
      } else if (e.name.endsWith('.html') && !e.name.includes('template')) {
        out.push(relative(root, p).replaceAll('\\', '/'));
      }
    }
  })(root);
  return out;
}

let diffs = 0;
for (const f of walk(LIVE)) {
  const distF = join(DIST, f);
  if (!existsSync(distF)) continue;
  const l = /klaro/i.test(readFileSync(join(LIVE, f), 'utf8'));
  const d = /klaro/i.test(readFileSync(distF, 'utf8'));
  if (l !== d) {
    diffs++;
    console.log(`${f} · live: ${l ? 'ja' : 'nein'} · neu: ${d ? 'ja' : 'nein'}`);
  }
}
console.log(`Klaro-Abweichungen: ${diffs}`);
process.exit(diffs ? 1 : 0);
