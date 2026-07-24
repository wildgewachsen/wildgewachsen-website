/**
 * Logo-Vektorisierung: getracete SVGs aus den vorverarbeiteten S/W-PNGs
 * (tools/logo-preprocess.py muss vorher gelaufen sein -> tools/_trace/*.png).
 *
 * - Wortmarke: 3 Threshold-Varianten (t96/t128/t160) tracen, Pfad-Komplexitaet
 *   vergleichen, plausibelste waehlen -> src/assets/logo-wortmarke.svg
 *   (ein <path>, fill="currentColor", viewBox eng um die Marke).
 * - Favicon: Wellen-Abschnitt tracen -> public/favicon.svg
 *   (Tinten-Braun #33291F auf transparentem Grund, zentriert mit Luft).
 *
 * turdSize klein (2), damit die handgezeichneten Details erhalten bleiben.
 * Ausfuehren: node tools/logo-trace.mjs
 */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const potrace = require('potrace');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TRACE_DIR = path.join(ROOT, 'tools', '_trace');

function trace(file, options) {
  return new Promise((resolve, reject) => {
    potrace.trace(file, options, (err, svg) => (err ? reject(err) : resolve(svg)));
  });
}

function extractPathD(svg) {
  const m = svg.match(/ d="([^"]+)"/);
  if (!m) throw new Error('kein <path d=...> im potrace-Output');
  return m[1];
}

/** Pro Subpfad (M...M) die Bounding-Box aus allen Koordinaten-Paaren. */
function subpathBoxes(d) {
  return d
    .split(/(?=M)/)
    .filter((s) => s.trim())
    .map((seg) => {
      const nums = (seg.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i + 1 < nums.length; i += 2) {
        minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]);
        minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
      }
      return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
    });
}

function totalBox(boxes) {
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}

/**
 * Entfernt Speck-Subpfade: Rausch-Fragmente der Alpha-Kante unter 12x12px.
 * Kleinste echte Details der Marke sind >40px (scipy-Analyse, s.o.) --
 * 12px laesst also >3x Sicherheitsabstand. potrace wickelt alle Konturen
 * gleichsinnig und verlaesst sich auf fill-rule="evenodd"; ohne Filter
 * wuerden die Specks als Pinholes/Punkte mitgerendert.
 */
function dropSpecks(d) {
  const segs = d.split(/(?=M)/).filter((s) => s.trim());
  const boxes = subpathBoxes(d);
  const kept = segs.filter((_, i) => !(boxes[i].w < 12 && boxes[i].h < 12));
  return { d: kept.join(''), removed: segs.length - kept.length };
}

// ---------- 1) Wortmarke: 3 Thresholds vergleichen ----------
const variants = [];
for (const t of [96, 128, 160]) {
  const file = path.join(TRACE_DIR, `logo-bw-t${t}.png`);
  // PNGs sind bereits binaer; potrace-Threshold 128 trennt schwarz/weiss sauber.
  const svg = await trace(file, { threshold: 128, turdSize: 2 });
  const d = extractPathD(svg);
  const boxes = subpathBoxes(d);
  // Specks: Subpfade unter 6x6px = Rausch-Fragmente der Alpha-Kante,
  // kein gezeichnetes Detail (kleinste echte Details wie i-Punkt sind >40px).
  const specks = boxes.filter((b) => b.w < 6 && b.h < 6).length;
  variants.push({ t, d, subpaths: boxes.length, dLength: d.length, boxes, specks });
  console.log(`t${t}: subpaths=${boxes.length} (davon specks<6px: ${specks}) dLength=${d.length}`);
}

// Plausibilitaet: Die echte Struktur der Marke sind 27 Pixel-Komponenten
// (+ Punzen) -- gemessen via scipy.ndimage.label in logo-preprocess-Analyse.
// Hoehere Thresholds erzeugen NUR mehr Alpha-Kanten-Fragmente (specks),
// die Ink-Flaeche unterscheidet sich <6% (354k/346k/335k px). Gewaehlt wird
// also die Variante mit den wenigsten Rausch-Fragmenten -- abgesichert durch
// Sanity-Checks unten (beide Wortzeilen + Welle muessen enthalten sein).
const best = [...variants].sort((a, b) => a.specks - b.specks)[0];
console.log(`gewaehlt: t${best.t} (wenigste Rausch-Fragmente)`);

const cleaned = dropSpecks(best.d);
best.d = cleaned.d;
best.boxes = subpathBoxes(best.d);
console.log(`Speck-Filter: ${cleaned.removed} Fragmente entfernt, ${best.boxes.length} Subpfade bleiben`);

const tb = totalBox(best.boxes);
// viewBox eng um die Marke, 20px Luft
const pad = 20;
const vb = [
  Math.floor(tb.minX - pad),
  Math.floor(tb.minY - pad),
  Math.ceil(tb.maxX - tb.minX + 2 * pad),
  Math.ceil(tb.maxY - tb.minY + 2 * pad),
].join(' ');

// fill-rule="evenodd" ist PFLICHT: potrace wickelt alle Subpfade gleichsinnig,
// die Punzen (e/a/g/d-Innenraeume) sind nur ueber evenodd Loecher. Ohne das
// Attribut fuellt der nonzero-Default sie schwarz (Bug bis 2026-07-24).
const wortmarkeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="currentColor"><path fill-rule="evenodd" d="${best.d}"/></svg>\n`;
const wortmarkePath = path.join(ROOT, 'src', 'assets', 'logo-wortmarke.svg');
mkdirSync(path.dirname(wortmarkePath), { recursive: true });
writeFileSync(wortmarkePath, wortmarkeSvg);
console.log(`geschrieben: ${wortmarkePath} (viewBox ${vb})`);

// Verifikations-Report: liegen Subpfade in beiden Wortzeilen-Zonen + Welle?
// (Bildkoordinaten des Masters: wild+Welle y 288-710, gewachsen y 718-1239,
//  Welle = breitester Subpfad der oberen Zone, x-Spanne ~329-1813.)
const upper = best.boxes.filter((b) => b.minY < 715);
const lower = best.boxes.filter((b) => b.minY >= 715);
const widest = best.boxes.reduce((a, b) => (b.w > a.w ? b : a));
console.log(`Zone "wild"+Welle (y<715): ${upper.length} Subpfade`);
console.log(`Zone "gewachsen" (y>=715): ${lower.length} Subpfade`);
console.log(
  `breitester Subpfad (erwartet wild+Welle verschmolzen): x ${Math.round(widest.minX)}-${Math.round(widest.maxX)} y ${Math.round(widest.minY)}-${Math.round(widest.maxY)}`,
);

// ---------- 2) Favicon: Welle ----------
const waveSvgRaw = await trace(path.join(TRACE_DIR, 'wave-bw.png'), {
  threshold: 128,
  turdSize: 2,
});
const waveCleaned = dropSpecks(extractPathD(waveSvgRaw));
const waveD = waveCleaned.d;
const waveBoxes = subpathBoxes(waveD);
if (waveCleaned.removed) console.log(`Favicon Speck-Filter: ${waveCleaned.removed} Fragmente entfernt`);
const wvb = waveSvgRaw.match(/width="(\d+)[^"]*" height="(\d+)/);
const side = wvb ? Number(wvb[1]) : 372;
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}"><path fill="#33291F" fill-rule="evenodd" d="${waveD}"/></svg>\n`;
const faviconPath = path.join(ROOT, 'public', 'favicon.svg');
writeFileSync(faviconPath, faviconSvg);
const wtb = totalBox(waveBoxes);
console.log(
  `geschrieben: ${faviconPath} (Canvas ${side}x${side}, ${waveBoxes.length} Subpfade, Welle x ${Math.round(wtb.minX)}-${Math.round(wtb.maxX)} y ${Math.round(wtb.minY)}-${Math.round(wtb.maxY)})`,
);
