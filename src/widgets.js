// -----------------------------------------------------------------------------
// Dashboard widget `new_titles`: the latest arrivals of one list or of all of
// them (card-list), then, optionally, where the watched titles can be seen
// (status). Pre-localized in the language of the viewer (the core caches per
// language).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { listIds } from './device.js';
import { clip, listOf, phrases } from './i18n.js';
import { WIDGET_KEY } from './monitor.js';

export const WIDGET_DAYS = ['1', '3', '7'];
const MAX_ITEMS = 8;
const MAX_ROWS = 10;

export const TEXT = {
  loading: {
    en: 'Reading JustWatch…',
    fr: 'Lecture de JustWatch…',
    de: 'JustWatch wird gelesen…',
    es: 'Leyendo JustWatch…',
  },
  noList: {
    en: 'No platform set.',
    fr: 'Aucune plateforme réglée.',
    de: 'Keine Plattform eingestellt.',
    es: 'Ninguna plataforma configurada.',
  },
  nothing: {
    en: 'Nothing new in this period.',
    fr: 'Rien de nouveau sur la période.',
    de: 'Nichts Neues in diesem Zeitraum.',
    es: 'Nada nuevo en este periodo.',
  },
  today: { en: 'Today', fr: 'Aujourd’hui', de: 'Heute', es: 'Hoy' },
  yesterday: { en: 'Yesterday', fr: 'Hier', de: 'Gestern', es: 'Ayer' },
  daysAgo: {
    en: '{n} days ago',
    fr: 'Il y a {n} jours',
    de: 'Vor {n} Tagen',
    es: 'Hace {n} días',
  },
  notAvailable: {
    en: 'Not on your platforms',
    fr: 'Pas sur vos plateformes',
    de: 'Nicht auf deinen Plattformen',
    es: 'No está en sus plataformas',
  },
  notFound: {
    en: 'Not found',
    fr: 'Introuvable',
    de: 'Nicht gefunden',
    es: 'No encontrado',
  },
  pending: { en: 'Being read', fr: 'En cours de lecture', de: 'Wird gelesen', es: 'Leyendo' },
};

const say = (key, language, n) =>
  (TEXT[key][language] ?? TEXT[key].en).replace('{n}', String(n ?? ''));

function badgeOf(back, language) {
  if (back === 0) {
    return { text: say('today', language), color: WIDGET_COLORS.SUCCESS };
  }
  return {
    text: back === 1 ? say('yesterday', language) : say('daysAgo', language, back),
    color: WIDGET_COLORS.NEUTRAL,
  };
}

/**
 * The widget content.
 * @param {import('./monitor.js').Monitor} monitor
 * @param {{ settings?: object, language?: string }} request
 */
export function newTitlesContent(monitor, { settings = {}, language = 'en' } = {}) {
  if (!monitor.config) {
    return {
      ttl_seconds: 30,
      components: [{ type: 'text', variant: 'caption', text: say('loading', language) }],
    };
  }
  const lists = monitor.activeLists();
  if (monitor.config.lists.length === 0) {
    return {
      ttl_seconds: 300,
      components: [{ type: 'text', variant: 'body', text: say('noList', language) }],
    };
  }
  // A device that is no list (the watched titles, a list removed): every list.
  const picked = lists.filter(
    (entry) => listIds(monitor.gladys, entry.list.slot).device === settings.device,
  );
  const chosen = picked.length > 0 ? picked : lists;
  if (!chosen.some((entry) => entry.byDay)) {
    return {
      ttl_seconds: 30,
      components: [{ type: 'text', variant: 'caption', text: say('loading', language) }],
    };
  }
  const days = Number(WIDGET_DAYS.includes(String(settings.days)) ? settings.days : '1');
  const seen = new Set();
  const items = [];
  for (let back = 0; back < days; back += 1) {
    for (const entry of chosen) {
      for (const title of entry.byDay?.[back]?.titles ?? []) {
        if (!seen.has(title.id)) {
          seen.add(title.id);
          items.push({ title, back });
        }
      }
    }
  }
  const p = phrases(language);
  const components = [];
  if (items.length === 0) {
    components.push({ type: 'text', variant: 'caption', text: say('nothing', language) });
  } else {
    components.push({
      type: 'card-list',
      display: 'list',
      items: items.slice(0, MAX_ITEMS).map(({ title, back }) => ({
        title: clip(title.season > 0 ? `${title.title} · S${title.season}` : title.title, 60),
        subtitle: clip(
          [title.kind === 'movie' ? p.movie : p.show, title.year || '', listOf(title.platforms)]
            .filter(Boolean)
            .join(' · '),
          60,
        ),
        badge: badgeOf(back, language),
        links: [{ url: title.url, label: 'JustWatch' }],
      })),
    });
  }

  if (settings.show_watched !== false && monitor.config.watched.length > 0) {
    components.push({
      type: 'status',
      items: monitor
        .watchedStatus()
        .slice(0, MAX_ROWS)
        .map((watched) => {
          const available = watched.platforms?.length > 0;
          let value;
          if (available) {
            value = listOf(watched.platforms);
          } else if (watched.platforms) {
            value = say('notAvailable', language);
          } else {
            value = say(
              watched.found || !monitor.data.watched[watched.text] ? 'pending' : 'notFound',
              language,
            );
          }
          return {
            label: clip(watched.title?.title ?? watched.text, 40),
            value: clip(value, 40),
            icon: available ? 'check-circle' : 'clock',
            color: available ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
          };
        }),
    });
  }
  return { ttl_seconds: 900, components };
}

export const WIDGETS = {
  [WIDGET_KEY]: { get: (monitor, request) => newTitlesContent(monitor, request) },
};
