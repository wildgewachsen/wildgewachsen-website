# wildgewachsen-australien.de

Astro-Projekt hinter der Live-Site. Seit dem Go-Live am **26.07.2026** ist dieses
Repo die Quelle der Wahrheit — die frueher hier liegende, handgeschriebene
HTML-Site wurde beim Cutover entfernt. Cloudflare Pages baut das Projekt selbst
(Build-Command `npm run build`, Output `dist`, `NODE_VERSION=22`,
Production-Branch `main`). Details und Historie: [`DEPLOY.md`](DEPLOY.md).

> **Push = Deploy.** Ein Push auf `main` geht live. Ohne ausdrueckliche
> CEO-Freigabe wird nicht gepusht. Lokal committen ist unkritisch.

## Pflicht-Gates vor jedem Push

Alle sieben in dieser Reihenfolge, alle muessen gruen sein (Exit 0):

```bash
npm run gates
```

Das ist eine Verkettung von:

| # | Gate | Prueft | Wann |
|---|---|---|---|
| 1 | `npm run build` | Astro baut fehlerfrei; `tools/postbuild.mjs` entfernt die internen Styleguide-Seiten aus `dist/` | immer |
| 2 | `node tools/link-check.mjs` | jede interne Referenz (`a`, `img`, `srcset`, `link`, `script`, `video`) aller `dist`-Seiten zeigt auf eine existierende Datei | immer |
| 3 | `node tools/sprachlink-check.mjs` | der DE⇄EN-Umschalter jeder Seite zeigt auf ihr echtes Gegenstueck, nicht auf die Startseite. Paare kommen aus den `hreflang`-Tags der Seiten selbst, **nicht** aus dem Snapshot | immer |
| 4 | `node tools/head-parity.mjs` | SEO-Kopf gegen den Cutover-Snapshot: Canonical, hreflang, og:image, JSON-LD-Typen, GoatCounter, `html[lang]` | immer |
| 5 | `node tools/urlmap-diff.mjs` | URL-Kontinuitaet: jede Alt-URL und jede Sitemap-URL wird geliefert; Pflicht-Statics vorhanden | immer |
| 6 | `node tools/klaro-diff.mjs` | Consent-Banner: keine Seite hat Klaro verloren | immer |
| 7 | `node tools/contrast.mjs` | WCAG-AA-Kontrast der Farbpaare aus `src/styles/tokens.css` | immer (Pflicht bei Token-Aenderungen) |

Gates 2–6 brauchen ein gebautes `dist/` und brechen sonst mit Exit 2 ab.

Fuer Blog-Artikel kommen die Redaktions-Gates aus den Projekt-Regeln dazu
(`blog-seo-check`, `blog-factcheck`, Sitemap-Eintrag, Startseite + Blog-Uebersicht) —
siehe `Projekt_Wildgewachsen/CLAUDE.md`.

## Wogegen die Paritaets-Gates pruefen

Gates 4–6 vergleichen den frischen Build gegen
**`migration/site_snapshot.json`** — einen eingefrorenen Abzug der alten Site vom
22.07.2026 (45 Seiten, 2×21 Sitemap-URLs). Das ist der Stand, den Google zum
Cutover indexiert hatte.

Die Gates trennen dabei bewusst zwei Klassen:

- **FAIL** — verlorene SEO-Infrastruktur. Ein Canonical, ein hreflang, ein
  JSON-LD-Typ, das Tracking- oder Consent-Snippet verschwindet nie aus Versehen
  richtig. Exit 1.
- **INFO** — redaktioneller Drift. Geaenderte Titel, Descriptions, Datums-Felder,
  neue Seiten, zusaetzliche Schema-Bloecke. Wird angezeigt, blockiert aber nichts.

Der Snapshot wird **nicht neu erzeugt**. Sein Generator liegt stillgelegt in
[`tools/_archiv/`](tools/_archiv/README.md); ein frischer Snapshot wuerde den
aktuellen Stand gegen sich selbst pruefen und jede Regression durchwinken.

Bewusste Abweichungen (z.B. ein absichtlich umbenannter Slug) gehoeren mit Grund
in `tools/snapshot-ausnahmen.json`:

```json
[{ "seite": "blog/alter-slug.html", "feld": "canonical", "grund": "Slug am 01.08. bewusst umbenannt, 301 im Host gesetzt" }]
```

`"feld": "*"` nimmt eine ganze Seite aus dem Vergleich. Genutzte Ausnahmen werden
bei jedem Lauf mitsamt Grund ausgegeben — nie still verschluckt.

## Struktur

```text
src/pages/            Seiten = Routen (build.format 'preserve' -> dist spiegelt die Quelle)
  blog/<slug>.astro     DE-Artikel
  en/<slug>.astro       EN-Artikel
  styleguide*.astro     intern, wird von postbuild aus dist entfernt
src/components/       AufklappBox, Bento, PullQuote, Randnotiz, StickyToc, FotoStory, ...
src/layouts/          BaseLayout, ArtikelLayout (Head, Schema, GoatCounter, Klaro)
src/styles/tokens.css Farb- und Typo-Tokens (Basis fuer tools/contrast.mjs)
public/               1:1 ausgeliefert: assets/, Favicons, robots.txt,
                      sitemap.xml + en/sitemap.xml (handgepflegt, nicht generiert)
migration/            eingefrorene Cutover-Artefakte (site_snapshot.json)
tools/                Gates + Hilfsskripte, tools/_archiv/ = stillgelegt
```

Neue Artikel: bestehende Artikel-Seite als Vorlage kopieren, `ArtikelLayout`
nutzen, Sitemap-Eintrag + `lastmod` ergaenzen, Startseite und Blog-Uebersicht
verlinken. Sitemaps sind handgepflegt (kein Astro-Sitemap-Generator) — das haelt
die URL-Paritaet zur Alt-Site.

## Befehle

| Befehl | Wirkung |
|---|---|
| `npm install` | Abhaengigkeiten |
| `npm run dev` | Dev-Server (zeigt auch die Styleguide-Seiten) |
| `npm run build` | Production-Build nach `dist/` inkl. postbuild |
| `npm run preview` | gebautes `dist/` lokal ansehen |
| `npm run gates` | alle sieben Pflicht-Gates nacheinander |

## Weitere Skripte in `tools/`

Kein Gate, nur bei Bedarf: `logo-trace.mjs` und `logo-preprocess.py` (Logo-
Vektorisierung), `postbuild.mjs` (laeuft automatisch als Teil von `npm run build`).
