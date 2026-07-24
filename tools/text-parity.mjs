// tools/text-parity.mjs
// Beweist das "rein optisch"-Mandat auf Block-Ebene: jeder sichtbare Text-Block
// der Live-Seite (Absatz, Ueberschrift, Listenpunkt, Tabellenzelle, Zitat,
// Chart-Label ...) muss in der neu gebauten Seite (dist) wortgleich vorkommen.
// Neue UI-Bloecke duerfen dazukommen; fehlende Live-Bloecke sind ein Befund.
// Aufruf: node tools/text-parity.mjs <live.html> <dist.html> [minLaenge=20]
import { readFileSync } from 'node:fs';
import * as cheerio from 'cheerio';

const [liveFile, distFile, minLenArg] = process.argv.slice(2);
if (!liveFile || !distFile) {
  console.error('Aufruf: node tools/text-parity.mjs <live.html> <dist.html> [minLaenge]');
  process.exit(2);
}
const MIN = Number(minLenArg ?? 20);
const BLOCKS =
  'p, h1, h2, h3, h4, h5, h6, li, td, th, figcaption, blockquote, dt, dd, summary, caption, text, a, button, label';

// Emojis/Piktogramme zaehlen als PRAESENTATION, nicht als Text-Inhalt:
// der v2-Rollout ersetzt Alt-Emojis durch handgezeichnete SVG-Icons
// (Playbook-Pflicht "kein einziges Alt-Emoji"). Beide Seiten werden
// gleich normalisiert, der eigentliche Wortlaut bleibt hart verglichen.
const norm = (s) =>
  s
    .replace(/[\u{FE0F}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // freistehendes "$" am Blockanfang war das Alt-Icon der Geld-Karte;
    // Betraege wie "$30" bleiben unberuehrt (kein Leerzeichen dahinter noetig)
    .replace(/^\$ /, '');

// '><' -> '> <': minifiziertes HTML klebt sonst Nachbar-Texte zusammen.
// <br> zaehlt als Leerzeichen (Adress-Zeilen etc.), sonst kleben Zeilen aneinander.
const lies = (file) =>
  readFileSync(file, 'utf8')
    .replace(/<br\b[^>]*>/gi, ' ')
    .replaceAll('><', '> <');

function leafBloecke(file) {
  const $ = cheerio.load(lies(file));
  $('script, style, noscript, template').remove();
  const out = [];
  $(BLOCKS).each((_, el) => {
    // Nur "Blatt"-Bloecke: Elemente ohne eigene Block-Kinder, sonst matchen
    // riesige Container statt echter Absaetze.
    if ($(el).find(BLOCKS).length > 0) return;
    const t = norm($(el).text());
    if (t.length >= MIN) out.push(t);
  });
  return [...new Set(out)];
}

const liveBloecke = leafBloecke(liveFile);
const $dist = cheerio.load(lies(distFile));
$dist('script, style, noscript, template').remove();
const distText = norm($dist('body').text());

// Bewusste, CEO-freigegebene Inhalts-Abweichungen: Live-Bloecke, die im
// Neubau absichtlich ersetzt wurden. Jede Ausnahme steht mit Grund in
// tools/paritaet-ausnahmen.json und wird hier sichtbar gemeldet, nie still.
let ausnahmen = [];
try {
  ausnahmen = JSON.parse(
    readFileSync(new URL('./paritaet-ausnahmen.json', import.meta.url), 'utf8'),
  );
} catch {}
const istAusnahme = (b) => ausnahmen.some((a) => b.startsWith(norm(a.block)));

const fehlendRoh = liveBloecke.filter((b) => !distText.includes(b));
const bewusst = fehlendRoh.filter(istAusnahme);
const fehlend = fehlendRoh.filter((b) => !istAusnahme(b));
if (bewusst.length)
  console.log(`Bewusste Abweichungen laut paritaet-ausnahmen.json: ${bewusst.length}`);

console.log(`Live-Bloecke (>= ${MIN} Zeichen): ${liveBloecke.length}`);
console.log(`Davon in der neuen Seite enthalten: ${liveBloecke.length - fehlend.length}`);
if (fehlend.length) {
  console.log(`\nFEHLEND (${fehlend.length}):`);
  for (const b of fehlend) console.log('  - ' + b.slice(0, 140));
  process.exit(1);
}
console.log('PARITAET OK: kein Inhalts-Block fehlt.');
