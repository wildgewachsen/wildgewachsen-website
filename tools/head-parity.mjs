// tools/head-parity.mjs
// SEO-Kopf-Vergleich live vs dist ueber ALLE Seiten-Paare: title, description,
// canonical, hreflang-Set, og:image, JSON-LD-Typen. Meldet NUR Abweichungen.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const HERE = dirname(fileURLToPath(import.meta.url));
const RD = resolve(HERE, '..');
const LIVE = resolve(RD, '..', 'website');

const SEITEN = ['index.html', 'blog.html', 'ueber-uns.html', 'unsere-reise.html', 'kontakt.html', 'impressum.html'];
const EN_SEITEN = ['index.html', 'blog.html', 'about.html', 'our-journey.html', 'contact.html', 'privacy.html'];

const paare = [];
for (const f of SEITEN) paare.push(f);
for (const f of readdirSync(resolve(LIVE, 'blog')).filter((f) => f.endsWith('.html') && !f.includes('template'))) paare.push(`blog/${f}`);
for (const f of EN_SEITEN) paare.push(`en/${f}`);
for (const f of readdirSync(resolve(LIVE, 'en')).filter((f) => f.endsWith('.html') && !EN_SEITEN.includes(f) && f !== 'sitemap.xml')) paare.push(`en/${f}`);

function kopf(file) {
  const $ = cheerio.load(readFileSync(file, 'utf8'));
  const jsonldTypen = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const d = JSON.parse($(el).text());
      for (const n of Array.isArray(d) ? d : [d]) jsonldTypen.push(n['@type'] ?? '?');
    } catch {
      jsonldTypen.push('PARSE_ERROR');
    }
  });
  return {
    title: $('head > title').first().text().trim(),
    description: $('meta[name="description"]').attr('content') ?? '(keine)',
    canonical: $('link[rel="canonical"]').attr('href') ?? '(keins)',
    hreflang: $('link[rel="alternate"][hreflang]')
      .map((_, el) => `${$(el).attr('hreflang')}=${$(el).attr('href')}`)
      .get()
      .sort()
      .join(' | ') || '(keins)',
    ogImage: $('meta[property="og:image"]').attr('content') ?? '(keins)',
    jsonld: jsonldTypen.sort().join(',') || '(keins)',
  };
}

let ok = 0;
const probleme = [];
for (const rel of paare) {
  const liveF = resolve(LIVE, rel);
  const distF = resolve(RD, 'dist', rel);
  if (!existsSync(distF)) {
    probleme.push(`${rel}: DIST FEHLT`);
    continue;
  }
  const a = kopf(liveF);
  const b = kopf(distF);
  const diffs = Object.keys(a).filter((k) => a[k] !== b[k]);
  if (!diffs.length) ok++;
  else probleme.push(`${rel}:\n` + diffs.map((k) => `    ${k}\n      live: ${a[k]}\n      neu:  ${b[k]}`).join('\n'));
}

console.log(`Seiten geprueft: ${paare.length} · Kopf identisch: ${ok} · Abweichungen: ${probleme.length}`);
for (const p of probleme) console.log('\n' + p);
process.exit(probleme.length ? 1 : 0);
