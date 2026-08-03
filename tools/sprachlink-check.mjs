/**
 * Gate: Sprachumschalter im Header zeigt auf das ECHTE Sprach-Gegenstueck.
 *
 * Prueft im gebauten dist/ fuer jede Seite:
 *   1. Der Header-Sprachlink (a.site-header__lang) existiert.
 *   2. Sein Ziel ist identisch mit dem hreflang-Gegenstueck DERSELBEN Seite.
 *   3. Das Ziel existiert als Datei im dist (kein 404).
 *
 * Warum es dieses Gate gibt: Bis 04.08.2026 zog der Umschalter seine Paare aus
 * dem eingefrorenen migration/site_snapshot.json. Jeder nach dem Cutover
 * (24.07.) neu gebaute Artikel fehlte darin und landete still auf der
 * Startseite statt auf seiner Uebersetzung (CEO-Befund am Auto-Artikel).
 * Still = niemand merkt es, deshalb ein hartes Gate statt Sichtpruefung.
 *
 * Aufruf: node tools/sprachlink-check.mjs   (setzt voraus: npm run build lief)
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(wurzel, 'dist');

/** Dokumentierte Ausnahmen: Seiten ohne eigenes hreflang-Paar. */
const AUSNAHMEN = new Map([
  // Impressum/Datenschutz: Live-Mapping der Alt-Site, Ziel traegt ein Fragment.
  ['/impressum', '/en/privacy'],
  ['/en/privacy', '/impressum#datenschutz'],
]);

const DOMAIN = 'https://wildgewachsen-australien.de';

function ohneDomain(href) {
  return href.startsWith(DOMAIN) ? href.slice(DOMAIN.length) || '/' : href;
}

function normal(pfad) {
  const p = ohneDomain(pfad).split('#')[0];
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}

/** dist-Dateipfad -> URL-Pfad (build.format 'preserve'). */
function urlPfad(datei) {
  const rel = datei.slice(dist.length).replace(/\\/g, '/');
  if (rel === '/index.html') return '/';
  if (rel.endsWith('/index.html')) return rel.slice(0, -'/index.html'.length) || '/';
  return rel.replace(/\.html$/, '');
}

/** Zielpfad -> existiert im dist? */
function zielExistiert(ziel) {
  const p = normal(ziel);
  const kandidaten =
    p === '/'
      ? ['index.html']
      : [`${p.slice(1)}.html`, `${p.slice(1)}/index.html`];
  return kandidaten.some((k) => existsSync(join(dist, k)));
}

const dateien = globSync('**/*.html', { cwd: dist })
  .map((f) => join(dist, f))
  .filter((f) => !f.includes('styleguide'));

let geprueft = 0;
let ohneLink = 0;
const fehler = [];

for (const datei of dateien) {
  const html = readFileSync(datei, 'utf8');
  const seite = urlPfad(datei);

  const linkTreffer = html.match(
    /<a[^>]*class="[^"]*site-header__lang[^"]*"[^>]*href="([^"]+)"/
  );
  if (!linkTreffer) {
    ohneLink += 1;
    continue;
  }
  const linkZiel = linkTreffer[1];
  geprueft += 1;

  // Erwartet: das hreflang-Gegenstueck derselben Seite.
  const hreflangs = [...html.matchAll(/hreflang="(de|en)"\s+href="([^"]+)"/g)];
  const de = hreflangs.find((m) => m[1] === 'de')?.[2];
  const en = hreflangs.find((m) => m[1] === 'en')?.[2];

  let erwartet;
  if (de && en) {
    // Das Gegenstueck ist der hreflang, der NICHT die Seite selbst ist.
    erwartet = normal(de) === normal(seite) ? en : de;
  } else if (AUSNAHMEN.has(normal(seite))) {
    erwartet = AUSNAHMEN.get(normal(seite));
  } else {
    fehler.push(`${seite}: kein hreflang-Paar in der Seite und keine dokumentierte Ausnahme`);
    continue;
  }

  if (normal(linkZiel) !== normal(erwartet)) {
    fehler.push(
      `${seite}: Sprachlink zeigt auf "${linkZiel}", erwartet "${ohneDomain(erwartet)}"` +
        (normal(linkZiel) === '/' || normal(linkZiel) === '/en'
          ? '  <-- Startseiten-Fallback, Paar fehlt!'
          : '')
    );
    continue;
  }

  if (!zielExistiert(linkZiel)) {
    fehler.push(`${seite}: Sprachlink-Ziel "${linkZiel}" existiert nicht im dist`);
  }
}

console.log(
  `Seiten mit Sprachlink: ${geprueft} geprueft` +
    (ohneLink ? ` · ${ohneLink} ohne Header-Sprachlink (uebersprungen)` : '')
);

if (fehler.length) {
  console.error(`\nSPRACHLINK-CHECK FEHLGESCHLAGEN (${fehler.length}):`);
  for (const f of fehler) console.error('  ' + f);
  process.exit(1);
}

console.log('SPRACHLINK-CHECK OK: jeder Umschalter zeigt auf sein echtes Gegenstueck.');
