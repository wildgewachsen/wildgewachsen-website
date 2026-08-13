// tools/snapshot.mjs
// READ-ONLY gegenueber der Website: friert Head-Daten + internen Linkgraphen aller
// HTML-Seiten des Ist-Standes (Submodul ../website) in migration/site_snapshot.json ein.
// Der Snapshot ist die Quelle fuer Canonicals/hreflang/Datums-Felder beim 1:1-Port
// und die Vergleichsbasis fuer den Phase-5-Diff.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEBSITE = resolve(HERE, '..', '..', 'website');
const OUT = resolve(HERE, '..', 'migration', 'site_snapshot.json');
const SKIP_DIRS = new Set(['assets', 'css', 'js', 'node_modules', '.git']);

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) files.push(...walk(p));
    } else if (name.endsWith('.html')) {
      files.push(p);
    }
  }
  return files.sort();
}

function extract(file) {
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
  const links = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (/^(mailto:|tel:|#)/.test(href)) return;
    if (/^https?:/.test(href) && !href.includes('wildgewachsen-australien.de')) return;
    links.add(href);
  });
  return {
    file: relative(WEBSITE, file).replaceAll('\\', '/'),
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
    internalLinks: [...links].sort(),
  };
}

function sitemap(file) {
  const xml = readFileSync(file, 'utf8');
  return {
    urls: [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]),
    lastmod: [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]),
  };
}

const pages = walk(WEBSITE).map(extract);
const snapshot = {
  createdAt: new Date().toISOString(),
  source: 'Projekt_Wildgewachsen/website (lokaler Submodul-Stand)',
  pageCount: pages.length,
  sitemaps: {
    root: sitemap(join(WEBSITE, 'sitemap.xml')),
    en: sitemap(join(WEBSITE, 'en', 'sitemap.xml')),
  },
  pages,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(snapshot, null, 2));
console.log(`Seiten: ${pages.length}`);
console.log(`Sitemap root: ${snapshot.sitemaps.root.urls.length} URLs, en: ${snapshot.sitemaps.en.urls.length} URLs`);
console.log(`Ohne Canonical: ${pages.filter((p) => !p.canonical).map((p) => p.file).join(', ') || 'keine'}`);
console.log(`BlogPosting mit Datum: ${pages.filter((p) => p.datePublished).length}`);
