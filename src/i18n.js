// -----------------------------------------------------------------------------
// Texts produced by the container, in the four languages of the Gladys
// interface: feature names, text states, scene summaries, connection status,
// widget. Titles and platform names stay as JustWatch gives them.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

// Feature names, frozen at creation in Gladys (language of the configuration).
export const NAMES = {
  en: {
    new_today: 'New titles today',
    new_week: 'New titles in 7 days',
    last_title: 'Latest arrival',
    available: 'Watched titles available',
    watched: 'Watched titles',
    last_available: 'Latest watched title available',
    watchlist_device: 'JustWatch watched titles',
  },
  fr: {
    new_today: 'Nouveautés du jour',
    new_week: 'Nouveautés sur 7 jours',
    last_title: 'Dernière arrivée',
    available: 'Titres surveillés disponibles',
    watched: 'Titres surveillés',
    last_available: 'Dernier titre surveillé disponible',
    watchlist_device: 'JustWatch titres surveillés',
  },
  de: {
    new_today: 'Neu heute',
    new_week: 'Neu in 7 Tagen',
    last_title: 'Neuester Titel',
    available: 'Verfügbare beobachtete Titel',
    watched: 'Beobachtete Titel',
    last_available: 'Zuletzt verfügbarer beobachteter Titel',
    watchlist_device: 'JustWatch beobachtete Titel',
  },
  es: {
    new_today: 'Novedades de hoy',
    new_week: 'Novedades en 7 días',
    last_title: 'Última llegada',
    available: 'Títulos vigilados disponibles',
    watched: 'Títulos vigilados',
    last_available: 'Último título vigilado disponible',
    watchlist_device: 'JustWatch títulos vigilados',
  },
};

export const PHRASES = {
  en: {
    season: (n) => `season ${n}`,
    none: 'Nothing new yet',
    noneAvailable: 'None available yet',
    arrived: (platform, title) => `New on ${platform}: ${title}.`,
    available: (title, platforms) => `${title} is available on ${platforms}.`,
    movie: 'Film',
    show: 'Series',
  },
  fr: {
    season: (n) => `saison ${n}`,
    none: 'Rien de nouveau pour l’instant',
    noneAvailable: 'Aucun disponible pour l’instant',
    arrived: (platform, title) => `Nouveau sur ${platform} : ${title}.`,
    available: (title, platforms) => `${title} est disponible sur ${platforms}.`,
    movie: 'Film',
    show: 'Série',
  },
  de: {
    season: (n) => `Staffel ${n}`,
    none: 'Noch nichts Neues',
    noneAvailable: 'Noch keiner verfügbar',
    arrived: (platform, title) => `Neu bei ${platform}: ${title}.`,
    available: (title, platforms) => `${title} ist bei ${platforms} verfügbar.`,
    movie: 'Film',
    show: 'Serie',
  },
  es: {
    season: (n) => `temporada ${n}`,
    none: 'Nada nuevo por ahora',
    noneAvailable: 'Ninguno disponible por ahora',
    arrived: (platform, title) => `Nuevo en ${platform}: ${title}.`,
    available: (title, platforms) => `${title} está disponible en ${platforms}.`,
    movie: 'Película',
    show: 'Serie',
  },
};

/** Messages of the connection status: always the four languages (core 5.2+). */
export const STATUS = {
  initFailed: {
    en: 'The integration could not start: see its logs.',
    fr: 'L’intégration n’a pas pu démarrer : voir ses journaux.',
    de: 'Die Integration konnte nicht starten: Sieh in ihre Protokolle.',
    es: 'La integración no pudo iniciarse: consulte sus registros.',
  },
  apiDown: {
    en: 'JustWatch cannot be reached.',
    fr: 'JustWatch est injoignable.',
    de: 'JustWatch ist nicht erreichbar.',
    es: 'No se puede acceder a JustWatch.',
  },
  noList: {
    en: 'No platform set: fill in a list in the configuration.',
    fr: 'Aucune plateforme : remplissez une liste dans la configuration.',
    de: 'Keine Plattform: Fülle eine Liste in der Konfiguration aus.',
    es: 'Ninguna plataforma: complete una lista en la configuración.',
  },
  unknownPlatforms: {
    en: 'Platform unknown to JustWatch in this country: {values}.',
    fr: 'Plateforme inconnue de JustWatch dans ce pays : {values}.',
    de: 'Plattform in diesem Land bei JustWatch unbekannt: {values}.',
    es: 'Plataforma desconocida para JustWatch en este país: {values}.',
  },
  notFound: {
    en: 'Title not found on JustWatch: {values}.',
    fr: 'Titre introuvable sur JustWatch : {values}.',
    de: 'Titel auf JustWatch nicht gefunden: {values}.',
    es: 'Título no encontrado en JustWatch: {values}.',
  },
  dropped: {
    en: 'Twenty watched titles at most, ignored: {values}.',
    fr: 'Vingt titres surveillés au plus, ignorés : {values}.',
    de: 'Höchstens zwanzig beobachtete Titel, ignoriert: {values}.',
    es: 'Veinte títulos vigilados como máximo, ignorados: {values}.',
  },
};

/** A message of STATUS in every language, `{name}` placeholders filled. */
export function render(messages, key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      messages[key][language].replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match),
    ]),
  );
}

/** Several messages of every language, one after the other. */
export function join(...messages) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [language, messages.map((m) => m[language]).join(' ')]),
  );
}

export const phrases = (language) => PHRASES[language] ?? PHRASES.en;

/** "From, season 2" or "Dune (1984)". */
export function titleOf(title, language) {
  if (title.season > 0) {
    return `${title.title}, ${phrases(language).season(title.season)}`;
  }
  return title.year ? `${title.title} (${title.year})` : title.title;
}

/** "a, b and c" without the "and": platform names joined by commas. */
export const listOf = (names) => names.join(', ');

/** The text state of the latest arrival: "From, season 2 · Netflix". */
export function describe(title, language) {
  if (!title) {
    return phrases(language).none;
  }
  return clip(`${titleOf(title, language)} · ${listOf(title.platforms)}`, 250);
}

/** The text state of the latest watched title available. */
export function describeAvailable(title, language) {
  if (!title) {
    return phrases(language).noneAvailable;
  }
  return clip(`${titleOf(title, language)} · ${listOf(title.platforms)}`, 250);
}

/** The calendar day of `ms` in the time zone of Gladys: "2026-11-14". */
export function localDay(ms) {
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The calendar day `days` before `day` ("2026-11-14", 1 → "2026-11-13"). */
export function dayBefore(day, days) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date - days)).toISOString().slice(0, 10);
}

/** Text cut to `max` characters, with an ellipsis. */
export function clip(text, max) {
  const value = String(text ?? '');
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}
