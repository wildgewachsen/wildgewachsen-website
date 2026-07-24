// tools/contrast.mjs
// WCAG-Kontrast-Gate: parst die Farbwerte aus src/styles/tokens.css
// (Light aus :root, Dark aus dem prefers-color-scheme-Block) und prueft
// definierte Text-Paare gegen AA. Exit 1 bei Fail -> Tokens nachjustieren,
// nie den Check aufweichen.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(HERE, '..', 'src', 'styles', 'tokens.css'), 'utf8');

function parseBlock(startMarker) {
  const start = css.indexOf(startMarker);
  if (start === -1) throw new Error(`Block nicht gefunden: ${startMarker}`);
  const open = css.indexOf('{', start);
  let depth = 1;
  let i = open + 1;
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') depth--;
    i++;
  }
  const block = css.slice(open, i);
  const vars = {};
  for (const m of block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    vars[m[1]] = m[2];
  }
  return vars;
}

const light = parseBlock(':root {');
const darkOuter = css.indexOf('@media (prefers-color-scheme: dark)');
const dark = (() => {
  const sub = css.slice(darkOuter);
  const vars = {};
  for (const m of sub
    .slice(0, sub.indexOf('}\n}') + 3)
    .matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    vars[m[1]] = m[2];
  }
  return vars;
})();

function luminance(hex) {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function ratio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// [Vordergrund, Hintergrund, Mindest-Ratio, Beschreibung]
const PAIRS = [
  ['--ink', '--bg', 4.5, 'Fliesstext auf Sand/Dunkelgrund'],
  ['--ink', '--surface', 4.5, 'Fliesstext auf Card'],
  ['--ink-soft', '--bg', 4.5, 'Meta-Text auf Hintergrund'],
  ['--ink-soft', '--surface', 4.5, 'Meta-Text auf Card'],
  ['--accent-strong', '--bg', 4.5, 'Links/Terrakotta-Text auf Hintergrund'],
  ['--accent-strong', '--surface', 4.5, 'Links auf Card'],
  ['--sage-text', '--bg', 4.5, 'Sage-Text auf Hintergrund'],
  ['--accent-contrast', '--accent', 4.5, 'Text auf Terrakotta-Flaeche (Buttons)'],
  ['--accent', '--bg', 3.0, 'Terrakotta grafisch/grosse Typo'],
  ['--sage', '--bg', 3.0, 'Sage grafisch/grosse Typo'],
];

let fails = 0;
for (const [theme, vars] of [
  ['LIGHT', light],
  ['DARK', dark],
]) {
  console.log(`\n${theme}`);
  for (const [fg, bg, min, desc] of PAIRS) {
    if (!vars[fg] || !vars[bg]) {
      console.log(`  SKIP ${fg}/${bg} (Token fehlt im ${theme}-Block)`);
      continue;
    }
    const r = ratio(vars[fg], vars[bg]);
    const ok = r >= min;
    if (!ok) fails++;
    console.log(
      `  ${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2)}:1 (min ${min}) ${fg} auf ${bg} · ${desc}`
    );
  }
}

if (fails > 0) {
  console.error(`\n${fails} Paar(e) unter AA. Tokens nachjustieren.`);
  process.exit(1);
}
console.log('\nAlle Kontrast-Paare PASS.');
