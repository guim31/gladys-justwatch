// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake JustWatch GraphQL API
// replaying the real answers recorded in test/fixtures/justwatch (25/11/2026),
// a manual clock, a temporary /data, and the integration wired on top through
// registerHandlers. Nothing touches the network.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';

process.env.LOG_LEVEL ??= 'silent';
process.env.TZ = 'Europe/Paris';

const DIR = new URL('../fixtures/justwatch/', import.meta.url);
export const read = (name) => JSON.parse(readFileSync(new URL(name, DIR), 'utf8'));

// Recorded on 25/11/2026 around 20:30 Paris time: "today" is the 25th.
export const START = Date.parse('2026-11-25T19:00:00Z');

const EMPTY_DAY = {
  data: {
    newTitles: { totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, edges: [] },
  },
};

/** Every title node of the recorded searches, by id (Offers answers from them). */
function searchNodes() {
  const nodes = new Map();
  for (const file of readdirSync(DIR).filter((name) => name.startsWith('search-'))) {
    for (const edge of read(file).data.popularTitles.edges) {
      nodes.set(edge.node.id, structuredClone(edge.node));
    }
  }
  return nodes;
}

/** A new-title edge, for a title arriving during a test. */
export function newEdge({ id, title, year = 2026, platform = ['Netflix', 'nfx', 8], season }) {
  const [clearName, shortName, packageId] = platform;
  const node = season
    ? {
        __typename: 'Season',
        id,
        content: {
          title: `Saison ${season}`,
          fullPath: `/fr/serie/x/saison-${season}`,
          seasonNumber: season,
        },
        show: {
          id: `ts${id}`,
          content: { title, fullPath: '/fr/serie/x', originalReleaseYear: year },
        },
      }
    : {
        __typename: 'Movie',
        id,
        content: { title, fullPath: `/fr/film/${id}`, originalReleaseYear: year },
      };
  return {
    newOffer: {
      monetizationType: 'FLATRATE',
      package: { packageId, clearName, shortName },
    },
    node,
  };
}

/**
 * Fake apis.justwatch.com. `api.down`: 'network', a status (503), 'html'
 * (a proxy error page) or false. `api.extra[day]`: edges added to a day.
 */
export function createApi() {
  const api = {
    down: false,
    requests: [],
    extra: {},
    nodes: searchNodes(),

    async fetch(input, init = {}) {
      const body = JSON.parse(init.body);
      api.requests.push({ url: String(input), headers: init.headers, body });
      if (api.down === 'network') {
        throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
      }
      if (api.down === 'html') {
        return {
          status: 502,
          json: async () => JSON.parse('<html>Bad gateway</html>'),
        };
      }
      if (api.down) {
        return { status: api.down, json: async () => ({ errors: [{ message: 'Down' }] }) };
      }
      return { status: 200, json: async () => api.answer(body) };
    },

    answer({ operationName, variables: v }) {
      const exists = (name) => readdirSync(DIR).includes(`${name}.json`);
      if (operationName === 'Packages') {
        return exists(`packages-${v.country}`)
          ? read(`packages-${v.country}.json`)
          : { data: { packages: [] } };
      }
      if (operationName === 'NewTitles') {
        const name = `new-${v.country}-${v.date}-p${v.after ?? 0}`;
        const answer = exists(name) ? read(`${name}.json`) : structuredClone(EMPTY_DAY);
        const list = answer.data.newTitles;
        if (!v.after) {
          list.edges.unshift(...(api.extra[v.date] ?? []));
        }
        const wanted = new Set(v.filter.packages);
        list.edges = list.edges.filter((edge) => wanted.has(edge.newOffer.package.shortName));
        return answer;
      }
      if (operationName === 'Search') {
        const name = `search-${v.query}`;
        const answer = exists(name)
          ? read(`${name}.json`)
          : { data: { popularTitles: { edges: [] } } };
        for (const edge of answer.data.popularTitles.edges) {
          edge.node = api.withOffers(api.nodes.get(edge.node.id) ?? edge.node, v.packages);
        }
        return answer;
      }
      if (operationName === 'Offers') {
        return {
          data: {
            nodes: v.ids
              .map((id) => api.nodes.get(id))
              .filter(Boolean)
              .map((node) => api.withOffers(node, v.packages)),
          },
        };
      }
      throw new Error(`Unexpected operation ${operationName}`);
    },

    /** A node with only the offers on `packages` (what the filter of the API does). */
    withOffers(node, packages) {
      return {
        ...node,
        offers: (node.offers ?? []).filter((offer) => packages.includes(offer.package.shortName)),
      };
    },

    /** A watched title arrives on a platform. */
    arrive(id, [clearName, shortName, packageId]) {
      api.nodes.get(id).offers.push({
        monetizationType: 'FLATRATE',
        package: { packageId, clearName, shortName },
      });
    },
  };
  return api;
}

/** A manual clock. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

export const BASE_CONFIG = {
  list_1_platforms: 'Netflix, Prime Video',
  list_2_platforms: 'Disney+; Canal+',
  list_2_kind: 'shows',
  watched_titles: 'Dune (1984); Severance; Dune',
};

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {object} [options.api] from createApi
 * @param {boolean} [options.connect]
 */
export async function createWorld({
  config = BASE_CONFIG,
  devices = [],
  api = createApi(),
  connect = true,
  timers = false,
  clock = createClock(),
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-justwatch-')),
} = {}) {
  const gladys = createFakeGladys({ config, devices });
  const store = new Store(dataDir);
  const app = registerHandlers(gladys, {
    store,
    fetch: api.fetch,
    sleep: async () => {},
    timers,
    now: clock.now,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.monitor.running;
  }
  return { gladys, fake: gladys.fake, app, monitor: app.monitor, api, clock, store, dataDir };
}

/** Create every discovered device in Gladys, as the user would. */
export async function createAll(world) {
  for (const device of world.fake.discoveredDevices) {
    await world.fake.deviceCreated(device);
  }
  return world.fake.discoveredDevices;
}

/** Run one refresh cycle, `minutes` later. */
export async function cycle(world, minutes = 120) {
  world.clock.advance(minutes * 60 * 1000);
  await world.monitor.runCycle();
}

/**
 * Capture the integration's log lines at `level` and above (LOG_LEVEL is read
 * at every call). Returns the lines as `{ level, text }`.
 */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
