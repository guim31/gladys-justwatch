# JustWatch

Know what just arrived on your streaming platforms (Netflix, Prime Video, Disney+, Canal+, Max…) from
[JustWatch](https://www.justwatch.com), in Gladys Assistant: the films and series added today and over the week,
the latest arrival, a scene trigger at every new title, and an alert when a title you are waiting for reaches one of
your platforms.

Not affiliated with JustWatch. The integration reads JustWatch without an account, through the API of its website.

## What you get

- **One device per list of platforms** (up to three lists, e.g. "the family subscriptions" and "the free
  channels"), each with:
  - **New titles today**: films and seasons that arrived today on the platforms of the list;
  - **New titles in 7 days**: the same over the last seven days, today included;
  - **Latest arrival**: "From, season 2 · Netflix".
- **A device for the watched titles**, when you watch some: how many are available on your platforms, how many
  are watched, and the latest one that became available.
- **Two scene triggers**: "new title on my platforms" and "watched title available".
- **A scene action** "where to watch a title", for a scene or a voice question.
- **A dashboard widget** "JustWatch new titles": the latest arrivals, and where your watched titles are.

## Requirements

- Gladys Assistant 5.1 or later (5.2 or later for the links of the widget cards).
- Internet access from Gladys (the integration calls `apis.justwatch.com`).
- No JustWatch account, no key: only the names of your platforms.

## Configuration

### Settings

| Setting                     | Description                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Country**                 | The catalog of this country (France by default): platforms and titles differ from one to another.     |
| **List 1, 2, 3: platforms** | Platform names separated by commas. An empty list is ignored.                                         |
| **List 1, 2, 3: titles**    | Films and series (default), films only or series only.                                                |
| **Watched titles**          | Films or series to watch for, separated by semicolons. Twenty at most.                                |
| **Refresh interval**        | 1 hour, 2 hours (default) or 6 hours.                                                                 |
| **Language of the texts**   | Titles as JustWatch gives them in this language, feature names (frozen at creation), scene sentences. |

Save, then open the **Discover** tab of the integration and create the devices you want.

### Platform names

Type the names as JustWatch writes them, in any case, with or without accents: `Netflix`, `Prime Video`,
`Disney+`, `Canal+`, `Apple TV`, `Arte`, `Crunchyroll`… A part of the name is enough when it is unambiguous
(`Prime` finds "Amazon Prime Video"). A name JustWatch does not know in the chosen country is shown in the status of
the integration and ignored; the rest of the list works.

Only **subscription, free and ad-supported** offers count. A title you can only rent or buy is not "on your
platforms", and a store such as "Apple TV Store" brings nothing.

### Watched titles

Separate the titles with semicolons: `Dune (1984); Severance; Love, Death & Robots`. JustWatch's first answer (the
most popular title) is kept; add the year in brackets to pick another version. A title JustWatch does not know is
shown in the status and searched again once a day. The watched titles are looked for on the platforms of **all**
your lists.

## Devices

The devices are published without polling by Gladys: the integration reads JustWatch itself at the chosen
interval, and publishes only what changed (plus a reminder every 12 hours).

- The name of a list device is made of its platforms ("JustWatch Netflix + Amazon Prime Video"); rename it in Gladys
  as you like. The device is tied to the number of the list, not to its platforms: changing the platforms of list 1
  keeps the same device and its history.
- "Today" is the calendar day in the time zone of Gladys. A title that arrives on two platforms of the list counts
  once.

## Dashboard widget

Add the **JustWatch new titles** widget to a dashboard. Settings:

- **List**: one list, or empty for all of them;
- **Period**: today (default), 3 days or 7 days; each title shows a badge "Today", "Yesterday" or "N days ago";
- **Show the watched titles**: the watched titles with their platforms, "Not on your platforms" or "Not found".

The widget shows eight titles at most, the most popular first (JustWatch's order). Tap a title to open its page on
JustWatch.

## Scene triggers

**JustWatch: new title on my platforms** fires for each film or season that arrives on a list. Filters: the list
(empty: any) and the kind (films, series). Variables: `title`, `year`, `season` (0 for a film), `platforms`, `url`
and `summary`, a ready-made sentence: "New on Netflix: From, season 2.".

The first reading of a list fires nothing (what is listed then is not news), and neither does a restart. A list whose
platforms change starts over quietly. Twenty events at most per reading; the rest follows at the next one. On a list
of several big platforms, dozens of titles arrive some days: use the filters, or prefer the widget.

**JustWatch: watched title available** fires when a watched title is on a platform of your lists where it was not at
the previous reading. A title you add while it is already available fires once, at once. Variables: `title`,
`year`, `platforms`, `url`, `summary` ("Severance (2022) is available on Canal+.").

## Scene action

**JustWatch: where to watch a title** searches a title live and returns `found` (1 or 0), `title`, `year`,
`available` (1 when it is on a platform of your lists), `platforms` and `url`. Add the year in brackets to pick a
version: `Dune (1984)`.

## Scene examples

- **Friday evening suggestion**: trigger "new title on my platforms", kind "films", list "family"; action "send a
  message" with `summary`.
- **The awaited series**: trigger "watched title available"; action "send a message": "{{summary}} {{url}}".
- **Voice question**: a scene with "where to watch a title", then a condition on `available` and a message with
  `platforms`.

## Data source, terms and quotas

- The data come from **JustWatch**, through the GraphQL API its website uses (`apis.justwatch.com/graphql`). It is
  **not an official public API**: JustWatch may change or close it without notice, and the integration would then
  stop reading until an update. Please use it reasonably, for your household.
- The integration stays a light visitor: one request at a time, a second apart, an honest User-Agent, and a cache.
  At each reading: two to four requests per list (today and yesterday), one for all the watched titles; the five
  older days are read once a day, the platforms of the country once a day, each watched title is searched once.
- Titles, years and links belong to JustWatch and its sources. Nothing is sent to JustWatch beyond the country, the
  language, the platforms and the titles searched.

## Troubleshooting

- **No device in Discover**: no list has a platform JustWatch knows in the chosen country. Read the status of the
  integration: it lists the unknown names.
- **"JustWatch cannot be reached"**: no internet access from Gladys, or JustWatch changed its API. The values stay
  as they were; the integration tries again at each reading. Set `LOG_LEVEL=debug` on the container to see each
  request.
- **A watched title is the wrong one**: add the year in brackets, `Dune (1984)`.
- **Too many new titles**: split your platforms in several lists, choose "films only" or "series only", filter the
  trigger.

## Limits

- Not an official API: it may change without notice.
- Rentals and purchases are not counted, nor the add-on channels of a platform (Prime Video Channels…).
- Five pages of 100 titles per day at most; beyond (a very large selection), the rest of the day is ignored.
- The order of the titles of a day is JustWatch's (popularity), not the time they arrived.
- Fourteen countries are offered (Europe and North America).
