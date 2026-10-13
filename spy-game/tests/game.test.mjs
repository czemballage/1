import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as G from '../app/js/game.js';

const content = JSON.parse(readFileSync(new URL('../app/content/packs.json', import.meta.url), 'utf8'));
const places = content.packs.find((p) => p.mode === 'places');
const words = content.packs.find((p) => p.mode === 'words');
const names = (n) => Array.from({ length: n }, (_, i) => `لاعب ${i + 1}`);

test('name validation: empty, long, duplicate (normalised), full', () => {
  assert.equal(G.validateName('   ', []), 'empty');
  assert.equal(G.validateName('ا'.repeat(17), []), 'long');
  assert.equal(G.validateName('ا'.repeat(16), []), null);
  assert.equal(G.validateName('أمين', ['امين']), 'duplicate');
  assert.equal(G.validateName(' فاطمة ', ['فاطمه']), 'duplicate');
  assert.equal(G.validateName('سارة', names(12)), 'full');
  assert.equal(G.cleanName('  <b>علي</b>  '), 'bعلي/b');
});

test('spy count suggestions and limits', () => {
  assert.equal(G.suggestSpies(3), 1);
  assert.equal(G.suggestSpies(7), 1);
  assert.equal(G.suggestSpies(8), 2);
  assert.equal(G.maxSpies(3), 1);
  assert.equal(G.maxSpies(5), 2);
  assert.equal(G.maxSpies(12), 5);
  assert.equal(G.resolveSpyCount('auto', 12), 2);
  assert.equal(G.resolveSpyCount(4, 4), 1, 'clamped so innocents outnumber spies');
});

test('role assignment for places: every innocent sees place + role, spies see spy card', () => {
  for (const n of [3, 7, 8, 12]) {
    for (let seed = 1; seed < 40; seed++) {
      const r = G.createRound(names(n), places, { spies: 'auto', minutes: 6, mode: 'places' }, { rng: G.makeRng(seed) });
      assert.equal(r.cards.length, n);
      assert.equal(r.spies.length, G.suggestSpies(n));
      assert.equal(new Set(r.spies).size, r.spies.length);
      r.cards.forEach((c, i) => {
        if (r.spies.includes(i)) assert.equal(c.kind, 'spy');
        else {
          assert.equal(c.kind, 'place');
          assert.equal(c.place, r.item.name);
          assert.ok(c.role);
        }
      });
      assert.ok(!r.spies.includes(r.firstAsker), 'first asker is never a spy');
      assert.equal(new Set(r.order).size, n);
      assert.ok(r.options.includes(r.item.name));
      assert.ok(r.options.length <= G.GUESS_OPTIONS);
      assert.equal(new Set(r.options).size, r.options.length);
    }
  }
});

test('roles are distinct while there are enough of them', () => {
  const r = G.createRound(names(7), places, { spies: 1, mode: 'places' }, { rng: G.makeRng(3) });
  const roles = r.cards.filter((c) => c.kind === 'place').map((c) => c.role);
  const item = places.items.find((i) => i.id === r.item.id);
  if (item.roles_ar.length >= roles.length) assert.equal(new Set(roles).size, roles.length);
});

test('words mode and imposter (الدخيل) variant', () => {
  const r = G.createRound(names(5), words, { spies: 1, mode: 'words' }, { rng: G.makeRng(9) });
  assert.equal(r.mode, 'words');
  r.cards.forEach((c, i) => assert.equal(c.kind, r.spies.includes(i) ? 'spy' : 'word'));
  const im = G.createRound(names(5), words, { spies: 1, mode: 'words', imposter: true }, { rng: G.makeRng(9) });
  const spyCard = im.cards[im.spies[0]];
  assert.equal(spyCard.kind, 'word', 'imposter card looks like a normal word card');
  assert.notEqual(spyCard.word, im.item.name);
  assert.ok(spyCard.word);
  // places pack in words mode uses location name as the word
  const pw = G.createRound(names(4), places, { spies: 1, mode: 'words' }, { rng: G.makeRng(2) });
  assert.equal(pw.mode, 'words');
  assert.ok(pw.cards.some((c) => c.kind === 'word' && c.word === pw.item.name));
});

test('state machine only allows legal transitions', () => {
  const r = G.createRound(names(3), places, { spies: 1 }, { rng: G.makeRng(1) });
  assert.throws(() => G.transition(r, 'result'));
  assert.throws(() => G.spyGuess(r, 'x'));
  assert.ok(G.canTransition('vote', 'spyGuess'));
  assert.ok(!G.canTransition('result', 'reveal'));
});

test('reveal flow: cannot skip a card without holding it', () => {
  let r = G.createRound(names(3), places, { spies: 1, minutes: 5 }, { rng: G.makeRng(1) });
  r = G.revealNext(r); // pass → card
  assert.equal(r.revealStep, 'card');
  assert.equal(G.revealNext(r), r, 'blocked until seen');
  for (let i = 0; i < 3; i++) {
    if (r.revealStep === 'pass') r = G.revealNext(r);
    r = G.revealNext({ ...r, seen: true });
  }
  assert.equal(r.phase, 'discussion');
  assert.ok(r.endsAt > Date.now());
});

test('timer pause / resume keeps remaining time', () => {
  let r = G.createRound(names(3), places, { spies: 1, minutes: 6 }, { rng: G.makeRng(1) });
  r = { ...r, phase: 'reveal' };
  r = G.startDiscussion(r, 1000);
  assert.equal(G.remainingMs(r, 61000), 6 * 60000 - 60000);
  r = G.pauseTimer(r, 61000);
  assert.equal(G.remainingMs(r, 999999), 300000);
  r = G.resumeTimer(r, 100000);
  assert.equal(G.remainingMs(r, 160000), 240000);
  assert.equal(G.remainingMs({ ...r, endsAt: 0 }, 5), 6 * 60000, 'no endsAt → full time');
  assert.equal(G.remainingMs(r, 1e12), 0);
});

function playTo(outcome, n = 5, seed = 4) {
  let r = G.createRound(names(n), places, { spies: 'auto', minutes: 1 }, { rng: G.makeRng(seed) });
  r = G.startDiscussion(r);
  if (outcome === 'escaped') {
    const innocent = r.cards.findIndex((_, i) => !r.spies.includes(i));
    return G.accuse(r, innocent);
  }
  r = G.accuse(r, r.spies[0]);
  assert.equal(r.phase, 'spyGuess');
  return G.spyGuess(r, outcome === 'guessed' ? r.item.name : r.options.find((o) => o !== r.item.name));
}

test('scoring: escaped / guessed / caught', () => {
  for (const n of [3, 8, 12]) {
    const esc = playTo('escaped', n);
    assert.equal(esc.outcome, 'escaped');
    esc.cards.forEach((c, i) => assert.equal(esc.points[c.name], esc.spies.includes(i) ? 2 : 0));
    const gs = playTo('guessed', n);
    assert.equal(gs.outcome, 'guessed');
    gs.cards.forEach((c, i) => assert.equal(gs.points[c.name], gs.spies.includes(i) ? 2 : 0));
    const ct = playTo('caught', n);
    assert.equal(ct.outcome, 'caught');
    ct.cards.forEach((c, i) => assert.equal(ct.points[c.name], ct.spies.includes(i) ? 0 : 1));
  }
});

test('scores accumulate once per round and rank with ties', () => {
  const r = playTo('caught', 4);
  let s = G.applyScores({}, r);
  s = G.applyScores(s, { ...r, applied: true });
  assert.equal(Object.values(s).reduce((a, b) => a + b, 0), 3);
  const rank = G.ranking({ a: 3, b: 3, c: 1 }, ['a', 'b', 'c', 'd']);
  assert.deepEqual(rank.map((x) => x.rank), [1, 1, 3, 4]);
});

test('shuffle bag: no repeats until the pack is exhausted, persists, no back-to-back across refills', () => {
  const ids = places.items.map((i) => i.id);
  const rng = G.makeRng(11);
  let bag = [];
  let last = null;
  for (let cycle = 0; cycle < 6; cycle++) {
    const seen = new Set();
    for (let k = 0; k < ids.length; k++) {
      const d = G.drawFromBag(bag, ids, last, rng);
      assert.ok(!seen.has(d.id), 'repeat inside a cycle');
      if (k === 0) assert.notEqual(d.id, last, 'same item twice in a row across refill');
      seen.add(d.id);
      bag = JSON.parse(JSON.stringify(d.bag)); // survives persistence
      last = d.id;
    }
    assert.equal(seen.size, ids.length);
  }
  // removed ids are dropped
  const d = G.drawFromBag(['gone', ids[0]], ids, null, rng);
  assert.equal(d.id, ids[0]);
});

test('resume never lands on an open card and drops garbage', () => {
  const r = { ...G.createRound(names(3), places, { spies: 1 }, { rng: G.makeRng(1) }), revealStep: 'card', seen: true };
  const s = G.sanitizeForResume(JSON.parse(JSON.stringify(r)));
  assert.equal(s.revealStep, 'pass');
  assert.equal(s.seen, false);
  assert.equal(G.sanitizeForResume({ phase: 'weird' }), null);
  assert.equal(G.sanitizeForResume(null), null);
  const d = G.startDiscussion(r);
  assert.equal(G.sanitizeForResume(d).phase, 'discussion');
});

test('online vote tally: strict majority or nobody', () => {
  assert.equal(G.tallyVotes({ a: 'x', b: 'x', c: 'y' }, 3), 'x');
  assert.equal(G.tallyVotes({ a: 'x', b: 'y', c: 'z', d: 'x' }, 4), null);
  assert.equal(G.tallyVotes({}, 4), null);
});

test('distribution is fair: each seat is a spy roughly 1/n of the time', () => {
  const n = 6;
  const counts = Array(n).fill(0);
  const rng = G.makeRng(123);
  for (let k = 0; k < 6000; k++) {
    const r = G.createRound(names(n), places, { spies: 1 }, { rng });
    counts[r.spies[0]]++;
  }
  for (const c of counts) assert.ok(c > 850 && c < 1150, `skewed: ${counts}`);
});
