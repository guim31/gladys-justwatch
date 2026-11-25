// -----------------------------------------------------------------------------
// The Gladys devices:
//   - one per list of the configuration (platform id `list-<n>`, its slot:
//     the platforms of a list may change, the device stays):
//       new_today   counter-sensor/integer  titles that arrived today
//       new_week    counter-sensor/integer  titles that arrived in 7 days
//       last_title  text/text               "From, season 2 · Netflix"
//   - one for the watched titles (platform id `watchlist`), when there are any:
//       available       counter-sensor/integer  watched titles on my platforms
//       watched         counter-sensor/integer  watched titles followed
//       last_available  text/text               the latest one that became available
// Two counters on each device: a type alone on a device shows its generic
// label on the dashboard instead of the feature name.
//
// Published with should_poll: false: the refresh runs in the container.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
} from '@gladysassistant/integration-sdk';
import { MAX_WATCHED } from './config.js';
import { NAMES, clip } from './i18n.js';

export const LIST_TYPE = 'list';
export const WATCHLIST_TYPE = 'watchlist';
export const LIST_KEYS = ['new_today', 'new_week', 'last_title'];
export const WATCHLIST_KEYS = ['available', 'watched', 'last_available'];
export const MAX_COUNT = 10000;

/** External ids of the device of list `slot` ("1") and of its features. */
export function listIds(gladys, slot) {
  const ids = gladys.externalIds(LIST_TYPE, `list-${slot}`);
  return {
    device: ids.device,
    ...Object.fromEntries(LIST_KEYS.map((key) => [key, ids.feature(key)])),
  };
}

/** External ids of the watched titles device and of its features. */
export function watchlistIds(gladys) {
  const ids = gladys.externalIds(WATCHLIST_TYPE, 'watchlist');
  return {
    device: ids.device,
    ...Object.fromEntries(WATCHLIST_KEYS.map((key) => [key, ids.feature(key)])),
  };
}

const feature = (name, externalId, category, type, extra) => ({
  name,
  external_id: externalId,
  category,
  type,
  read_only: true,
  has_feedback: false,
  ...extra,
});

const counter = (name, externalId, max) =>
  feature(name, externalId, DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR, TYPES.SENSOR.INTEGER, {
    keep_history: true,
    min: 0,
    max,
  });

const text = (name, externalId) =>
  feature(name, externalId, DEVICE_FEATURE_CATEGORIES.TEXT, TYPES.TEXT.TEXT, {
    keep_history: false,
    min: 0,
    max: 0,
  });

/** The discovery payload of a list: `{ slot, platforms: ['Netflix', ...] }`. */
export function buildListDevice(gladys, list, language = 'fr') {
  const ids = listIds(gladys, list.slot);
  const names = NAMES[language] ?? NAMES.fr;
  return {
    name: clip(`JustWatch ${list.platforms.join(' + ')}`, 60),
    external_id: ids.device,
    model: 'JustWatch',
    should_poll: false,
    params: [{ name: 'list', value: list.slot }],
    features: [
      counter(names.new_today, ids.new_today, MAX_COUNT),
      counter(names.new_week, ids.new_week, MAX_COUNT),
      text(names.last_title, ids.last_title),
    ],
  };
}

/** The discovery payload of the watched titles device. */
export function buildWatchlistDevice(gladys, language = 'fr') {
  const ids = watchlistIds(gladys);
  const names = NAMES[language] ?? NAMES.fr;
  return {
    name: names.watchlist_device,
    external_id: ids.device,
    model: 'JustWatch',
    should_poll: false,
    params: [],
    features: [
      counter(names.available, ids.available, MAX_WATCHED),
      counter(names.watched, ids.watched, MAX_WATCHED),
      text(names.last_available, ids.last_available),
    ],
  };
}
