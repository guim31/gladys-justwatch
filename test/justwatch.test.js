// -----------------------------------------------------------------------------
// The JustWatch client on the real answers recorded on 25/11/2026 (France and
// Germany), and on the failures of an unofficial API: an HTTP error, a page
// that is not JSON, the network down, a 429.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_URL, createJustWatch, fold, toTitle } from '../src/justwatch.js';
import { matchPlatform } from '../src/monitor.js';
import { createApi } from './helpers/world.js';

const client = (api = createApi(), extra = {}) =>
  createJustWatch({ fetch: api.fetch, sleep: async () => {}, ...extra });

test('the platforms of France and of Germany, matched from what a user types', async () => {
  const fr = await client().packages('FR');
  const de = await client().packages('DE');
  assert.equal(fr.length, 120);
  assert.equal(de.length, 163);
  assert.deepEqual(fr[0], {
    id: 8,
    name: 'Netflix',
    short: 'nfx',
    technical: 'netflix',
    kinds: ['FLATRATE'],
  });
  const name = (list, typed) => matchPlatform(list, typed)?.name;
  assert.equal(name(fr, 'netflix'), 'Netflix');
  assert.equal(name(fr, 'Prime Video'), 'Amazon Prime Video');
  assert.equal(name(fr, 'Disney+'), 'Disney Plus');
  assert.equal(name(fr, 'canal +'), 'Canal+');
  assert.equal(name(fr, 'nfx'), 'Netflix');
  assert.equal(name(fr, 'Platform That Does Not Exist'), undefined);
  // An add-on channel only when named as such.
  assert.equal(name(fr, 'France TV'), undefined);
  assert.equal(name(fr, 'France TV Amazon Channel'), 'France TV Amazon Channel');
  assert.equal(name(de, 'Disney+'), 'Disney Plus');
  assert.equal(fold('Ça c’est Canal+ !'), 'cacestcanalplus');
});

test('the new titles of a day: every page read, one entry per title', async () => {
  const api = createApi();
  const { titles, truncated } = await client(api).newTitles({
    country: 'FR',
    language: 'fr',
    day: '2026-11-25',
    packages: ['nfx', 'prv', 'dnp', 'cpd'],
  });
  assert.equal(truncated, false);
  assert.equal(api.requests.length, 3, 'three pages of 100');
  assert.equal(new Set(titles.map((t) => t.id)).size, titles.length);
  assert.ok(titles.length > 150);
  assert.deepEqual(titles[0], {
    id: 'tss461316',
    kind: 'show',
    title: 'Le Seigneur des anneaux : Les Anneaux de pouvoir',
    year: 2022,
    season: 3,
    url: 'https://www.justwatch.com/fr/serie/the-lord-of-the-rings/saison-3',
    platforms: ['Amazon Prime Video'],
  });
  assert.ok(titles.some((t) => t.kind === 'movie' && t.season === 0 && t.year > 1900));
  const [request] = api.requests;
  assert.equal(request.url, API_URL);
  assert.match(request.headers['user-agent'], /^gladys-justwatch \(\+https:\/\/github\.com/);
  assert.deepEqual(request.body.variables.filter.monetizationTypes, ['FLATRATE', 'FREE', 'ADS']);
});

test('Germany, in German', async () => {
  const { titles } = await client().newTitles({
    country: 'DE',
    language: 'de',
    day: '2026-11-24',
    packages: ['nfx', 'amp', 'dnp'],
  });
  assert.ok(titles.length > 100);
  assert.ok(titles.every((t) => t.url.startsWith('https://www.justwatch.com/de/')));
});

test('a search: the most popular answer, or the version of the year typed', async () => {
  const packages = ['nfx', 'prv', 'dnp', 'cpd'];
  const jw = client();
  const base = { country: 'FR', language: 'fr', packages };
  const dune = await jw.search({ ...base, query: 'Dune' });
  assert.equal(dune.title, 'Dune - Première partie');
  assert.deepEqual(dune.platforms, []);
  const old = await jw.search({ ...base, query: 'Dune', year: 1984 });
  assert.equal(old.id, 'tm166964');
  assert.deepEqual(old.platforms, ['Canal+'], 'one name per platform, whatever the quality');
  assert.equal(await jw.search({ ...base, query: 'Dune', year: 1950 }), null);
  assert.equal(await jw.search({ ...base, query: 'zzqqxxnotatitle' }), null);
  const offers = await jw.offers({ ...base, ids: ['ts320458', 'tm1'] });
  assert.deepEqual([...offers.keys()], ['ts320458']);
  assert.deepEqual(offers.get('ts320458').platforms, ['Canal+']);
});

test('the failures are JustWatchErrors with a short reason', async () => {
  const api = createApi();
  const jw = client(api);
  api.down = 'network';
  await assert.rejects(jw.packages('FR'), /JustWatch unreachable: ENOTFOUND/);
  api.down = 503;
  await assert.rejects(jw.packages('FR'), /JustWatch answered HTTP 503: Down/);
  api.down = 'html';
  await assert.rejects(jw.packages('FR'), /JustWatch answered HTTP 502, not JSON/);
  // A schema change: GraphQL answers 422 with its message.
  api.down = false;
  const changed = createJustWatch({
    fetch: async () => ({
      status: 422,
      json: async () => ({ errors: [{ message: 'Cannot query field "packages"' }], data: null }),
    }),
    sleep: async () => {},
  });
  await assert.rejects(changed.packages('FR'), /HTTP 422: Cannot query field "packages"/);
  // A valid answer of the wrong shape.
  const odd = createJustWatch({
    fetch: async () => ({ status: 200, json: async () => ({ data: { newTitles: null } }) }),
    sleep: async () => {},
  });
  await assert.rejects(
    odd.newTitles({ country: 'FR', language: 'fr', day: '2026-11-25', packages: ['nfx'] }),
    /no list of new titles/,
  );
});

test('a 429 is retried once after a pause; the calls are spaced', async () => {
  const pauses = [];
  let calls = 0;
  const api = createApi();
  const jw = createJustWatch({
    fetch: async (url, init) => {
      calls += 1;
      return calls === 1 ? { status: 429, json: async () => ({}) } : api.fetch(url, init);
    },
    sleep: async (ms) => pauses.push(ms),
    now: () => 1000,
  });
  assert.equal((await jw.packages('FR')).length, 120);
  assert.equal(calls, 2);
  assert.ok(pauses.includes(15000));
  await jw.packages('DE');
  assert.ok(pauses.filter((ms) => ms === 1000).length >= 1, 'a second between two calls');
});

test('a node without a title is skipped', () => {
  assert.equal(toTitle(null), null);
  assert.equal(toTitle({ id: 'tm1', __typename: 'Movie', content: { title: ' ' } }), null);
  assert.equal(toTitle({ id: 'tss1', __typename: 'Season', content: { title: 'S1' } }), null);
});
