// tools/parity-alle.mjs
// Laeuft ueber ALLE Live-Seiten (ausser Templates + GSC-Verify) und prueft
// Block-Paritaet gegen die gleichnamige dist-Seite. Exit 1 bei irgendeinem Fail.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIVE = resolve(HERE, '..', '..', 'website');
const DIST = resolve(HERE, '..', 'dist');
const MIN = 20;
const SKIP = new Set(['blog/artikel-template.html', 'blog/artikel-template-en.html', 'google33b9e68b2006aa30.html']);
const SKIP_DIRS = new Set(['assets', 'css', 'js', 'node_modules', '.git']);
const BLOCKS =
  'p, h1, h2, h3, h4, h5, h6, li, td, th, figcaption, blockquote, dt, dd, summary, caption, text, a, button, label';

// Normalisierung synchron zu tools/text-parity.mjs (Referenz-Implementierung):
// <br> als Leerzeichen (Adress-Zeilen), Emojis/Piktogramme + freistehendes
// "$"-Icon am Blockanfang zaehlen als Praesentation, nicht als Text-Inhalt.
const norm = (s) =>
  s
    .replace(/[\u{FE0F}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\$ /, '');
const lies = (f) =>
  readFileSync(f, 'utf8')
    .replace(/<br\b[^>]*>/gi, ' ')
    .replaceAll('><', '> <');

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) files.push(...walk(p));
    } else if (name.endsWith('.html')) files.push(p);
  }
  return files.sort();
}

function leafBloecke($) {
  const out = [];
  $(BLOCKS).each((_, el) => {
    if ($(el).find(BLOCKS).length > 0) return;
    const t = norm($(el).text());
    if (t.length >= MIN) out.push(t);
  });
  return [...new Set(out)];
}

// Bewusste, CEO-freigegebene Inhalts-Abweichungen (Grund je Eintrag in der
// JSON-Datei); werden gemeldet statt als FAIL gezaehlt, nie still verschluckt.
let ausnahmen = [];
try {
  ausnahmen = JSON.parse(
    readFileSync(new URL('./paritaet-ausnahmen.json', import.meta.url), 'utf8'),
  );
} catch {}
const istAusnahme = (b) => ausnahmen.some((a) => b.startsWith(norm(a.block)));
let bewusstGesamt = 0;

let fails = 0;
let seiten = 0;
for (const liveFile of walk(LIVE)) {
  const rel = relative(LIVE, liveFile).replaceAll('\\', '/');
  if (SKIP.has(rel)) continue;
  seiten++;
  const distFile = join(DIST, rel);
  if (!existsSync(distFile)) {
    console.log(`FEHLT  ${rel} (keine dist-Datei)`);
    fails++;
    continue;
  }
  const $live = cheerio.load(lies(liveFile));
  $live('script, style, noscript, template').remove();
  const bloecke = leafBloecke($live);
  const $dist = cheerio.load(lies(distFile));
  $dist('script, style, noscript, template').remove();
  const distText = norm($dist('body').text());
  const fehlendRoh = bloecke.filter((b) => !distText.includes(b));
  const bewusst = fehlendRoh.filter(istAusnahme);
  const fehlend = fehlendRoh.filter((b) => !istAusnahme(b));
  bewusstGesamt += bewusst.length;
  if (fehlend.length) {
    fails++;
    console.log(`FAIL   ${rel}: ${fehlend.length}/${bloecke.length} Bloecke fehlen`);
    for (const f of fehlend.slice(0, 4)) console.log(`         - ${f.slice(0, 110)}`);
    if (fehlend.length > 4) console.log(`         ... +${fehlend.length - 4} weitere`);
  } else {
    const hinweis = bewusst.length ? ` (+${bewusst.length} bewusste Abweichung(en))` : '';
    console.log(`OK     ${rel} (${bloecke.length} Bloecke)${hinweis}`);
  }
}
if (bewusstGesamt)
  console.log(`Bewusste Abweichungen laut paritaet-ausnahmen.json gesamt: ${bewusstGesamt}`);
console.log(`\n${seiten} Seiten geprueft, ${fails} mit Befund.`);
process.exit(fails ? 1 : 0);
