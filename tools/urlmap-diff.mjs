// tools/urlmap-diff.mjs
// URL-Kontinuitaets-Gate. Aufruf: node tools/urlmap-diff.mjs   (nach `npm run build`)
//
// Beantwortet vier Fragen, die zusammen "keine URL ist kaputt" beweisen:
//   A  Liefert dist noch jede Seite, die zum Cutover live war?   (Snapshot-Seiten)
//   B  Liefert dist noch jede URL, die zum Cutover in der Sitemap stand und damit
//      bei Google im Index gelandet ist?                          (Snapshot-Sitemaps)
//   C  Loest jede URL der HEUTIGEN, handgepflegten Sitemaps auch wirklich auf?
//      Eine Sitemap-URL ohne Datei ist ein 404 im Index.          (public/sitemap.xml)
//   D  Welche gebauten Seiten stehen in keiner Sitemap?           (INFO)
//
// A-C sind hart (Exit 1). D ist ein Hinweis: neue Artikel muessen laut
// Projekt-Regel in die Sitemap, aber ein fehlender Eintrag soll den Build nicht
// blockieren, sondern sichtbar sein.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  DIST,
  RD,
  ladeSnapshot,
  pruefeDist,
  snapshotSeiten,
  distDatei,
  urlZuRel,
  relZuUrl,
} from './_snapshot-basis.mjs';

pruefeDist();
const snap = ladeSnapshot();

// Statics, die der Host zwingend ausliefern muss (siehe DEPLOY.md "Pflicht-Statics").
const PFLICHT_STATICS = ['robots.txt', 'sitemap.xml', 'en/sitemap.xml', 'google33b9e68b2006aa30.html'];

function sitemapUrls(datei) {
  if (!existsSync(datei)) return null;
  return [...readFileSync(datei, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

function distHtml() {
  const out = [];
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (!['assets', 'css', 'js', '_astro'].includes(e.name)) walk(p);
      } else if (e.name.endsWith('.html')) {
        out.push(relative(DIST, p).replaceAll('\\', '/'));
      }
    }
  })(DIST);
  return out.sort();
}

const fehlt = { a: [], b: [], c: [], statics: [] };

// --- A: Seiten des Cutover-Snapshots ---
const altSeiten = snapshotSeiten(snap);
for (const s of altSeiten) if (!distDatei(s.file)) fehlt.a.push(relZuUrl(s.file));

// --- B: URLs der Sitemaps zum Cutover-Zeitpunkt ---
const altUrls = [...snap.sitemaps.root.urls, ...snap.sitemaps.en.urls];
for (const u of altUrls) if (!distDatei(urlZuRel(u))) fehlt.b.push(u);

// --- C: URLs der heutigen, handgepflegten Sitemaps ---
const heuteRoot = sitemapUrls(join(RD, 'public', 'sitemap.xml'));
const heuteEn = sitemapUrls(join(RD, 'public', 'en', 'sitemap.xml'));
if (heuteRoot === null) fehlt.c.push('public/sitemap.xml existiert nicht');
if (heuteEn === null) fehlt.c.push('public/en/sitemap.xml existiert nicht');
const heuteUrls = [...(heuteRoot ?? []), ...(heuteEn ?? [])];
for (const u of heuteUrls) if (!distDatei(urlZuRel(u))) fehlt.c.push(u);

// --- Pflicht-Statics ---
for (const s of PFLICHT_STATICS) {
  const p = join(DIST, s);
  if (!existsSync(p) || !statSync(p).isFile()) fehlt.statics.push(s);
}

// --- D: gebaute Seiten ohne Sitemap-Eintrag (INFO) ---
const inSitemap = new Set(heuteUrls.map(urlZuRel));
const ohneSitemap = distHtml().filter((f) => !inSitemap.has(f) && !PFLICHT_STATICS.includes(f));

console.log(
  `Snapshot-Seiten: ${altSeiten.length} · Snapshot-Sitemap-URLs: ${altUrls.length} · ` +
    `heutige Sitemap-URLs: ${heuteUrls.length} · gebaute HTML-Seiten: ${distHtml().length}`,
);

const block = (titel, liste, zeichen = '  - ') => {
  if (!liste.length) return;
  console.log(`\n${titel} (${liste.length}):`);
  for (const f of liste) console.log(zeichen + f);
};

block('FAIL A — Seite war zum Cutover live, fehlt jetzt im dist', fehlt.a);
block('FAIL B — URL stand zum Cutover in der Sitemap, loest jetzt nicht auf', fehlt.b);
block('FAIL C — URL steht in der HEUTIGEN Sitemap, loest aber nicht auf', fehlt.c);
block('FAIL — Pflicht-Static fehlt im dist', fehlt.statics);
block('INFO — gebaute Seite ohne Eintrag in einer Sitemap', ohneSitemap, '  + ');

const summe = fehlt.a.length + fehlt.b.length + fehlt.c.length + fehlt.statics.length;
if (!summe) console.log('\nURL-MAP OK: jede Alt-URL und jede Sitemap-URL wird vom Build geliefert.');
process.exit(summe ? 1 : 0);
