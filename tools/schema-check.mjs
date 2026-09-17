// tools/schema-check.mjs
// Schema-Gate. Aufruf: node tools/schema-check.mjs   (nach `npm run build`)
//
// Warum es dieses Gate gibt:
// Am 23.05.2026 meldete die Search Console zum ersten Mal "Bild-Metadaten fuer
// strukturierte Daten": ein ImageObject trug creditText, aber nicht die vier
// Felder, die Google dazu erwartet. Repariert am 26.05. — und die Erkenntnis
// wurde nur als Dokumentation abgelegt, mit Verweis auf artikel-template.html.
// Diese Datei verschwand mit dem Astro-Cutover am 26.07., der Hinweis lief
// seitdem ins Leere. Am 17.09.2026 kam dieselbe GSC-Meldung erneut, diesmal
// fuer den B13-Tiere-Artikel: creator und copyrightNotice fehlten, auf DE und EN.
// Kein Gate konnte das sehen — weder `npm run gates` noch blog-seo-check
// pruefen Schema-Felder. Deshalb jetzt als Pruefung statt als Merksatz.
//
// Zwei Pruefungen:
//   1. ImageObject-Buendel (hart) — wer creditText oder copyrightHolder setzt,
//      muss creator, copyrightNotice, license und acquireLicensePage mitliefern.
//      Google akzeptiert das Schema sonst zwar als gueltig, flaggt es aber unter
//      "Darstellung von Elementen verbessern" und liefert keine Image-License-
//      Rich-Results.
//   2. Schema-Stack je Artikelseite (hart) — BlogPosting, FAQPage und
//      BreadcrumbList sind laut Projekt-CLAUDE.md Pflicht fuer jeden Artikel.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIST, pruefeDist } from './_snapshot-basis.mjs';

pruefeDist();

// Trigger: sobald eins davon gesetzt ist, erwartet Google das volle Buendel.
const TRIGGER = ['creditText', 'copyrightHolder'];
const PFLICHT = ['creator', 'copyrightNotice', 'license', 'acquireLicensePage'];
// Artikelseiten tragen den vollen Schema-Stack. Alles andere (Startseite,
// Uebersichten, Impressum, 404 ...) ist davon ausgenommen.
const STACK = ['BlogPosting', 'FAQPage', 'BreadcrumbList'];
const ARTIKEL = /^(blog\/|en\/)[^/]+\.html$/;
// Seiten ohne Artikel-Charakter, die trotzdem unter en/ liegen.
const KEIN_ARTIKEL = new Set([
  'en/index.html',
  'en/blog.html',
  'en/about.html',
  'en/contact.html',
  'en/privacy.html',
  'en/our-journey.html',
  'en/newsletter-confirmed.html',
]);

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}

function relPfad(datei) {
  return posix.join(...datei.slice(DIST.length + 1).split(/[\\/]/));
}

// Jedes ImageObject im Baum finden, egal wie tief es verschachtelt ist.
function sammleImageObjects(knoten, treffer = []) {
  if (!knoten || typeof knoten !== 'object') return treffer;
  if (Array.isArray(knoten)) {
    for (const k of knoten) sammleImageObjects(k, treffer);
    return treffer;
  }
  if (knoten['@type'] === 'ImageObject') treffer.push(knoten);
  for (const k of Object.keys(knoten)) sammleImageObjects(knoten[k], treffer);
  return treffer;
}

const seiten = walk(DIST).filter((f) => f.endsWith('.html'));
const bildFehler = [];
const stackFehler = [];
const kaputtesJson = [];
let bilderGeprueft = 0;
let artikelGeprueft = 0;

for (const datei of seiten) {
  const rel = relPfad(datei);
  const html = readFileSync(datei, 'utf8');
  const bloecke = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];

  const typen = new Set();
  for (const b of bloecke) {
    let json;
    try {
      json = JSON.parse(b[1]);
    } catch (e) {
      kaputtesJson.push(`${rel}: ${e.message}`);
      continue;
    }
    for (const eintrag of Array.isArray(json) ? json : [json]) {
      if (eintrag && eintrag['@type']) typen.add(eintrag['@type']);
    }
    for (const bild of sammleImageObjects(json)) {
      bilderGeprueft++;
      if (!TRIGGER.some((k) => k in bild)) continue;
      const fehlt = PFLICHT.filter((k) => !(k in bild));
      if (fehlt.length) {
        bildFehler.push({ rel, url: bild.url || '(ohne url)', fehlt });
      }
    }
  }

  if (ARTIKEL.test(rel) && !KEIN_ARTIKEL.has(rel)) {
    artikelGeprueft++;
    const fehlt = STACK.filter((t) => !typen.has(t));
    if (fehlt.length) stackFehler.push({ rel, fehlt });
  }
}

console.log(
  `Seiten geprueft: ${seiten.length} · ImageObjects: ${bilderGeprueft} · ` +
    `Artikelseiten mit Schema-Stack-Pflicht: ${artikelGeprueft}`,
);

if (kaputtesJson.length) {
  console.log('\nFAIL — JSON-LD laesst sich nicht parsen:');
  for (const f of kaputtesJson) console.log('  - ' + f);
}

if (bildFehler.length) {
  console.log('\nFAIL — ImageObject unvollstaendig (GSC "Bild-Metadaten"):');
  for (const f of bildFehler) {
    console.log(`  - ${f.rel}`);
    console.log(`      Bild:  ${f.url}`);
    console.log(`      fehlt: ${f.fehlt.join(', ')}`);
  }
  console.log(
    '\n  Muster der uebrigen Artikelseiten (z.B. blog/angekommen-erste-tage-australien):\n' +
      "      creditText: 'Wildgewachsen',\n" +
      "      copyrightNotice: '© Wildgewachsen',\n" +
      "      creator: { '@type': 'Person', name: 'Christian Schippel' },\n" +
      "      copyrightHolder: { '@type': 'Organization', name: 'Wildgewachsen' },\n" +
      "      license: 'https://wildgewachsen-australien.de/impressum',\n" +
      "      acquireLicensePage: 'https://wildgewachsen-australien.de/kontakt',  // EN: /en/contact",
  );
}

if (stackFehler.length) {
  console.log('\nFAIL — Artikelseite ohne vollstaendigen Schema-Stack:');
  for (const f of stackFehler) console.log(`  - ${f.rel} · fehlt: ${f.fehlt.join(', ')}`);
  console.log('\n  Pflicht laut Projekt-CLAUDE.md: BlogPosting + FAQPage + BreadcrumbList.');
}

if (kaputtesJson.length || bildFehler.length || stackFehler.length) process.exit(1);

console.log('\nSCHEMA OK: jedes ImageObject vollstaendig, jede Artikelseite mit vollem Stack.');
