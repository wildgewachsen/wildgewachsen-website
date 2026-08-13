# tools/_archiv — Migrations-Werkzeuge, nach dem Cutover stillgelegt

Diese Skripte gehoerten zum 1:1-Port der handgeschriebenen Site nach Astro
(Phasen 4–6, Juli 2026). Sie haben alle dieselbe Voraussetzung: einen zweiten,
danebenliegenden Ordner mit der **alten statischen Site** als Vergleichsbasis
(`const LIVE = resolve(RD, '..', 'website')`).

Diese Site gibt es seit dem Go-Live am **26.07.2026** nicht mehr — sie wurde beim
Cutover per `git rm` entfernt, das Astro-Projekt hat ihren Platz eingenommen.
Damit zeigt `LIVE` auf das Repo-Root selbst, und die Skripte brechen beim ersten
`readdirSync` ab (`ENOENT … /website/blog`).

**Sie werden nicht repariert und nicht mehr ausgefuehrt.** Sie liegen hier, weil
sie dokumentieren, wie die Inhalts-Gleichheit beim Port bewiesen wurde.

## Was hier liegt und warum es nicht wiederbelebt wird

| Datei | Aufgabe damals | Warum stillgelegt |
|---|---|---|
| `text-parity.mjs` | Block-fuer-Block-Beweis, dass kein sichtbarer Textblock der Live-Seite im Neubau fehlt | Braucht den **Volltext** der alten Seiten. `migration/site_snapshot.json` hat nur Kopf-Daten und den Linkgraphen, keinen Fliesstext — es gibt keine Vergleichsbasis mehr, auch nicht rekonstruierbar. |
| `parity-alle.mjs` | `text-parity` ueber alle Seiten | dito (gleiche Logik, eigener Walker) |
| `parity-alle-artikel.mjs` | `text-parity` ueber alle DE/EN-Artikel-Paare | dito (ruft `text-parity.mjs` als Subprozess) |
| `paritaet-ausnahmen.json` | CEO-freigegebene Text-Abweichungen fuer die drei obigen | gehoert nur zu ihnen |
| `snapshot.mjs` | Erzeugte `migration/site_snapshot.json` aus der alten Site | Die Quelle ist weg. Der Snapshot ist ab jetzt ein **eingefrorenes Artefakt** und darf nicht neu erzeugt werden. |

## Der Snapshot ist eingefroren

`migration/site_snapshot.json` (Stand 22.07.2026, 45 Seiten, 2×21 Sitemap-URLs)
haelt fest, was zum Cutover live war — also den Stand, den Google indexiert
hatte. Genau das macht ihn als Regressions-Basis wertvoll und genau deshalb darf
er nicht ueberschrieben werden: ein neu erzeugter Snapshot wuerde den aktuellen
Stand gegen sich selbst pruefen und jede Regression durchwinken.

Wer `snapshot.mjs` doch startet, bekommt einen `ENOENT`-Abbruch im Verzeichnis-
Walk, bevor irgendwas geschrieben wird — die Datei kann dadurch nicht kaputt
gehen. Verlassen sollte man sich darauf nicht.

## Was den Job heute macht

Die Kopf-, URL- und Consent-Pruefungen wurden auf den eingefrorenen Snapshot
umgebaut und laufen weiter — siehe [`../../README.md`](../../README.md):

- `tools/head-parity.mjs` — SEO-Kopf gegen Snapshot (Canonical, hreflang, og:image, JSON-LD, GoatCounter)
- `tools/urlmap-diff.mjs` — URL-Kontinuitaet gegen Snapshot **und** gegen die heutigen Sitemaps
- `tools/klaro-diff.mjs` — Consent-Banner gegen Snapshot

Der Text-Gleichheits-Beweis hat dagegen keinen Nachfolger: nach dem Cutover ist
das Astro-Repo selbst die Quelle der Wahrheit, es gibt kein zweites Original mehr,
gegen das man Fliesstext diffen koennte. Inhaltliche Qualitaet laeuft seitdem
ueber die Redaktions-Gates (`blog-seo-check`, `blog-factcheck`) statt ueber
Datei-Vergleich.
