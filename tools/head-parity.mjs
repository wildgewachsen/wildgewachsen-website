// tools/head-parity.mjs
// SEO-Kopf-Regressions-Gate gegen den eingefrorenen Cutover-Snapshot.
// Aufruf: node tools/head-parity.mjs   (nach `npm run build`)
//
// Vergleicht jede Seite aus migration/site_snapshot.json (Stand der Handschrift-
// Site zum Cutover, = der Stand, den Google indexiert hatte) mit der gleichnamigen
// Seite im frisch gebauten dist/.
//
// Die Trennung ist bewusst:
//   FAIL  = SEO-Infrastruktur, die verloren gegangen ist. Canonical, hreflang,
//           og:image, JSON-LD-Typen, GoatCounter, html[lang]. Sowas verschwindet
//           nie absichtlich; wenn doch, gehoert es mit Grund in
//           tools/snapshot-ausnahmen.json.
//   INFO  = Redaktion. Titel, Description, Datums-Felder, zusaetzliche hreflang-
//           oder Schema-Eintraege, neue Seiten. Das aendert sich staendig und
//           darf kein Gate blockieren — wird aber gezeigt, damit ungewollte
//           Aenderungen auffallen.
import {
  ladeSnapshot,
  pruefeDist,
  snapshotSeiten,
  distDatei,
  kopfExtrahieren,
  hreflangSatz,
  ladeAusnahmen,
  istAusnahme,
} from './_snapshot-basis.mjs';

pruefeDist();
const snap = ladeSnapshot();
const ausnahmen = ladeAusnahmen();
const seiten = snapshotSeiten(snap);

const fails = [];
const infos = [];
const genutzteAusnahmen = [];
let sauber = 0;

function melde(liste, seite, feld, text) {
  if (istAusnahme(ausnahmen, seite, feld)) {
    const a = ausnahmen.find((x) => x.seite === seite && (x.feld === feld || x.feld === '*'));
    genutzteAusnahmen.push(`${seite} · ${feld}: ${a.grund ?? '(kein Grund hinterlegt)'}`);
    return;
  }
  liste.push({ seite, feld, text });
}

for (const alt of seiten) {
  const datei = distDatei(alt.file);
  if (!datei) {
    melde(fails, alt.file, 'seite', 'im dist nicht vorhanden (URL waere ein 404)');
    continue;
  }
  const neu = kopfExtrahieren(datei);
  const vorher = fails.length + infos.length;

  // --- FAIL-Klasse: verlorene SEO-Infrastruktur ---
  if (alt.canonical && neu.canonical !== alt.canonical) {
    melde(fails, alt.file, 'canonical', `alt: ${alt.canonical}\n      neu: ${neu.canonical ?? '(fehlt)'}`);
  }
  const altHref = hreflangSatz(alt.hreflang);
  const neuHref = hreflangSatz(neu.hreflang);
  const verloreneHref = [...altHref].filter((h) => !neuHref.has(h));
  if (verloreneHref.length) {
    melde(fails, alt.file, 'hreflang', `fehlt jetzt: ${verloreneHref.join(' | ')}`);
  }
  if (alt.ogImage && !neu.ogImage) {
    melde(fails, alt.file, 'og:image', `war: ${alt.ogImage} — jetzt keins`);
  }
  const verloreneTypen = alt.jsonldTypes.filter((t) => !neu.jsonldTypes.includes(t));
  if (verloreneTypen.length) {
    melde(fails, alt.file, 'json-ld', `Typ(en) verschwunden: ${verloreneTypen.join(', ')}`);
  }
  if (neu.jsonldTypes.includes('PARSE_ERROR')) {
    melde(fails, alt.file, 'json-ld', 'ein JSON-LD-Block ist kein gueltiges JSON');
  }
  if (alt.goatcounter && !neu.goatcounter) {
    melde(fails, alt.file, 'goatcounter', 'Tracking-Snippet fehlt jetzt');
  }
  if (alt.lang && neu.lang !== alt.lang) {
    melde(fails, alt.file, 'html[lang]', `alt: ${alt.lang} · neu: ${neu.lang ?? '(fehlt)'}`);
  }

  // --- INFO-Klasse: redaktioneller Drift ---
  if (alt.title !== neu.title) {
    melde(infos, alt.file, 'title', `alt: ${alt.title}\n      neu: ${neu.title}`);
  }
  if (alt.metaDescription !== neu.metaDescription) {
    melde(infos, alt.file, 'description', `alt: ${alt.metaDescription}\n      neu: ${neu.metaDescription}`);
  }
  const neueHref = [...neuHref].filter((h) => !altHref.has(h));
  if (neueHref.length) melde(infos, alt.file, 'hreflang', `neu dazu: ${neueHref.join(' | ')}`);
  const neueTypen = neu.jsonldTypes.filter((t) => !alt.jsonldTypes.includes(t));
  if (neueTypen.length) melde(infos, alt.file, 'json-ld', `Typ(en) dazu: ${neueTypen.join(', ')}`);
  if (alt.ogImage && neu.ogImage && alt.ogImage !== neu.ogImage) {
    melde(infos, alt.file, 'og:image', `alt: ${alt.ogImage}\n      neu: ${neu.ogImage}`);
  }
  if (alt.dateModified !== neu.dateModified) {
    melde(infos, alt.file, 'dateModified', `alt: ${alt.dateModified ?? '(keins)'} · neu: ${neu.dateModified ?? '(keins)'}`);
  }
  if (alt.datePublished && alt.datePublished !== neu.datePublished) {
    melde(infos, alt.file, 'datePublished', `alt: ${alt.datePublished} · neu: ${neu.datePublished ?? '(keins)'}`);
  }

  if (fails.length + infos.length === vorher) sauber++;
}

const ausgabe = (titel, liste) => {
  if (!liste.length) return;
  console.log(`\n${titel} (${liste.length}):`);
  for (const e of liste) console.log(`  ${e.seite} · ${e.feld}\n      ${e.text}`);
};

console.log(
  `Snapshot-Seiten geprueft: ${seiten.length} · Kopf unveraendert: ${sauber} · ` +
    `FAIL: ${fails.length} · INFO: ${infos.length}`,
);
ausgabe('FAIL — verlorene SEO-Infrastruktur', fails);
ausgabe('INFO — redaktioneller Drift seit dem Cutover', infos);
if (genutzteAusnahmen.length) {
  console.log(`\nBewusste Abweichungen laut snapshot-ausnahmen.json (${genutzteAusnahmen.length}):`);
  for (const a of genutzteAusnahmen) console.log('  - ' + a);
}
if (!fails.length) console.log('\nHEAD-PARITAET OK: keine SEO-Infrastruktur verloren.');
process.exit(fails.length ? 1 : 0);
