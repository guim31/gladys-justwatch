// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Countries offered (JustWatch catalogs differ by country). JustWatch covers
// many more: these are those of the Gladys community, Europe and America.
export const COUNTRIES = [
  'FR',
  'BE',
  'CH',
  'LU',
  'CA',
  'DE',
  'AT',
  'ES',
  'IT',
  'PT',
  'NL',
  'GB',
  'IE',
  'US',
];

// Minutes between two readings. New titles land once or twice a day: an hour
// at most keeps the integration a light visitor of an unofficial API.
export const REFRESH_INTERVALS = ['60', '120', '360'];

// The lists of the configuration: each one becomes a device. Their numbers
// are their device ids: never renumber them.
export const LIST_SLOTS = ['1', '2', '3'];
export const KINDS = ['all', 'movies', 'shows'];

// Watched titles at most: one search each the first time, then one call for all.
export const MAX_WATCHED = 20;

export const DEFAULT_CONFIG = {
  country: 'FR',
  list_1_platforms: '',
  list_1_kind: 'all',
  list_2_platforms: '',
  list_2_kind: 'all',
  list_3_platforms: '',
  list_3_kind: 'all',
  watched_titles: '',
  refresh_interval: '120',
  language: 'fr',
};

/**
 * Split a typed list: platforms on commas, semicolons and new lines; titles
 * (`titles: true`) on semicolons and new lines only, a title may hold a comma
 * ("Love, Death & Robots").
 */
export function splitList(text, { titles = false } = {}) {
  const value = String(text ?? '');
  const separator = titles ? /[;\n]+/ : /[,;\n]+/;
  const items = [];
  for (const item of value.split(separator)) {
    const clean = item.trim().replace(/\s+/g, ' ');
    if (clean && !items.some((known) => known.toLowerCase() === clean.toLowerCase())) {
      items.push(clean);
    }
  }
  return items;
}

/** "Dune (1984)" → { query: 'Dune', year: 1984 }; "Dune" → { query: 'Dune', year: 0 }. */
export function parseWatched(text) {
  const match = /^(.*\S)\s*\((\d{4})\)$/.exec(text);
  return match ? { text, query: match[1], year: Number(match[2]) } : { text, query: text, year: 0 };
}

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const country = String(source.country ?? '').toUpperCase();
  const refresh = String(source.refresh_interval ?? '');
  const watched = splitList(source.watched_titles, { titles: true });
  return {
    country: COUNTRIES.includes(country) ? country : DEFAULT_CONFIG.country,
    lists: LIST_SLOTS.map((slot) => {
      const kind = String(source[`list_${slot}_kind`] ?? '');
      return {
        slot,
        platforms: splitList(source[`list_${slot}_platforms`]),
        kind: KINDS.includes(kind) ? kind : 'all',
      };
    }).filter((list) => list.platforms.length > 0),
    watched: watched.slice(0, MAX_WATCHED).map(parseWatched),
    droppedWatched: watched.slice(MAX_WATCHED),
    refreshMinutes: Number(
      REFRESH_INTERVALS.includes(refresh) ? refresh : DEFAULT_CONFIG.refresh_interval,
    ),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
