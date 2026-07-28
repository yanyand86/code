#!/usr/bin/env node
/* Extracts the spoken script from circuit.html so the HTML stays the single
   source of truth. Writes narration/manifest.json for the TTS step.
   Run: node tools/build-narration.mjs                                        */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const SRC = ['index.html', 'circuit.html'].find(existsSync);
if (!SRC) throw new Error('No index.html or circuit.html in the repo root.');
const html = readFileSync(SRC, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// everything from the module data through chunk(); nothing after touches the DOM
const from = script.indexOf('/* narration-extract:start */');
const to   = script.indexOf('/* narration-extract:end */');
if (from < 0 || to < 0) throw new Error('Extraction markers missing from ' + SRC + '. Look for /* narration-extract:start */ and :end around the content block.');

const sandbox = 'const window = {}; const document = { querySelector: () => null };\n';
const mod = await import('data:text/javascript;base64,' + Buffer.from(
  sandbox + script.slice(from, to) + '\nexport { MODULES, speechify };'
).toString('base64'));

const manifest = mod.MODULES.map((m, i) => ({
  id: m.id,
  n: i + 1,
  title: m.title,
  segments: [
    { label: 'Introduction', text: `Module ${i + 1}. ${m.title}. ${mod.speechify(m.lede)}` },
    ...m.secs.map(s => ({ label: s.h, text: `${s.h}. ${mod.speechify(s.b)}` })),
    { label: 'End of module', text: `That is the end of ${m.title}. There are ${m.quiz.length} questions waiting on screen.` }
  ]
}));

mkdirSync('narration', { recursive: true });
writeFileSync('narration/manifest.json', JSON.stringify(manifest, null, 1));
writeFileSync('narration/ids.json', JSON.stringify(manifest.map(m => m.id)));

const words = manifest.reduce((a, m) => a + m.segments.reduce((b, s) => b + s.text.split(/\s+/).length, 0), 0);
console.log(`${manifest.length} modules · ${manifest.reduce((a,m)=>a+m.segments.length,0)} segments · ~${words.toLocaleString()} words`);
console.log(`~${Math.round(words / 150)} minutes at 150 wpm`);
