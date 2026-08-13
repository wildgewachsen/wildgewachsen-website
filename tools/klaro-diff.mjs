// tools/klaro-diff.mjs
// Consent-Banner-Gate. Aufruf: node tools/klaro-diff.mjs   (nach `npm run build`)
//
// Klaro ist die DSGVO-Einwilligung. Zum Cutover war es auf 33 der 43 Seiten
// eingebunden (Snapshot). Eine Seite, die Klaro damals hatte und heute nicht
// mehr, ist ein Rechts-Risiko, kein Design-Detail — deshalb hart (Exit 1).
// Seiten, die Klaro dazubekommen haben, sind unkritisch und werden nur gezaehlt.
import { readFileSync } from 'node:fs';
import { ladeSnapshot, pruefeDist, snapshotSeiten, distDatei, ladeAusnahmen, istAusnahme } from './_snapshot-basis.mjs';

pruefeDist();
const snap = ladeSnapshot();
const ausnahmen = ladeAusnahmen();

const verloren = [];
const dazu = [];
let unveraendert = 0;
let ohneDatei = 0;

for (const alt of snapshotSeiten(snap)) {
  const datei = distDatei(alt.file);
  if (!datei) {
    // Fehlende Seiten meldet tools/urlmap-diff.mjs — hier nur mitzaehlen.
    ohneDatei++;
    continue;
  }
  const neu = /klaro/i.test(readFileSync(datei, 'utf8'));
  if (alt.klaro && !neu) {
    if (istAusnahme(ausnahmen, alt.file, 'klaro')) continue;
    verloren.push(alt.file);
  } else if (!alt.klaro && neu) {
    dazu.push(alt.file);
  } else {
    unveraendert++;
  }
}

console.log(
  `Seiten geprueft: ${snapshotSeiten(snap).length - ohneDatei} · unveraendert: ${unveraendert} · ` +
    `Klaro dazu: ${dazu.length} · Klaro verloren: ${verloren.length}` +
    (ohneDatei ? ` · ohne dist-Datei (siehe urlmap-diff): ${ohneDatei}` : ''),
);
if (dazu.length) {
  console.log('\nINFO — Klaro neu dazugekommen:');
  for (const f of dazu) console.log('  + ' + f);
}
if (verloren.length) {
  console.log('\nFAIL — Klaro war zum Cutover eingebunden, fehlt jetzt:');
  for (const f of verloren) console.log('  - ' + f);
  process.exit(1);
}
console.log('\nKLARO OK: keine Seite hat die Einwilligung verloren.');
