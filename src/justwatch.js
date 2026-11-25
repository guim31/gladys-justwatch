// -----------------------------------------------------------------------------
// JustWatch GraphQL client (https://apis.justwatch.com/graphql), the API the
// justwatch.com website itself uses. No key, no account, but NOT an official
// public API: it may change without notice. The client stays a light
// visitor: an honest User-Agent, one call at a time spaced by a second, one
// retry on HTTP 429, and the callers cache what does not move (platform list,
// past days, watched titles once found).
//
// Four operations:
//   - Packages:  the platforms of a country (id, name, short name);
//   - NewTitles: the titles that got a new offer on a given day, filtered by
//                platforms and by kind of offer (pages of 100);
//   - Search:    a title by its name, with its offers on the given platforms;
//   - Offers:    the offers of known titles (by JustWatch node id).
// Only subscription, free and ad-supported offers count: renting or buying a
// title is not "on my platforms".
// -----------------------------------------------------------------------------

export const API_URL = 'https://apis.justwatch.com/graphql';
export const SITE_URL = 'https://www.justwatch.com';
const REQUEST_TIMEOUT_MS = 20_000;
export const MIN_SPACING_MS = 1000;
const RETRY_429_MS = 15_000;
export const PAGE_SIZE = 100;
// A day of new titles on a handful of platforms holds a few dozen titles; five
// pages (500) cover a very large selection without hammering the API.
export const MAX_PAGES = 5;
const USER_AGENT = 'gladys-justwatch (+https://github.com/guim31/gladys-justwatch)';
export const MONETIZATION_TYPES = ['FLATRATE', 'FREE', 'ADS'];

export class JustWatchError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'JustWatchError';
    this.status = status;
  }
}

const PACKAGES = `query Packages($country: Country!) {
  packages(country: $country, platform: WEB, includeAddons: false) {
    packageId clearName shortName technicalName monetizationTypes
  }
}`;

const CONTENT =
  'content(country: $country, language: $language) { title fullPath originalReleaseYear }';
const MOVIE = `... on Movie { ${CONTENT} }`;
const SHOW = `... on Show { ${CONTENT} }`;
const SEASON = `... on Season {
  content(country: $country, language: $language) { title fullPath seasonNumber }
  show { id ${CONTENT} }
}`;

const NEW_TITLES = `query NewTitles($country: Country!, $language: Language!, $date: Date!, $filter: TitleFilter, $first: Int!, $after: String) {
  newTitles(country: $country, date: $date, filter: $filter, first: $first, after: $after, pageType: NEW, priceDrops: false) {
    totalCount
    pageInfo { hasNextPage endCursor }
    edges {
      newOffer(platform: WEB) { monetizationType package { packageId clearName shortName } }
      node { __typename id ${MOVIE} ${SEASON} }
    }
  }
}`;

const OFFERS = `offers(country: $country, platform: WEB, filter: { packages: $packages, monetizationTypes: [${MONETIZATION_TYPES.join(', ')}] }) {
  monetizationType package { packageId clearName shortName }
}`;

const SEARCH = `query Search($country: Country!, $language: Language!, $query: String!, $packages: [String!]) {
  popularTitles(country: $country, first: 5, filter: { searchQuery: $query, objectTypes: [MOVIE, SHOW] }) {
    edges { node { __typename id ${MOVIE} ${SHOW} ... on MovieOrShow { ${OFFERS} } } }
  }
}`;

const NODE_OFFERS = `query Offers($country: Country!, $language: Language!, $ids: [ID!]!, $packages: [String!]) {
  nodes(ids: $ids) { __typename id ${MOVIE} ${SHOW} ... on MovieOrShow { ${OFFERS} } }
}`;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A JustWatch node (Movie, Show or Season) as a flat title, or null. */
export function toTitle(node) {
  if (!node || typeof node.id !== 'string' || !node.content) {
    return null;
  }
  const isSeason = node.__typename === 'Season';
  if (isSeason && !node.show?.content) {
    return null;
  }
  const main = isSeason ? node.show.content : node.content;
  if (typeof main.title !== 'string' || main.title.trim() === '') {
    return null;
  }
  const path = node.content.fullPath ?? main.fullPath;
  return {
    id: node.id,
    kind: node.__typename === 'Movie' ? 'movie' : 'show',
    title: main.title.trim(),
    year: Number.isInteger(main.originalReleaseYear) ? main.originalReleaseYear : 0,
    season: isSeason && Number.isInteger(node.content.seasonNumber) ? node.content.seasonNumber : 0,
    url: typeof path === 'string' && path.startsWith('/') ? `${SITE_URL}${path}` : SITE_URL,
  };
}

/** The distinct platform names of a list of offers. */
export function platformsOf(offers) {
  const names = [];
  for (const offer of Array.isArray(offers) ? offers : []) {
    const name = offer?.package?.clearName;
    if (typeof name === 'string' && name && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

/**
 * @param {object} [options]
 * @param {Function} [options.fetch] the global fetch by default (tests inject one)
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {() => number} [options.now]
 */
export function createJustWatch({
  fetch = (...args) => globalThis.fetch(...args),
  sleep = defaultSleep,
  now = Date.now,
} = {}) {
  let last = -Infinity;
  // One call at a time: the spacing holds whoever asks (cycle, scene action).
  let queue = Promise.resolve();

  async function call(operationName, query, variables) {
    for (let attempt = 0; ; attempt += 1) {
      const wait = last + MIN_SPACING_MS - now();
      if (wait > 0) {
        await sleep(wait);
      }
      last = now();
      let response;
      try {
        response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'user-agent': USER_AGENT,
          },
          body: JSON.stringify({ operationName, query, variables }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        throw new JustWatchError(
          `JustWatch unreachable: ${err?.cause?.code ?? err?.message ?? err}`,
        );
      }
      if (response.status === 429 && attempt === 0) {
        await sleep(RETRY_429_MS);
        continue;
      }
      let body;
      try {
        body = await response.json();
      } catch {
        throw new JustWatchError(
          `JustWatch answered HTTP ${response.status}, not JSON`,
          response.status,
        );
      }
      if (response.status !== 200 || !body?.data) {
        const reason = body?.errors?.[0]?.message;
        throw new JustWatchError(
          `JustWatch answered HTTP ${response.status}${reason ? `: ${String(reason).slice(0, 120)}` : ''}`,
          response.status,
        );
      }
      return body.data;
    }
  }

  function run(operationName, query, variables) {
    const result = queue.then(
      () => call(operationName, query, variables),
      () => call(operationName, query, variables),
    );
    queue = result.catch(() => {});
    return result;
  }

  return {
    /** The platforms of a country: `[{ id, name, short, technical, kinds }]`. */
    async packages(country) {
      const data = await run('Packages', PACKAGES, { country });
      if (!Array.isArray(data.packages)) {
        throw new JustWatchError('JustWatch sent no platform list');
      }
      return data.packages
        .filter((item) => item && typeof item.shortName === 'string' && item.clearName)
        .map((item) => ({
          id: item.packageId,
          name: item.clearName,
          short: item.shortName,
          technical: item.technicalName ?? '',
          kinds: Array.isArray(item.monetizationTypes) ? item.monetizationTypes : [],
        }));
    },

    /**
     * The titles that got an offer on `day` ("2026-11-24") on the platforms
     * (short names): `{ titles: [{ ...title, platform }], truncated }`, one
     * entry per title (the first platform seen when it lands on several).
     */
    async newTitles({ country, language, day, packages }) {
      const titles = new Map();
      let after = null;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const data = await run('NewTitles', NEW_TITLES, {
          country,
          language,
          date: day,
          first: PAGE_SIZE,
          after,
          filter: { packages, monetizationTypes: MONETIZATION_TYPES },
        });
        const list = data.newTitles;
        if (!list || !Array.isArray(list.edges)) {
          throw new JustWatchError('JustWatch sent no list of new titles');
        }
        for (const edge of list.edges) {
          const title = toTitle(edge?.node);
          const platform = edge?.newOffer?.package?.clearName;
          if (!title || typeof platform !== 'string') {
            continue;
          }
          const known = titles.get(title.id);
          if (!known) {
            titles.set(title.id, { ...title, platforms: [platform] });
          } else if (!known.platforms.includes(platform)) {
            known.platforms.push(platform);
          }
        }
        if (!list.pageInfo?.hasNextPage || !list.pageInfo.endCursor) {
          return { titles: [...titles.values()], truncated: false };
        }
        after = list.pageInfo.endCursor;
      }
      return { titles: [...titles.values()], truncated: true };
    },

    /** The best match of a typed title, with its platforms among `packages`, or null. */
    async search({ country, language, query, year, packages }) {
      const data = await run('Search', SEARCH, { country, language, query, packages });
      const candidates = (data.popularTitles?.edges ?? [])
        .map((edge) => {
          const title = toTitle(edge?.node);
          return title && { ...title, platforms: platformsOf(edge.node.offers) };
        })
        .filter(Boolean);
      // JustWatch ranks by popularity: its first answer is the title meant,
      // unless a year was typed ("Dune (1984)").
      return candidates.find((title) => !year || title.year === year) ?? null;
    },

    /** The platforms among `packages` of known titles: `Map(id → { ...title, platforms })`. */
    async offers({ country, language, ids, packages }) {
      const data = await run('Offers', NODE_OFFERS, { country, language, ids, packages });
      if (!Array.isArray(data.nodes)) {
        throw new JustWatchError('JustWatch sent no titles');
      }
      const found = new Map();
      for (const node of data.nodes) {
        const title = toTitle(node);
        if (title) {
          found.set(title.id, { ...title, platforms: platformsOf(node.offers) });
        }
      }
      return found;
    },
  };
}

/** Lower case, no accent, letters and digits only; "+" reads "plus" (Disney+, Canal+). */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/&/g, 'and')
    .replace(/[^\p{L}\p{N}]/gu, '');
}
