// tools/link-check.mjs
// 404-Gate fuer den Phase-B-Technik-Pass: prueft jede interne Referenz
// (a href, img src/srcset, source srcset, link href, script src, video
// src/poster) aller dist-HTML-Seiten gegen die tatsaechlich gebauten
// Dateien. Clean-URLs werden wie beim Host aufgeloest (pfad -> pfad.html
// bzw. pfad/index.html). Externe URLs werden nur gezaehlt, nie gefetcht.
// Aufruf: node tools/link-check.mjs   (Exit 1 bei kaputten Referenzen)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, '..', 'dist');

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}

const htmlSeiten = walk(DIST).filter((f) => f.endsWith('.html'));

/** Interne URL -> existiert dafuer eine Datei in dist? */
function zielExistiert(url, vonDatei) {
  let pfad = url.split('#')[0].split('?')[0];
  if (!pfad) return true; // reiner Anker
  // Protokoll-relativ oder extern
  if (
    /^(https?:)?\/\//.test(pfad) ||
    pfad.startsWith('mailto:') ||
    pfad.startsWith('tel:') ||
    pfad.startsWith('javascript:') // Klaro-Settings-Links, 1:1 von live
  )
    return null;
  let abs;
  if (pfad.startsWith('/')) {
    abs = join(DIST, pfad.slice(1));
  } else {
    abs = resolve(dirname(vonDatei), pfad);
  }
  if (existsSync(abs) && statSync(abs).isFile()) return true;
  // Clean-URL-Aufloesung wie beim Host
  if (existsSync(abs + '.html')) return true;
  if (existsSync(join(abs, 'index.html'))) return true;
  return false;
}

let kaputt = 0;
let intern = 0;
let extern = 0;
const befunde = [];

for (const datei of htmlSeiten) {
  const rel = posix.join(...datei.slice(DIST.length + 1).split(/[\\/]/));
  const $ = cheerio.load(readFileSync(datei, 'utf8'));
  const refs = [];
  $('a[href], link[href]').each((_, el) => refs.push($(el).attr('href')));
  $('img[src], script[src], iframe[src]').each((_, el) => refs.push($(el).attr('src')));
  $('video[src], video[poster], source[src]').each((_, el) => {
    for (const a of ['src', 'poster']) if ($(el).attr(a)) refs.push($(el).attr(a));
  });
  $('img[srcset], source[srcset]').each((_, el) => {
    for (const teil of $(el).attr('srcset').split(',')) refs.push(teil.trim().split(/\s+/)[0]);
  });
  for (const ref of refs) {
    if (!ref) continue;
    const ok = zielExistiert(ref, datei);
    if (ok === null) { extern++; continue; }
    intern++;
    if (!ok) {
      kaputt++;
      befunde.push(`${rel} -> ${ref}`);
    }
  }
}

console.log(`Seiten: ${htmlSeiten.length} · interne Referenzen: ${intern} · externe (ungeprueft): ${extern}`);
if (kaputt) {
  console.log(`KAPUTT (${kaputt}):`);
  for (const b of [...new Set(befunde)]) console.log('  - ' + b);
  process.exit(1);
}
console.log('LINK-CHECK OK: keine kaputte interne Referenz.');
