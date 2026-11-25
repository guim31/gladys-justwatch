// -----------------------------------------------------------------------------
// The monitor against the fake Gladys and the replayed JustWatch: devices per
// list, states, the two scene triggers (and when they must NOT fire), the
// connection status, a restart, the timer of the container.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listIds, watchlistIds } from '../src/device.js';
import { TRIGGERS } from '../src/monitor.js';
import { BASE_CONFIG, createAll, createApi, createWorld, cycle, newEdge } from './helpers/world.js';

async function world(t, options) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}
const L1 = 'ext:test-integration:list:list-1';

test('one device per list with known platforms, plus the watched titles', async (t) => {
  const w = await world(t, {
    config: { ...BASE_CONFIG, list_3_platforms: 'Nopeflix', list_2_kind: 'bogus' },
  });
  assert.deepEqual(
    w.fake.discoveredDevices.map((d) => d.name),
    [
      'JustWatch Netflix + Amazon Prime Video',
      'JustWatch Disney Plus + Canal+',
      'JustWatch titres surveillés',
    ],
  );
  assert.ok(w.fake.discoveredDevices.every((d) => d.should_poll === false));
  // An unknown platform is said in the status, the rest works.
  assert.equal(w.fake.connectionStatus.connected, true);
  assert.match(
    w.fake.connectionStatus.message.fr,
    /Plateforme inconnue de JustWatch dans ce pays : Nopeflix\./,
  );
  assert.match(w.fake.connectionStatus.message.de, /Nopeflix/);
});

test('states: titles of today, of 7 days and the latest arrival, by kind', async (t) => {
  const w = await world(t);
  await createAll(w);
  const one = listIds(w.gladys, '1');
  const two = listIds(w.gladys, '2');
  assert.equal(w.fake.lastState(one.new_today), 25);
  assert.equal(w.fake.lastState(one.new_week), 79);
  assert.equal(
    w.fake.lastState(one.last_title),
    'Le Seigneur des anneaux : Les Anneaux de pouvoir, saison 3 · Amazon Prime Video',
  );
  // List 2 keeps the series only.
  const days = w.monitor.lists.get('2').byDay;
  assert.ok(days.every((d) => d.titles.every((title) => title.kind === 'show')));
  assert.equal(w.fake.lastState(two.new_today), days[0].titles.length);
  const watch = watchlistIds(w.gladys);
  assert.equal(w.fake.lastState(watch.available), 2);
  assert.equal(w.fake.lastState(watch.watched), 3);
  assert.equal(w.fake.lastState(watch.last_available), 'Severance (2022) · Canal+');
});

test('a new title fires new_title once, not the titles listed at the first reading', async (t) => {
  const w = await world(t);
  const before = w.fake.sceneEvents.filter((e) => e.key === TRIGGERS.NEW_TITLE);
  assert.deepEqual(before, [], 'the first reading is not news');
  w.api.extra['2026-11-25'] = [
    newEdge({ id: 'tm9000001', title: 'Arrival Test', year: 2025 }),
    newEdge({
      id: 'tss9000002',
      title: 'Show Test',
      season: 2,
      platform: ['Disney Plus', 'dnp', 337],
    }),
    newEdge({ id: 'tm9000003', title: 'Film Test', platform: ['Disney Plus', 'dnp', 337] }),
  ];
  await cycle(w);
  const events = w.fake.sceneEvents.filter((e) => e.key === TRIGGERS.NEW_TITLE);
  assert.deepEqual(
    events.map((e) => [e.data.device.slice(-6), e.data.title]),
    [
      ['list-1', 'Arrival Test'],
      ['list-2', 'Show Test'],
    ],
    'list 2 keeps series only',
  );
  assert.deepEqual(events[0].data, {
    device: L1,
    kind: 'movie',
    title: 'Arrival Test',
    year: 2025,
    season: 0,
    platforms: 'Netflix',
    url: 'https://www.justwatch.com/fr/film/tm9000001',
    summary: 'Nouveau sur Netflix : Arrival Test (2025).',
  });
  assert.equal(events[1].data.summary, 'Nouveau sur Disney Plus : Show Test, saison 2.');
  await cycle(w);
  assert.equal(w.fake.sceneEvents.filter((e) => e.key === TRIGGERS.NEW_TITLE).length, 2);
  // The latest arrival is the one just announced.
  await createAll(w);
  assert.equal(
    w.fake.lastState(listIds(w.gladys, '1').last_title),
    'Arrival Test (2025) · Netflix',
  );
});

test('a restart fires nothing again; a list whose platforms change starts over quietly', async (t) => {
  const api = createApi();
  const first = await world(t, { api });
  api.extra['2026-11-25'] = [newEdge({ id: 'tm9000001', title: 'Arrival Test' })];
  await cycle(first);
  await first.app.stop();
  const again = await world(t, { api, dataDir: first.dataDir, clock: first.clock });
  assert.deepEqual(again.fake.sceneEvents, []);
  api.extra['2026-11-25'].push(
    newEdge({ id: 'tm9000004', title: 'Other', platform: ['Arte', 'art', 234] }),
  );
  await again.fake.configUpdated({ ...BASE_CONFIG, list_1_platforms: 'Netflix, Arte' });
  assert.deepEqual(
    again.fake.sceneEvents.filter((e) => e.key === TRIGGERS.NEW_TITLE),
    [],
  );
});

test('title_available: at once for a title already there, then when it arrives', async (t) => {
  const w = await world(t);
  const fired = () => w.fake.sceneEvents.filter((e) => e.key === TRIGGERS.AVAILABLE);
  assert.deepEqual(
    fired().map((e) => e.data.summary),
    ['Dune (1984) est disponible sur Canal+.', 'Severance (2022) est disponible sur Canal+.'],
  );
  await cycle(w);
  assert.equal(fired().length, 2, 'nothing new');
  w.api.arrive('tm305113', ['Netflix', 'nfx', 8]);
  await cycle(w);
  assert.deepEqual(fired()[2].data, {
    title: 'Dune - Première partie',
    year: 2021,
    platforms: 'Netflix',
    url: 'https://www.justwatch.com/fr/film/dune-2020',
    summary: 'Dune - Première partie (2021) est disponible sur Netflix.',
  });
  // A platform out of the lists does not count.
  w.api.arrive('tm305113', ['Arte', 'art', 234]);
  await cycle(w);
  assert.equal(fired().length, 3);
  // Searched once each, then one call for all.
  const searches = w.api.requests.filter((r) => r.body.operationName === 'Search');
  assert.equal(searches.length, 3);
});

test('a watched title JustWatch does not know is said in the status, and searched once a day', async (t) => {
  const w = await world(t, { config: { ...BASE_CONFIG, watched_titles: 'zzqqxxnotatitle' } });
  assert.match(
    w.fake.connectionStatus.message.en,
    /Title not found on JustWatch: zzqqxxnotatitle\./,
  );
  await cycle(w);
  const searches = () => w.api.requests.filter((r) => r.body.operationName === 'Search').length;
  assert.equal(searches(), 1);
  await cycle(w, 24 * 60);
  assert.equal(searches(), 2);
});

test('JustWatch down: disconnected with a message, states kept, back at recovery', async (t) => {
  const w = await world(t);
  await createAll(w);
  const one = listIds(w.gladys, '1');
  w.api.down = 'network';
  await cycle(w);
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.equal(w.fake.connectionStatus.message.fr, 'JustWatch est injoignable.');
  assert.equal(w.fake.lastState(one.new_today), 25);
  assert.equal(w.fake.discoveredDevices.length, 3, 'the devices stay');
  w.api.down = false;
  await cycle(w);
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('no platform at all: the status says what to do', async (t) => {
  const w = await world(t, { config: {} });
  assert.deepEqual(w.fake.discoveredDevices, []);
  assert.equal(
    w.fake.connectionStatus.message.fr,
    'Aucune plateforme : remplissez une liste dans la configuration.',
  );
});

test('another country: Germany', async (t) => {
  const w = await world(t, {
    config: { country: 'DE', language: 'de', list_1_platforms: 'Netflix, Amazon Prime Video' },
  });
  await createAll(w);
  assert.equal(w.fake.discoveredDevices[0].features[0].name, 'Neu heute');
  assert.equal(w.monitor.lists.get('1').byDay[0].titles.length, 0, 'no fixture for the 25th');
  assert.ok(w.monitor.lists.get('1').byDay[1].titles.length > 50);
  const request = w.api.requests.find((r) => r.body.operationName === 'NewTitles');
  assert.equal(request.body.variables.country, 'DE');
  assert.equal(request.body.variables.language, 'de');
});

test('the older days are read once a day, today and yesterday at every cycle', async (t) => {
  const w = await world(t, { config: { list_1_platforms: 'Netflix' } });
  const count = () => w.api.requests.filter((r) => r.body.operationName === 'NewTitles').length;
  const first = count();
  await cycle(w);
  assert.equal(count() - first, 4, 'today (three pages) and yesterday');
});

test('the container reads by itself on its timer, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const w = await world(t, { timers: true, config: { list_1_platforms: 'Netflix' } });
  const before = w.api.requests.length;
  t.mock.timers.tick(120 * 60 * 1000);
  await w.monitor.running;
  assert.ok(w.api.requests.length > before);
});

test('onDeviceCreated publishes every state of that device again', async (t) => {
  const w = await world(t);
  await createAll(w);
  const one = listIds(w.gladys, '1');
  const count = () =>
    w.fake.states.filter((s) => s.device_feature_external_id === one.new_today).length;
  const before = count();
  await w.fake.deviceCreated(w.fake.discoveredDevices[0]);
  assert.equal(count(), before + 1);
  assert.ok(w.fake.widgetRefreshes.includes('new_titles'));
});
