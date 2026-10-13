#!/usr/bin/env node
// Self-check for content/packs.json: structure, minimum sizes, duplicates and too-similar names.
// Exit code 1 on any error. Warnings are printed but don't fail.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'content', 'packs.json');
const data = JSON.parse(readFileSync(process.argv[2] || root, 'utf8'));

export function normalizeAr(s) {
  return s
    .replace(/[ً-ْـ]/g, '') // harakat + tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/^ال/, '')
    .replace(/\s+ال/g, ' ')
    .replace(/[«»"'.!؟?،,]/g, '')
    .trim();
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

const STOP = new Set(['في', 'من', 'على', 'مع', 'بال', 'و']);
// Pairs that look alike in writing but are clearly different things when described out loud.
const ALLOW = new Set(['قرد|قرش', 'نحله|نمله']);
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

if (typeof data.version !== 'number') err('version must be a number');
if (!Array.isArray(data.packs) || data.packs.length < 10) err(`need ≥10 packs, got ${data.packs?.length}`);
if (!Array.isArray(data.dares) || data.dares.length < 15) err('need ≥15 dares');

const packIds = new Set();
for (const p of data.packs) {
  if (packIds.has(p.id)) err(`duplicate pack id ${p.id}`);
  packIds.add(p.id);
  if (!/^[a-z0-9-]+$/.test(p.id)) err(`bad pack id ${p.id}`);
  if (!p.name_ar || !p.icon) err(`${p.id}: missing name_ar/icon`);
  if (!['places', 'words'].includes(p.mode)) err(`${p.id}: bad mode`);
  const min = p.mode === 'places' ? 15 : 25;
  if (p.items.length < min) err(`${p.id}: ${p.items.length} items, need ≥${min}`);

  const ids = new Set();
  const names = [];
  for (const it of p.items) {
    if (ids.has(it.id)) err(`${p.id}: duplicate item id ${it.id}`);
    ids.add(it.id);
    if (!/^[a-z0-9-]+$/.test(it.id)) err(`${p.id}: bad item id ${it.id}`);
    if (!it.name_ar) err(`${p.id}/${it.id}: empty name`);
    if (/[A-Za-z]/.test(it.name_ar)) err(`${p.id}/${it.id}: Latin letters in name`);
    if (p.mode === 'places') {
      if (!Array.isArray(it.roles_ar) || it.roles_ar.length < 6) err(`${p.id}/${it.id}: need ≥6 roles`);
      const rs = new Set(it.roles_ar.map(normalizeAr));
      if (rs.size !== it.roles_ar.length) err(`${p.id}/${it.id}: duplicate roles`);
    }
    if (it.close_ar && normalizeAr(it.close_ar) === normalizeAr(it.name_ar)) err(`${p.id}/${it.id}: close_ar equals name`);
    names.push({ id: it.id, n: normalizeAr(it.name_ar) });
  }
  // close_ar must not be another item in the same pack (would confuse the dakheel round)
  const nameSet = new Set(names.map((x) => x.n));
  for (const it of p.items) if (it.close_ar && nameSet.has(normalizeAr(it.close_ar))) err(`${p.id}/${it.id}: close_ar "${it.close_ar}" is an item of the pack`);

  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i].n, b = names[j].n;
      if (a === b) { err(`${p.id}: duplicate name ${a} (${names[i].id}, ${names[j].id})`); continue; }
      const d = levenshtein(a, b);
      const ratio = d / Math.max(a.length, b.length);
      if (ratio < 0.34 && !ALLOW.has(`${a}|${b}`) && !ALLOW.has(`${b}|${a}`)) err(`${p.id}: too similar "${a}" ~ "${b}" (edit ratio ${ratio.toFixed(2)})`);
      const ta = new Set(a.split(' ').filter((t) => t.length > 2 && !STOP.has(t)));
      const shared = b.split(' ').filter((t) => ta.has(t));
      if (shared.length) warn(`${p.id}: "${a}" and "${b}" share word "${shared.join(' ')}"`);
    }
}

for (const w of warnings) console.warn('WARN', w);
for (const e of errors) console.error('ERROR', e);
const items = data.packs.reduce((n, p) => n + p.items.length, 0);
console.log(`${data.packs.length} packs, ${items} items, ${data.dares.length} dares — ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
