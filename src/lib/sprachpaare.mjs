/**
 * DE⇄EN-Gegenstueck je Seite fuer den Sprachumschalter im Header.
 *
 * Quelle der Wahrheit: migration/site_snapshot.json — die hreflang-Paare der
 * Live-Seiten (nicht raten, nicht ableiten). Fallback fuer Seiten ohne
 * hreflang-Paar (z.B. Impressum, Dev-Styleguides): Startseite der Zielsprache
 * (Master-Prompt v2 §3 Phase A Punkt 2).
 */
import snapshot from '../../migration/site_snapshot.json';

const DOMAIN = 'https://wildgewachsen-australien.de';

/** Domain abschneiden; Wert behaelt den Live-Stil (z.B. '/en/' mit Slash). */
function ohneDomain(href) {
  return href.startsWith(DOMAIN) ? href.slice(DOMAIN.length) || '/' : href;
}

/** Schluessel-Normalisierung: trailing Slash weg (ausser Root). */
function alsSchluessel(pfad) {
  const p = ohneDomain(pfad);
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}

const paare = new Map();
for (const seite of snapshot.pages) {
  const de = seite.hreflang?.find((h) => h.hreflang === 'de');
  const en = seite.hreflang?.find((h) => h.hreflang === 'en');
  if (!de || !en) continue;
  // Template-Snapshots mit {{SLUG}}-Platzhaltern ueberspringen
  if (de.href.includes('{{') || en.href.includes('{{')) continue;
  paare.set(alsSchluessel(de.href), ohneDomain(en.href));
  paare.set(alsSchluessel(en.href), ohneDomain(de.href));
}

/**
 * Pfad des exakten Sprach-Gegenstuecks der aktuellen Seite,
 * sonst Startseite der Zielsprache.
 * @param {string} pathname z.B. Astro.url.pathname
 * @param {'de'|'en'} lang Sprache der aktuellen Seite
 */
export function sprachGegenstueck(pathname, lang) {
  return paare.get(alsSchluessel(pathname)) ?? (lang === 'de' ? '/en/' : '/');
}
