// tools/_snapshot-basis.mjs
// Gemeinsame Basis der drei Snapshot-Gates: head-parity, urlmap-diff, klaro-diff.
//
// Seit dem Astro-Cutover (Go-Live 26.07.2026) existiert die alte handgeschriebene
// Site nicht mehr — sie wurde beim Cutover per `git rm` entfernt. Die Gates
// vergleichen deshalb NICHT mehr "live-Ordner gegen dist", sondern den
// eingefrorenen Snapshot `migration/site_snapshot.json` (Stand 22.07.2026, letzter
// Stand der Handschrift-Site: 45 Seiten, 2x21 Sitemap-URLs) gegen das frisch
// gebaute `dist/`.
//
// Der Snapshot ist ab jetzt ein Archiv-Artefakt und wird NICHT mehr neu erzeugt
// (sein Generator liegt in tools/_archiv/snapshot.mjs). Er bildet den Stand ab,
// den Google zum Cutover indexiert hatte — genau das macht ihn als Regressions-
// Basis wertvoll: was damals an SEO-Infrastruktur live war, darf nicht still
// verschwinden. Neue Seiten und neue Inhalte danach sind erlaubt und werden als
// Zuwachs gemeldet, nie als Fehler.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const HERE = dirname(fileURLToPath(import.meta.url));
export const RD = resolve(HERE, '..');
export const DIST = resolve(RD, 'dist');
export const SNAPSHOT = resolve(RD, 'migration', 'site_snapshot.json');
export const SITE = 'https://wildgewachsen-australien.de';

// Seiten des Snapshots, die bewusst NICHT in dist landen: die beiden
// Artikel-Vorlagen der Alt-Site (waren nie oeffentlich verlinkt, standen nie in
// der Sitemap und wurden schon von den Vorgaenger-Tools uebersprungen).
export const SNAPSHOT_SKIP = new Set([
  'blog/artikel-template.html',
  'blog/artikel-template-en.html',
]);

export function ladeSnapshot() {
  if (!existsSync(SNAPSHOT)) {
    console.error(`Snapshot fehlt: ${SNAPSHOT}`);
    console.error('Ohne migration/site_snapshot.json gibt es keine Vergleichsbasis.');
    process.exit(2);
  }
  return JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
}

export function pruefeDist() {
  if (!existsSync(DIST)) {
    console.error(`dist/ fehlt: ${DIST}`);
    console.error('Erst `npm run build` laufen lassen, dann das Gate erneut.');
    process.exit(2);
  }
}

/** Snapshot-Seiten ohne die Vorlagen — das sind die Seiten, die dist liefern muss. */
export function snapshotSeiten(snap) {
  return snap.pages.filter((p) => !SNAPSHOT_SKIP.has(p.file));
}

/**
 * Relativer Snapshot-Pfad (z.B. "blog/foo.html") -> tatsaechliche Datei in dist.
 * Primaer 1:1 (astro build.format 'preserve' spiegelt die Quell-Struktur), mit
 * Clean-URL-Fallback, falls das Build-Format je auf 'directory' wechselt.
 * Gibt den absoluten Pfad zurueck oder null.
 */
export function distDatei(rel) {
  const direkt = join(DIST, rel);
  if (existsSync(direkt) && statSync(direkt).isFile()) return direkt;
  const ohneExt = rel.replace(/\.html$/, '');
  const alsIndex = join(DIST, ohneExt, 'index.html');
  if (existsSync(alsIndex) && statSync(alsIndex).isFile()) return alsIndex;
  return null;
}

/** "blog/foo.html" -> "/blog/foo", "index.html" -> "/", "en/index.html" -> "/en/" */
export function relZuUrl(rel) {
  const ohneExt = rel.replace(/\.html$/, '');
  if (ohneExt === 'index') return '/';
  if (ohneExt.endsWith('/index')) return '/' + ohneExt.slice(0, -'index'.length);
  return '/' + ohneExt;
}

/** Absolute Live-URL -> relativer Dateipfad ("…/blog/foo" -> "blog/foo.html"). */
export function urlZuRel(url) {
  let pfad = url.replace(/^https?:\/\/[^/]+/, '').split('#')[0].split('?')[0];
  if (!pfad.startsWith('/')) pfad = '/' + pfad;
  if (pfad.endsWith('/')) return pfad.slice(1) + 'index.html';
  if (/\.[a-z0-9]+$/i.test(pfad)) return pfad.slice(1);
  return pfad.slice(1) + '.html';
}

/**
 * Kopf-Felder einer HTML-Datei — bewusst identisch zur Extraktion in
 * tools/_archiv/snapshot.mjs, damit Snapshot-Eintrag und dist-Seite
 * feldweise vergleichbar sind.
 */
export function kopfExtrahieren(file) {
  const html = readFileSync(file, 'utf8');
  const $ = cheerio.load(html);
  const jsonld = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      for (const node of Array.isArray(data) ? data : [data]) jsonld.push(node);
    } catch {
      jsonld.push({ '@type': 'PARSE_ERROR' });
    }
  });
  const blogPosting = jsonld.find((n) => n['@type'] === 'BlogPosting');
  return {
    lang: $('html').attr('lang') ?? null,
    title: $('head > title').first().text() || null,
    metaDescription: $('meta[name="description"]').attr('content') ?? null,
    canonical: $('link[rel="canonical"]').attr('href') ?? null,
    hreflang: $('link[rel="alternate"][hreflang]')
      .map((_, el) => ({ hreflang: $(el).attr('hreflang'), href: $(el).attr('href') }))
      .get(),
    ogImage: $('meta[property="og:image"]').attr('content') ?? null,
    jsonldTypes: jsonld.map((n) => n['@type'] ?? 'UNKNOWN'),
    datePublished: blogPosting?.datePublished ?? null,
    dateModified: blogPosting?.dateModified ?? null,
    goatcounter: /data-goatcounter=/.test(html),
    klaro: /klaro/i.test(html),
  };
}

/** hreflang-Liste -> vergleichbarer, sortierter String-Satz. */
export function hreflangSatz(liste) {
  return new Set((liste ?? []).map((h) => `${h.hreflang}=${h.href}`));
}

/**
 * Bewusste, CEO-freigegebene Abweichungen vom Snapshot (z.B. ein absichtlich
 * umbenannter Slug). Gleiche Kultur wie die alte paritaet-ausnahmen.json:
 * jede Ausnahme steht mit Grund in der Datei und wird sichtbar gemeldet,
 * nie still verschluckt. Format:
 * [{ "seite": "blog/foo.html", "feld": "canonical", "grund": "..." }]
 * "feld": "*" nimmt die ganze Seite aus dem Vergleich.
 */
export function ladeAusnahmen() {
  const pfad = resolve(HERE, 'snapshot-ausnahmen.json');
  if (!existsSync(pfad)) return [];
  try {
    return JSON.parse(readFileSync(pfad, 'utf8'));
  } catch (e) {
    console.error(`snapshot-ausnahmen.json ist kein gueltiges JSON: ${e.message}`);
    process.exit(2);
  }
}

export function istAusnahme(ausnahmen, seite, feld) {
  return ausnahmen.some((a) => a.seite === seite && (a.feld === feld || a.feld === '*'));
}
