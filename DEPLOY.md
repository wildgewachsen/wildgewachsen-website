# Deploy — Astro-Cutover VOLLZOGEN (Go-Live 26.07.2026)

> ✅ **GO-LIVE ERFOLGT 26.07.2026 (Option A).** Das Astro-Projekt liegt jetzt direkt
> in diesem Repo, Cloudflare Pages baut es selbst. Live-Verifikation bestanden:
> 42/42 Sitemap-URLs HTTP 200, hreflang reziprok, Favicon neu, Datums-Bumps live,
> GSC-Sitemaps neu eingereicht (0 Fehler). Submodul-Commit `ca5e44f`.
>
> **Aktive Cloudflare-Pages-Settings (Projekt `wildgewachsen-australien`):**
> Build-Command `npm run build`, Output `dist`, `NODE_VERSION=22`, Build system v3,
> Production-Branch `main`, Automatic deployments an.
>
> Push ins `website/`-Repo = Live-Deploy. Weiterhin TABU ohne CEO-Freigabe.
> Der Abschnitt unten dokumentiert die damalige Vorbereitung (Historie).

## Build-Parameter (Astro)
- Build-Command: `npm run build`
- Output-Verzeichnis: `dist`
- Node lokal verifiziert: v26.3.0 (Cloudflare-Node-Version bei Umstellung pruefen)

## Zwei Deploy-Optionen fuer Phase 6 (Entscheidung mit CEO)
- **Option A, CF baut Astro:** Astro-Projekt ins Website-Repo uebernehmen, im CF-Dashboard
  Build-Command `npm run build` + Output `dist` setzen. Sauberster Dauerzustand.
- **Option B, statischer Push:** lokal bauen, Inhalt von `dist/` als statisches Site-Root
  ins Website-Repo committen (heutiger Modus, kein CF-Umbau). Einfachster Cutover.

## Vor dem Cutover pruefen (CEO, im CF-Dashboard; aus dem Repo nicht ablesbar)
- Aktueller Build-Command/Output-Dir/Production-Branch des Pages-Projekts
- Redirect-/Trailing-Slash-Verhalten, Preview-Deploys

## Pflicht-Statics — ERLEDIGT (Phase 5, 23.07.)
- ✅ `google33b9e68b2006aa30.html`, `robots.txt`, `sitemap.xml`, `en/sitemap.xml` liegen
  1:1 in `public/` (Sitemaps handgepflegt repliziert, nicht generiert).
- ✅ Alle Favicons + `assets/images/*` byte-/pfad-identisch in `public/`.
- ✅ `npm run build` entfernt die internen Styleguide-Seiten automatisch aus `dist/`
  (`tools/postbuild.mjs`) — URL-Map dist == live (46/46, `tools/urlmap-diff.mjs`).
- ✅ Formular-Funktion: Newsletter (Buttondown, 1:1-Handler im BaseLayout, alle
  `form[data-newsletter]`), Kontakt DE+EN (Formspree als form action).
- Bei kuenftigen Live-Aenderungen VOR dem Cutover: Sitemaps/robots aus `website/` neu
  nach `public/` kopieren + `tools/parity-alle-artikel.mjs`, `tools/head-parity.mjs`,
  `tools/urlmap-diff.mjs`, `tools/klaro-diff.mjs` erneut laufen lassen (Drift-Schutz).

## Nach dem Cutover (Phase 6, aus Master-Prompt §6)
- Sitemap in GSC neu einreichen (`node Content_Dashboard/scripts/gsc_sitemap_submit.js`)
- Indexierung der wichtigsten Guides anstossen
