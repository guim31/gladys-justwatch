// -----------------------------------------------------------------------------
// The monitor: every `refresh_interval` minutes, reads on JustWatch the new
// titles of each list (today and the six days before) and where the watched
// titles can be seen, publishes the devices and their states, fires the scene
// triggers and serves the widget.
//
// Calls per cycle: today and yesterday for each list (yesterday can still
// fill up after midnight), the five older days once a day; the platform list
// of the country once a day; each watched title is searched once, then one
// call reads the offers of all of them.
//
// Trigger `new_title`: a title of today or yesterday not seen before on that
// list. The first reading of a list (or of a list whose platforms changed)
// fires nothing: what is listed then is not news. The titles seen are kept
// under /data, so a restart fires nothing again.
//
// Trigger `title_available`: a watched title found on a platform of the lists
// where it was not at the previous reading. A title added to the watched list
// while already available fires once: "tell me when I can watch it" is
// answered at once. Its platforms are kept under /data.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import {
  buildListDevice,
  buildWatchlistDevice,
  listIds,
  watchlistIds,
  WATCHLIST_KEYS,
  LIST_KEYS,
} from './device.js';
import {
  STATUS,
  dayBefore,
  describe,
  describeAvailable,
  join,
  listOf,
  localDay,
  phrases,
  render,
  titleOf,
} from './i18n.js';
import { parseWatched } from './config.js';
import { createJustWatch, fold } from './justwatch.js';

const logger = createLogger({ name: 'justwatch' });

export const WIDGET_KEY = 'new_titles';
export const TRIGGERS = { NEW_TITLE: 'new_title', AVAILABLE: 'title_available' };
export const WEEK_DAYS = 7;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const DEFAULT_TIMINGS = {
  heartbeatMs: 12 * HOUR,
  // The platform list of a country and the past days are read again after this.
  cacheMs: DAY,
  // A watched title not found is searched again after this.
  retryNotFoundMs: DAY,
  // A title out of the lists for this long is forgotten.
  forgetAfterMs: 10 * DAY,
  // requestWidgetRefresh is rate-limited to one call every 10 s by the core.
  widgetRefreshMs: 10000,
};

// Scene events fired by one cycle at most: the rest follows at the next one.
export const MAX_EVENTS_PER_CYCLE = 20;

const KIND_FILTER = {
  all: () => true,
  movies: (t) => t.kind === 'movie',
  shows: (t) => t.kind === 'show',
};

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK fake)
   * @param {object} options.store see src/store.js
   * @param {object} [options.client] JustWatch client (src/justwatch.js)
   * @param {Function} [options.fetch] fetch, for the default client
   * @param {boolean} [options.timers] false: no background timer (tests drive the cycles)
   * @param {Function} [options.now] clock in ms
   * @param {object} [options.timings] overrides of DEFAULT_TIMINGS
   */
  constructor({ gladys, store, client, fetch, sleep, timers = true, now, timings }) {
    this.gladys = gladys;
    this.store = store;
    this.now = now ?? (() => Date.now());
    this.client = client ?? createJustWatch({ fetch, sleep, now: this.now });
    this.timers = timers;
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.config = null;
    this.data = emptyData();
    // { country, list, at } of the last platform list read.
    this.packages = null;
    // `${country}|${shorts}|${day}` → { titles, at }
    this.days = new Map();
    // slot → { list, platforms, unknown, signature, byDay: [{ day, titles }] }
    this.lists = new Map();
    this.lastSuccessAt = null;
    this.lastCycleAt = -Infinity;
    this.statusMessage = undefined;
    this.discovered = null;
    this.cycleTimer = null;
    this.running = null;
    this.lastRefreshAt = -Infinity;
    this.refreshTimer = null;
    this.signature = null;
    this.stopped = false;
    // Keys of the failures already logged, so a repeated one is not logged again.
    this.failing = new Set();
  }

  /** Log a failure once (warn or error), then at debug until `recovered(key)`. */
  failed(key, level, message, err) {
    const details = err ? [message, err] : [message];
    if (this.failing.has(key)) {
      logger.debug(...details);
      return;
    }
    this.failing.add(key);
    logger[level](...details);
  }

  /** One line when a failure logged by `failed(key)` is over. */
  recovered(key, message) {
    if (this.failing.delete(key)) {
      logger.info(message);
    }
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    this.config = config;
    const saved = await this.store.load();
    if (saved?.version === 1 && saved.lists && saved.watched) {
      this.data = { ...emptyData(), ...saved };
    }
    this.warnAboutConfig();
    await this.publishDiscovered();
    logger.info(
      `Started: ${config.lists.length} list(s) and ${config.watched.length} watched title(s) in ${config.country}, read every ${config.refreshMinutes} min`,
    );
    this.schedule();
    this.runCycle();
  }

  /** Reconnection: Gladys may have restarted, publish everything again. */
  async resync(config) {
    this.config = config;
    await this.publishDiscovered(true);
    this.statusMessage = undefined;
    await this.updateConnectionStatus();
    this.gladys.forgetPublishedStates?.();
    await this.publishStates();
    this.requestRefresh();
  }

  async reconfigure(config) {
    // A cycle already running finishes with the old configuration.
    await this.running;
    const languageChanged = config.language !== this.config?.language;
    this.config = config;
    logger.info('Configuration saved');
    this.warnAboutConfig();
    await this.publishDiscovered(languageChanged);
    this.schedule();
    await this.runCycle();
    this.requestRefresh();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.cycleTimer);
    clearTimeout(this.refreshTimer);
    this.cycleTimer = null;
    await this.running?.catch(() => {});
    await this.store.flush();
  }

  schedule() {
    if (!this.timers || this.stopped) {
      return;
    }
    clearInterval(this.cycleTimer);
    this.cycleTimer = setInterval(() => this.runCycle(), this.config.refreshMinutes * MINUTE);
    this.cycleTimer.unref?.();
  }

  warnAboutConfig() {
    const { lists, droppedWatched } = this.config;
    if (droppedWatched.length > 0) {
      logger.warn(`Twenty watched titles at most, ignored: ${droppedWatched.join(', ')}`);
    }
    if (lists.length === 0) {
      logger.warn('No platform set');
    }
  }

  // --- Devices -----------------------------------------------------------------

  /** The lists shown in Discover: those with at least one platform JustWatch knows. */
  activeLists() {
    return [...this.lists.values()].filter((entry) => entry.platforms.length > 0);
  }

  /** The short names of every platform of the lists, for the watched titles. */
  allPlatforms() {
    return [...new Set(this.activeLists().flatMap((entry) => entry.platforms.map((p) => p.short)))];
  }

  /** Publish the discovered devices when they changed (or when `force`). */
  async publishDiscovered(force = false) {
    const devices = this.activeLists().map((entry) =>
      buildListDevice(
        this.gladys,
        { slot: entry.list.slot, platforms: entry.platforms.map((p) => p.name) },
        this.config.language,
      ),
    );
    if (this.config.watched.length > 0 && this.activeLists().length > 0) {
      devices.push(buildWatchlistDevice(this.gladys, this.config.language));
    }
    const signature = JSON.stringify(devices);
    if (!force && signature === this.discovered) {
      return;
    }
    this.discovered = signature;
    await this.gladys.publishDiscoveredDevices(devices);
  }

  isCreated(externalId) {
    return (this.gladys.devices ?? []).some((device) => device.external_id === externalId);
  }

  /** The name given in Gladys to a device, else `fallback`. */
  nameOf(externalId, fallback) {
    const device = (this.gladys.devices ?? []).find((item) => item.external_id === externalId);
    return device?.name || fallback;
  }

  // --- Cycles ------------------------------------------------------------------

  runCycle() {
    if (this.running || this.stopped) {
      return this.running;
    }
    this.running = this.cycle()
      .catch((err) => this.failed('cycle', 'error', 'Refresh cycle failed', err))
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }

  async cycle() {
    this.lastCycleAt = this.now();
    let reached = 0;
    let unreachable = 0;
    const attempt = async (fn) => {
      try {
        await fn();
        reached += 1;
      } catch (err) {
        unreachable += 1;
        this.failed('api', 'warn', `JustWatch unreachable: ${err.message}`);
        logger.debug(err.message);
      }
    };

    this.checkCountry();
    await attempt(() => this.readPackages());
    this.resolveLists();
    const events = [];
    if (this.packages) {
      for (const entry of this.activeLists()) {
        await attempt(async () => {
          await this.readList(entry);
          events.push(...this.detectNew(entry));
        });
      }
      if (this.config.watched.length > 0 && this.allPlatforms().length > 0) {
        await attempt(async () => events.push(...(await this.readWatched())));
      }
    }
    if (unreachable === 0 && reached > 0) {
      this.recovered('api', 'JustWatch answers again');
      this.lastSuccessAt = this.now();
    } else if (reached > 0) {
      this.lastSuccessAt = this.now();
    }
    this.forgetRemoved();
    await this.fireAll(events);
    this.store.save(this.data);
    await this.publishDiscovered();
    await this.publishStates();
    await this.updateConnectionStatus();
    this.recovered('cycle', 'Refresh cycles work again');
    const signature = JSON.stringify([
      [...this.lists.values()].map((entry) => entry.byDay?.map((d) => d.titles.length)),
      this.data.watched,
    ]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.requestRefresh();
    }
  }

  /** The platform list of the country, read once a day. */
  async readPackages() {
    const { country } = this.config;
    if (
      this.packages?.country === country &&
      this.now() - this.packages.at < this.timings.cacheMs
    ) {
      return;
    }
    const list = await this.client.packages(country);
    if (list.length === 0) {
      throw new Error(`no platform listed in ${country}`);
    }
    this.packages = { country, list, at: this.now() };
  }

  /** Match the typed platform names against those of the country. */
  resolveLists() {
    const known = this.packages?.country === this.config.country ? this.packages.list : [];
    const lists = new Map();
    for (const list of this.config.lists) {
      const platforms = [];
      const unknown = [];
      for (const typed of list.platforms) {
        const match = matchPlatform(known, typed);
        if (match) {
          if (!platforms.some((p) => p.short === match.short)) {
            platforms.push({ short: match.short, name: match.name });
          }
        } else if (known.length > 0) {
          unknown.push(typed);
        }
      }
      const shorts = platforms.map((p) => p.short).sort();
      const signature = `${this.config.country}|${list.kind}|${shorts.join(',')}`;
      const previous = this.lists.get(list.slot);
      lists.set(list.slot, {
        list,
        platforms,
        unknown,
        signature,
        byDay: previous?.signature === signature ? previous.byDay : null,
      });
    }
    const unknown = [...lists.values()].flatMap((entry) => entry.unknown);
    const key = unknown.join(', ');
    if (key && key !== this.unknownKey) {
      logger.warn(`Platform unknown to JustWatch in ${this.config.country}: ${key}`);
    }
    this.unknownKey = key;
    this.lists = lists;
  }

  /** The new titles of the seven days of a list. */
  async readList(entry) {
    const { country, language } = this.config;
    const shorts = entry.platforms.map((p) => p.short).sort();
    const today = localDay(this.now());
    const byDay = [];
    for (let back = 0; back < WEEK_DAYS; back += 1) {
      const day = dayBefore(today, back);
      const key = `${country}|${language}|${shorts.join(',')}|${day}`;
      const cached = this.days.get(key);
      // Today and yesterday change; the older days are read once a day.
      if (!cached || back < 2 || this.now() - cached.at >= this.timings.cacheMs) {
        const result = await this.client.newTitles({ country, language, day, packages: shorts });
        if (result.truncated) {
          logger.debug(`${day}: more than ${result.titles.length} new titles, the rest ignored`);
        }
        this.days.set(key, { titles: result.titles, at: this.now() });
      }
      byDay.push({ day, titles: this.days.get(key).titles.filter(KIND_FILTER[entry.list.kind]) });
    }
    // Days out of the week are dropped from the cache.
    const oldest = dayBefore(today, WEEK_DAYS - 1);
    for (const key of this.days.keys()) {
      if (key.slice(-10) < oldest) {
        this.days.delete(key);
      }
    }
    entry.byDay = byDay;
    logger.debug(
      `List ${entry.list.slot}: ${byDay[0].titles.length} new title(s) today, ${this.weekCount(entry)} in 7 days`,
    );
  }

  weekCount(entry) {
    return new Set((entry.byDay ?? []).flatMap((d) => d.titles.map((t) => t.id))).size;
  }

  /** The titles of today and yesterday not seen before on a list. */
  detectNew(entry) {
    const now = this.now();
    const slot = entry.list.slot;
    let saved = this.data.lists[slot];
    if (!saved || saved.signature !== entry.signature) {
      saved = { signature: entry.signature, seen: {}, last: saved?.last ?? null };
      this.data.lists[slot] = saved;
      saved.seeding = true;
    }
    const fresh = [];
    const recent = [...entry.byDay[1].titles]
      .reverse()
      .concat([...entry.byDay[0].titles].reverse());
    for (const title of recent) {
      if (saved.seen[title.id]) {
        // Still listed: kept.
        saved.seen[title.id] = now;
      } else if (saved.seeding) {
        saved.seen[title.id] = now;
      } else {
        fresh.push({
          key: TRIGGERS.NEW_TITLE,
          title,
          entry,
          mark: () => {
            saved.seen[title.id] = now;
            saved.last = title;
          },
        });
      }
    }
    if (saved.seeding) {
      delete saved.seeding;
      saved.last = entry.byDay.find((d) => d.titles.length > 0)?.titles[0] ?? saved.last;
      logger.debug(`List ${slot}: ${recent.length} title(s) taken as known`);
    }
    for (const [id, seenAt] of Object.entries(saved.seen)) {
      if (now - seenAt > this.timings.forgetAfterMs) {
        delete saved.seen[id];
      }
    }
    return fresh;
  }

  /** Search the new watched titles, then read where all of them are. */
  async readWatched() {
    const { country, language } = this.config;
    const packages = this.allPlatforms();
    const now = this.now();
    for (const watched of this.config.watched) {
      const saved = this.data.watched[watched.text];
      if (
        saved?.id ||
        (saved?.notFoundAt && now - saved.notFoundAt < this.timings.retryNotFoundMs)
      ) {
        continue;
      }
      const found = await this.client.search({
        country,
        language,
        query: watched.query,
        year: watched.year,
        packages,
      });
      if (found) {
        this.data.watched[watched.text] = { id: found.id, title: found, platforms: null };
      } else {
        this.data.watched[watched.text] = { id: null, notFoundAt: now };
        logger.warn(`Title not found on JustWatch: ${watched.text}`);
      }
    }
    const ids = this.config.watched
      .map((watched) => this.data.watched[watched.text]?.id)
      .filter(Boolean);
    if (ids.length === 0) {
      return [];
    }
    const offers = await this.client.offers({ country, language, ids, packages });
    const events = [];
    for (const watched of this.config.watched) {
      const saved = this.data.watched[watched.text];
      const current = saved?.id && offers.get(saved.id);
      if (!current) {
        continue;
      }
      const before = saved.platforms ?? [];
      const added = current.platforms.filter((name) => !before.includes(name));
      saved.title = current;
      saved.platforms = current.platforms;
      if (added.length > 0) {
        events.push({
          key: TRIGGERS.AVAILABLE,
          title: { ...current, platforms: current.platforms },
          mark: () => {
            this.data.lastAvailable = { ...current, at: now };
          },
        });
      }
    }
    return events;
  }

  /** Forget what belongs to lists and titles no longer configured. */
  forgetRemoved() {
    const slots = this.config.lists.map((list) => list.slot);
    for (const slot of Object.keys(this.data.lists)) {
      if (!slots.includes(slot)) {
        delete this.data.lists[slot];
      }
    }
    const texts = this.config.watched.map((watched) => watched.text);
    for (const text of Object.keys(this.data.watched)) {
      if (!texts.includes(text)) {
        delete this.data.watched[text];
      }
    }
  }

  /** A country change: the platforms found in the previous one mean nothing here. */
  checkCountry() {
    if (this.data.country === this.config.country) {
      return;
    }
    this.data.country = this.config.country;
    for (const saved of Object.values(this.data.watched)) {
      saved.platforms = null;
      if (!saved.id) {
        delete saved.notFoundAt;
      }
    }
  }

  /** Fire the scene events; one is marked done only once Gladys accepted it. */
  async fireAll(events) {
    for (const [index, event] of events.entries()) {
      if (index >= MAX_EVENTS_PER_CYCLE) {
        logger.debug(`${events.length - index} more event(s) left for the next cycle`);
        // A watched title not announced is announced at the next cycle.
        for (const rest of events.slice(index)) {
          if (rest.key === TRIGGERS.AVAILABLE) {
            this.unannounce(rest.title.id);
          }
        }
        break;
      }
      logger.debug(`Scene event ${event.key}: ${event.title.id}`);
      try {
        await this.gladys.publishSceneEvent(event.key, this.eventData(event));
        this.recovered('scene', 'Scene triggers work again');
        event.mark();
      } catch (err) {
        if (event.key === TRIGGERS.AVAILABLE) {
          this.unannounce(event.title.id);
        }
        this.failed('scene', 'warn', `Firing the scene trigger failed: ${err.message}`);
      }
    }
  }

  /** Forget the platforms of a watched title, so its availability fires again. */
  unannounce(id) {
    for (const saved of Object.values(this.data.watched)) {
      if (saved.id === id) {
        saved.platforms = null;
      }
    }
  }

  /** The flat data of a scene event (fields, then variables of the manifest). */
  eventData(event) {
    const { title } = event;
    const { language } = this.config;
    const name = titleOf(title, language);
    if (event.key === TRIGGERS.AVAILABLE) {
      return {
        title: title.title,
        year: title.year,
        platforms: listOf(title.platforms),
        url: title.url,
        summary: phrases(language).available(name, listOf(title.platforms)),
      };
    }
    return {
      device: listIds(this.gladys, event.entry.list.slot).device,
      kind: title.kind,
      title: title.title,
      year: title.year,
      season: title.season,
      platforms: listOf(title.platforms),
      url: title.url,
      summary: phrases(language).arrived(listOf(title.platforms), name),
    };
  }

  // --- States ------------------------------------------------------------------

  statesOf(entry) {
    if (!entry.byDay) {
      return [];
    }
    const ids = listIds(this.gladys, entry.list.slot);
    const last = this.data.lists[entry.list.slot]?.last ?? null;
    return [
      { device_feature_external_id: ids.new_today, state: entry.byDay[0].titles.length },
      { device_feature_external_id: ids.new_week, state: this.weekCount(entry) },
      { device_feature_external_id: ids.last_title, text: describe(last, this.config.language) },
    ];
  }

  watchlistStates() {
    const ids = watchlistIds(this.gladys);
    const watched = this.config.watched.map((w) => this.data.watched[w.text]);
    if (watched.some((saved) => saved?.id && saved.platforms === null)) {
      // Not read yet: nothing rather than a wrong zero.
      return [];
    }
    return [
      {
        device_feature_external_id: ids.available,
        state: watched.filter((saved) => saved?.platforms?.length > 0).length,
      },
      { device_feature_external_id: ids.watched, state: this.config.watched.length },
      {
        device_feature_external_id: ids.last_available,
        text: describeAvailable(this.data.lastAvailable, this.config.language),
      },
    ];
  }

  async publishStates() {
    const states = this.activeLists()
      .filter((entry) => this.isCreated(listIds(this.gladys, entry.list.slot).device))
      .flatMap((entry) => this.statesOf(entry));
    if (
      this.config.watched.length > 0 &&
      this.isCreated(watchlistIds(this.gladys).device) &&
      this.packages
    ) {
      states.push(...this.watchlistStates());
    }
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.recovered('publish', 'Publishing the states works again');
    } catch (err) {
      // Sent again at the next cycle (the SDK forgets what Gladys refused).
      this.failed('publish', 'warn', `Publishing the states failed: ${err.message}`);
    }
  }

  async updateConnectionStatus() {
    const parts = [];
    if (this.failing.has('api')) {
      parts.push(render(STATUS, 'apiDown'));
    }
    if (this.config.lists.length === 0) {
      parts.push(render(STATUS, 'noList'));
    }
    if (this.unknownKey) {
      parts.push(render(STATUS, 'unknownPlatforms', { values: this.unknownKey }));
    }
    const notFound = this.config.watched
      .filter((watched) => this.data.watched[watched.text]?.notFoundAt)
      .map((watched) => watched.text);
    if (notFound.length > 0) {
      parts.push(render(STATUS, 'notFound', { values: notFound.join(', ') }));
    }
    if (this.config.droppedWatched.length > 0) {
      parts.push(render(STATUS, 'dropped', { values: this.config.droppedWatched.join(', ') }));
    }
    const message = parts.length > 0 ? join(...parts) : undefined;
    const connected = !this.failing.has('api') && this.lastSuccessAt !== null;
    const key = JSON.stringify([connected, message]);
    if (key === this.statusMessage) {
      return;
    }
    this.statusMessage = key;
    await this.gladys.setConnectionStatus(connected, message).catch(() => {});
  }

  // --- Gladys events -----------------------------------------------------------

  /** The list entry or 'watchlist' of a device external id. */
  targetOf(externalId) {
    if (externalId && externalId === watchlistIds(this.gladys).device) {
      return 'watchlist';
    }
    return this.activeLists().find(
      (entry) => listIds(this.gladys, entry.list.slot).device === externalId,
    );
  }

  async onDeviceCreated(device) {
    const target = this.targetOf(device?.external_id);
    if (!target) {
      return;
    }
    // Every state of the new device is published again, even unchanged.
    const ids =
      target === 'watchlist' ? watchlistIds(this.gladys) : listIds(this.gladys, target.list.slot);
    for (const key of target === 'watchlist' ? WATCHLIST_KEYS : LIST_KEYS) {
      this.gladys.forgetPublishedStates?.(ids[key]);
    }
    await this.publishStates();
    this.requestRefresh();
  }

  /** onPoll fallback: should_poll is false, but a Gladys polling anyway gets an answer. */
  async poll(device) {
    if (!this.targetOf(device?.external_id)) {
      return;
    }
    // Read again only if the last cycle is older than half the interval.
    if (this.now() - this.lastCycleAt >= (this.config.refreshMinutes * MINUTE) / 2) {
      await this.runCycle();
    } else {
      await this.publishStates();
    }
  }

  // --- Widget and scene action ----------------------------------------------------

  /** The watched titles with where they are: `[{ text, title, platforms }]`. */
  watchedStatus() {
    return this.config.watched.map((watched) => {
      const saved = this.data.watched[watched.text];
      return {
        text: watched.text,
        title: saved?.title ?? null,
        found: Boolean(saved?.id),
        platforms: saved?.platforms ?? null,
      };
    });
  }

  /** The `where_to_watch` scene action: a live search on the platforms of the lists. */
  async whereToWatch(fields = {}) {
    const empty = { found: 0, title: '', year: 0, available: 0, platforms: '', url: '' };
    const text = String(fields.title ?? '').trim();
    if (!text) {
      return empty;
    }
    const { query, year } = parseWatched(text);
    const found = await this.client.search({
      country: this.config.country,
      language: this.config.language,
      query,
      year,
      packages: this.allPlatforms(),
    });
    logger.info(`Scene action where_to_watch: ${found ? found.id : 'not found'}`);
    if (!found) {
      return empty;
    }
    return {
      found: 1,
      title: found.title,
      year: found.year,
      available: found.platforms.length > 0 ? 1 : 0,
      platforms: listOf(found.platforms),
      url: found.url,
    };
  }

  requestRefresh() {
    if (this.stopped) {
      return;
    }
    const now = this.now();
    const wait = this.lastRefreshAt + this.timings.widgetRefreshMs - now;
    if (wait <= 0) {
      this.lastRefreshAt = now;
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    } else if (this.timers && !this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.requestRefresh();
      }, wait);
      this.refreshTimer.unref?.();
    }
  }
}

/**
 * The platform of a country a typed name means: same name, technical name or
 * short code, else the only one whose name contains it ("Prime" → "Amazon
 * Prime Video"), the shortest name winning ("Netflix" over "Netflix Kids").
 */
export function matchPlatform(packages, typed) {
  const wanted = fold(typed);
  if (!wanted) {
    return null;
  }
  const exact = packages.find(
    (p) => fold(p.name) === wanted || fold(p.technical) === wanted || p.short === typed.trim(),
  );
  if (exact) {
    return exact;
  }
  return (
    packages
      .filter((p) => fold(p.name).includes(wanted))
      .sort((a, b) => a.name.length - b.name.length)[0] ?? null
  );
}

function emptyData() {
  return { version: 1, country: null, lists: {}, watched: {}, lastAvailable: null };
}
