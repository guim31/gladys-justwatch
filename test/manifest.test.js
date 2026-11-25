// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SCENE_ACTION } from '../src/app.js';
import {
  COUNTRIES,
  DEFAULT_CONFIG,
  KINDS,
  LANGUAGES,
  REFRESH_INTERVALS,
  normalizeConfig,
  splitList,
} from '../src/config.js';
import { TRIGGERS, WIDGET_KEY } from '../src/monitor.js';
import { WIDGETS, WIDGET_DAYS } from '../src/widgets.js';
import { createWorld, cycle, newEdge } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const { gladys: registered, app } = await createWorld({ connect: false });
await app.stop();
const handlerKeys = (prefix) =>
  Object.keys(registered.handlers)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));
const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const field = (list, key) => list.find((entry) => entry.key === key);

test('identity: name, image, cover, cloud transport, categories', () => {
  assert.equal(manifest.name, 'JustWatch');
  assert.equal(manifest.type, 'device');
  assert.match(manifest.docker_image, /^ghcr\.io\/guim31\/gladys-justwatch:/);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-justwatch/main/cover.png',
  );
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.deepEqual(manifest.categories, ['multimedia', 'leisure']);
  assert.equal(manifest.gladys_version, '>=5.1.0');
});

test('version, package and image tag agree', () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`));
});

test('the defaults and the options of the manifest are those of the code', () => {
  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    assert.deepEqual(field(manifest.config_schema, key).default, value, key);
  }
  const options = (key) => field(manifest.config_schema, key).options.map((o) => o.value);
  assert.deepEqual(options('refresh_interval'), REFRESH_INTERVALS);
  assert.deepEqual(options('language'), LANGUAGES);
  assert.deepEqual(options('country'), COUNTRIES);
  for (const slot of ['1', '2', '3']) {
    assert.deepEqual(options(`list_${slot}_kind`), KINDS);
  }
  const widget = field(manifest.widgets, WIDGET_KEY);
  assert.deepEqual(
    field(widget.settings, 'days').options.map((o) => o.value),
    WIDGET_DAYS,
  );
});

test('the configuration is read safely', () => {
  const config = normalizeConfig({
    country: 'xx',
    list_1_platforms: ' Netflix ,, netflix, Disney+ ',
    list_2_platforms: '  ',
    list_3_platforms: 'Arte',
    list_3_kind: 'movies',
    watched_titles: 'Love, Death & Robots; Dune (1984)',
    refresh_interval: '5',
    language: 'it',
  });
  assert.equal(config.country, 'FR');
  assert.deepEqual(config.lists, [
    { slot: '1', platforms: ['Netflix', 'Disney+'], kind: 'all' },
    { slot: '3', platforms: ['Arte'], kind: 'movies' },
  ]);
  assert.deepEqual(config.watched, [
    { text: 'Love, Death & Robots', query: 'Love, Death & Robots', year: 0 },
    { text: 'Dune (1984)', query: 'Dune', year: 1984 },
  ]);
  assert.equal(config.refreshMinutes, 120);
  assert.equal(config.language, 'fr');
  assert.deepEqual(splitList('a, b'), ['a', 'b']);
  assert.deepEqual(normalizeConfig({ watched_titles: 'Love, Death & Robots' }).watched, [
    { text: 'Love, Death & Robots', query: 'Love, Death & Robots', year: 0 },
  ]);
  const many = Array.from({ length: 22 }, (_, i) => `Title ${i}`).join('; ');
  assert.equal(normalizeConfig({ watched_titles: many }).droppedWatched.length, 2);
});

test('every handler is declared, and every declaration has its handler', () => {
  assert.deepEqual(keysOf(manifest.widgets), [WIDGET_KEY]);
  assert.deepEqual(Object.keys(WIDGETS), [WIDGET_KEY]);
  assert.deepEqual(handlerKeys('widget:'), [WIDGET_KEY]);
  assert.deepEqual(keysOf(manifest.scene_actions), [SCENE_ACTION]);
  assert.deepEqual(handlerKeys('sceneAction:'), [SCENE_ACTION]);
  assert.equal(manifest.actions, undefined);
  assert.deepEqual(keysOf(manifest.scene_triggers), Object.values(TRIGGERS));
  assert.deepEqual(keysOf(field(manifest.widgets, WIDGET_KEY).settings), [
    'device',
    'days',
    'show_watched',
  ]);
});

test('the scene events carry the fields and the variables of their trigger', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  world.api.extra['2026-11-25'] = [newEdge({ id: 'tm9000001', title: 'Check' })];
  await cycle(world);
  const seen = new Set();
  for (const event of world.fake.sceneEvents) {
    seen.add(event.key);
    const trigger = field(manifest.scene_triggers, event.key);
    const declared = [...keysOf(trigger.fields), ...keysOf(trigger.variables)];
    assert.deepEqual(Object.keys(event.data).sort(), declared.sort(), event.key);
    for (const variable of trigger.variables) {
      assert.equal(typeof event.data[variable.key], variable.type, variable.key);
    }
    for (const declaredField of trigger.fields ?? []) {
      if (declaredField.options) {
        assert.ok(declaredField.options.some((o) => o.value === event.data[declaredField.key]));
      }
    }
  }
  assert.deepEqual([...seen].sort(), Object.values(TRIGGERS).sort());
});

test('the scene action resolves its declared outputs', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const ack = await world.fake.sceneAction(SCENE_ACTION, { title: 'Severance' });
  const action = field(manifest.scene_actions, SCENE_ACTION);
  assert.deepEqual(Object.keys(ack.data.outputs), keysOf(action.outputs));
  for (const output of action.outputs) {
    assert.equal(typeof ack.data.outputs[output.key], output.type, output.key);
  }
});
