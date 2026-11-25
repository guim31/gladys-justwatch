# JustWatch for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) integration that tells you what just arrived on your streaming
platforms (Netflix, Prime Video, Disney+, Canal+…), from [JustWatch](https://www.justwatch.com):

- **one device per list of platforms** (up to three): titles arrived today, in the last 7 days, latest arrival;
- **watched titles**: "tell me when _Severance_ reaches one of my platforms", with a device and a scene trigger;
- **scene trigger** "new title on my platforms", filtered by list and by kind (films, series);
- **scene action** "where to watch a title";
- **dashboard widget** with the latest arrivals and where your watched titles are.

Texts in English, French, German and Spanish. User documentation: [English](docs/en.md), [français](docs/fr.md),
[Deutsch](docs/de.md), [español](docs/es.md).

**Not affiliated with JustWatch.** The integration reads the GraphQL API of the JustWatch website
(`apis.justwatch.com/graphql`), without an account or a key. **It is not an official public API**: it may change or
close without notice. The integration stays a light visitor (one request at a time, a second apart, honest
User-Agent, cache, a reading every two hours by default).

## Requirements

- Gladys Assistant 5.1 or later.
- Internet access from Gladys.

## Installation

In Gladys, open **Integrations → Install from GitHub** and give the address of this repository:

```
https://github.com/guim31/gladys-justwatch
```

Then fill in the platforms of your first list (e.g. `Netflix, Prime Video, Disney+`), save, and create the devices
in the **Discover** tab. See the [documentation](docs/en.md) for the settings, the triggers and the examples.

## Limits

- Only subscription, free and ad-supported offers count, not rentals or purchases.
- Fourteen countries are offered (Europe and North America).
- Up to 500 new titles per day and per list are read; the order of a day is JustWatch's (popularity).
- Tested against the real JustWatch API (France and Germany, recorded answers in `test/fixtures/justwatch`) and the
  fake Gladys of the SDK; feedback from real Gladys installations is welcome.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests never touch the network: they replay the JustWatch answers recorded on 25/11/2026. See
[CLAUDE.md](CLAUDE.md) for the project rules.

## Credits

- Data: [JustWatch](https://www.justwatch.com).
- Cover: the JustWatch logo, from
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:JustWatch_Logo.svg) (public domain, trademark of
  JustWatch GmbH).
- Built on the official [integration template](https://github.com/GladysAssistant/integration-template-js) and
  [SDK](https://github.com/GladysAssistant/integration-sdk-js) of Gladys Assistant.

## License

[Apache-2.0](LICENSE).
