// -----------------------------------------------------------------------------
// What the integration writes to `docker logs`: at info, only the lifecycle
// (the start, JustWatch lost and back, a configuration saved, a scene action),
// never one line per refresh cycle nor per new title; a failure that repeats
// at every cycle is logged once, plus one line when it is over.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureLogs, createAll, createWorld, cycle, newEdge } from './helpers/world.js';

const strip = (line) => line.text.replace(/^\[[^\]]+\] /, '');

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

test('the start is one info line', async (t) => {
  const lines = captureLogs(t, 'info');
  await world(t);
  assert.deepEqual(lines.map(strip), [
    '[INFO] [justwatch] Started: 2 list(s) and 3 watched title(s) in FR, read every 120 min',
  ]);
});

test('normal cycles write nothing at info, new titles included', async (t) => {
  const w = await world(t);
  await createAll(w);
  const lines = captureLogs(t, 'info');
  w.api.extra['2026-11-25'] = [newEdge({ id: 'tm9000001', title: 'Quiet' })];
  for (let i = 0; i < 3; i += 1) {
    await cycle(w);
  }
  assert.equal(w.fake.sceneEvents.filter((e) => e.key === 'new_title').length, 1);
  assert.deepEqual(lines, []);
});

test('LOG_LEVEL=debug shows the cycles', async (t) => {
  const lines = captureLogs(t, 'debug');
  const w = await world(t);
  await cycle(w);
  assert.ok(lines.some((line) => /List 1: 25 new title\(s\) today, 79 in 7 days/.test(line.text)));
});

test('JustWatch down at every cycle: one warning, then one line at recovery', async (t) => {
  const w = await world(t);
  const lines = captureLogs(t, 'info');
  w.api.down = 503;
  for (let i = 0; i < 4; i += 1) {
    await cycle(w);
  }
  assert.deepEqual(lines.map(strip), [
    '[WARN] [justwatch] JustWatch unreachable: JustWatch answered HTTP 503: Down',
  ]);
  w.api.down = false;
  await cycle(w);
  assert.deepEqual(lines.slice(1).map(strip), ['[INFO] [justwatch] JustWatch answers again']);
});

test('an unknown platform and a title not found are said once', async (t) => {
  const lines = captureLogs(t, 'info');
  const w = await world(t, {
    config: { list_1_platforms: 'Netflix, Nopeflix', watched_titles: 'zzqqxxnotatitle' },
  });
  for (let i = 0; i < 3; i += 1) {
    await cycle(w);
  }
  assert.deepEqual(lines.map(strip), [
    '[INFO] [justwatch] Started: 1 list(s) and 1 watched title(s) in FR, read every 120 min',
    '[WARN] [justwatch] Platform unknown to JustWatch in FR: Nopeflix',
    '[WARN] [justwatch] Title not found on JustWatch: zzqqxxnotatitle',
  ]);
});
