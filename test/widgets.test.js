// -----------------------------------------------------------------------------
// The `new_titles` widget (checked by the SDK's own validator, in the four
// languages) and the `where_to_watch` scene action.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from '../src/config.js';
import { BASE_CONFIG, createWorld } from './helpers/world.js';

async function world(t, options) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}
const content = async (w, settings = {}, language = 'fr') => {
  const ack = await w.fake.widgetGet('new_titles', { settings, language });
  assert.equal(ack.success, true, JSON.stringify(ack.error));
  return ack.data.content;
};
const check = (value) => {
  assert.deepEqual(validateWidgetContent(value), []);
};

for (const language of LANGUAGES) {
  test(`the widget passes the SDK validator (${language})`, async (t) => {
    const w = await world(t);
    for (const days of ['1', '3', '7']) {
      check(await content(w, { days }, language));
    }
  });
}

test('the arrivals of today, newest day first, then the watched titles', async (t) => {
  const w = await world(t);
  const { components } = await content(w);
  const [cards, status] = components;
  assert.equal(cards.type, 'card-list');
  assert.equal(cards.items.length, 8);
  assert.deepEqual(cards.items[0], {
    title: 'Le Seigneur des anneaux : Les Anneaux de pouvoir · S3',
    subtitle: 'Série · 2022 · Amazon Prime Video',
    badge: { text: 'Aujourd’hui', color: 'success' },
    links: [
      {
        url: 'https://www.justwatch.com/fr/serie/the-lord-of-the-rings/saison-3',
        label: 'JustWatch',
      },
    ],
  });
  assert.deepEqual(
    status.items.map((row) => [row.label, row.value]),
    [
      ['Dune', 'Canal+'],
      ['Severance', 'Canal+'],
      ['Dune - Première partie', 'Pas sur vos plateformes'],
    ],
  );
  const hidden = await content(w, { show_watched: false });
  assert.equal(hidden.components.length, 1);
});

test('one list only, and a period without any title', async (t) => {
  const w = await world(t, { config: { country: 'DE', list_1_platforms: 'Netflix' } });
  const device = w.fake.discoveredDevices[0].external_id;
  const today = await content(w, { device, days: '1' }, 'en');
  assert.deepEqual(today.components, [
    { type: 'text', variant: 'caption', text: 'Nothing new in this period.' },
  ]);
  const week = await content(w, { device, days: '3' }, 'en');
  assert.equal(week.components[0].items[0].badge.text, 'Yesterday');
});

test('without any list, the widget says so', async (t) => {
  const w = await world(t, { config: {} });
  const { components } = await content(w, {}, 'de');
  assert.equal(components[0].text, 'Keine Plattform eingestellt.');
});

test('where_to_watch: found on my platforms, not on them, not found', async (t) => {
  const w = await world(t, { config: BASE_CONFIG });
  const run = async (title) => {
    const ack = await w.fake.sceneAction('where_to_watch', { title });
    assert.equal(ack.success, true, JSON.stringify(ack.error));
    return ack.data.outputs;
  };
  assert.deepEqual(await run('Severance'), {
    found: 1,
    title: 'Severance',
    year: 2022,
    available: 1,
    platforms: 'Canal+',
    url: 'https://www.justwatch.com/fr/serie/severance',
  });
  assert.equal((await run('Dune')).available, 0);
  assert.equal((await run('Dune (1984)')).platforms, 'Canal+');
  assert.deepEqual(await run('zzqqxxnotatitle'), {
    found: 0,
    title: '',
    year: 0,
    available: 0,
    platforms: '',
    url: '',
  });
  w.api.down = 'network';
  const failed = await w.fake.sceneAction('where_to_watch', { title: 'Severance' });
  assert.equal(failed.success, false);
});
