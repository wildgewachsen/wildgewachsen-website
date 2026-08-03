/**
 * DE⇄EN-Gegenstueck je Seite fuer den Sprachumschalter im Header.
 *
 * Quelle der Wahrheit (seit 04.08.2026): die hreflang-Tags der SEITEN SELBST.
 * Jede Artikel-/Seiten-Astro-Datei traegt ihr Paar im <Fragment slot="head">;
 * dieselben Tags sieht Google. Sie werden hier zur Build-Zeit ausgelesen,
 * dadurch waechst der Umschalter automatisch mit jedem neuen Artikel mit.
 *
 * Ergaenzend (nicht ueberschreibend): migration/site_snapshot.json fuer
 * Sonderfaelle ohne eigenes hreflang-Paar in der Datei, konkret
 * /en/privacy ⇄ /impressum#datenschutz (Live-Mapping der Alt-Site).
 *
 * WARUM DER UMBAU: Der Snapshot ist ein eingefrorenes Migrations-Artefakt vom
 * 24.07.2026 (Cutover). Jeder danach neu gebaute Artikel fehlte darin, der
 * Umschalter fiel auf die Startseite zurueck (CEO-Befund 04.08. am
 * Auto-Artikel). Der Snapshot bleibt fuer die Migrations-Historie, ist aber
 * nicht mehr die Paar-Quelle.
 */
import snapshot from '../../migration/site_snapshot.json';

const DOMAIN = 'https://wildgewachsen-australien.de';

/** Domain abschneiden; Wert behaelt den Live-Stil (z.B. '/en/' mit Slash). */
function ohneDomain(href) {
  return href.startsWith(DOMAIN) ? href.slice(DOMAIN.length) || '/' : href;
}

/** Schluessel-Normalisierung: trailing Slash weg (ausser Root), Fragment weg. */
function alsSchluessel(pfad) {
  const p = ohneDomain(pfad).split('#')[0];
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}

const paare = new Map();

/** Beide Richtungen eintragen, ohne bestehende Eintraege zu ueberschreiben. */
function eintragen(deHref, enHref) {
  if (!deHref || !enHref) return;
  if (deHref.includes('{{') || enHref.includes('{{')) return; // Template-Platzhalter
  const de = alsSchluessel(deHref);
  const en = alsSchluessel(enHref);
  if (!paare.has(de)) paare.set(de, ohneDomain(enHref));
  if (!paare.has(en)) paare.set(en, ohneDomain(deHref));
}

// 1. Primaer: hreflang-Tags aus den Seiten selbst (waechst automatisch mit).
const seitenQuellen = import.meta.glob('../pages/**/*.astro', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const HREFLANG_RE = /hreflang=["'](de|en)["']\s+href=["']([^"']+)["']/g;

for (const quelle of Object.values(seitenQuellen)) {
  if (typeof quelle !== 'string') continue;
  let deHref = null;
  let enHref = null;
  for (const treffer of quelle.matchAll(HREFLANG_RE)) {
    if (treffer[1] === 'de' && !deHref) deHref = treffer[2];
    if (treffer[1] === 'en' && !enHref) enHref = treffer[2];
  }
  eintragen(deHref, enHref);
}

// 2. Ergaenzung: Snapshot-Paare fuer Seiten ohne eigenes hreflang im File.
for (const seite of snapshot.pages) {
  const de = seite.hreflang?.find((h) => h.hreflang === 'de');
  const en = seite.hreflang?.find((h) => h.hreflang === 'en');
  eintragen(de?.href, en?.href);
}

/** Anzahl bekannter Zuordnungen (fuer Gates/Diagnose). */
export const anzahlPaare = paare.size;

/**
 * Pfad des exakten Sprach-Gegenstuecks der aktuellen Seite,
 * sonst Startseite der Zielsprache.
 * @param {string} pathname z.B. Astro.url.pathname
 * @param {'de'|'en'} lang Sprache der aktuellen Seite
 */
export function sprachGegenstueck(pathname, lang) {
  return paare.get(alsSchluessel(pathname)) ?? (lang === 'de' ? '/en/' : '/');
}
