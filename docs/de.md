# JustWatch

Erfahre in Gladys Assistant, was gerade auf deinen Streaming-Plattformen (Netflix, Prime Video, Disney+, Canal+,
Max…) angekommen ist, dank [JustWatch](https://www.justwatch.com): die heute und in der Woche hinzugefügten Filme und
Serien, den neuesten Titel, einen Szenen-Auslöser bei jedem neuen Titel und einen Alarm, wenn ein Titel, auf den du
wartest, auf einer deiner Plattformen ankommt.

Nicht mit JustWatch verbunden. Die Integration liest JustWatch ohne Konto, über die API der Website.

## Was du bekommst

- **Ein Gerät pro Liste von Plattformen** (bis zu drei Listen, z. B. „die Abos der Familie“ und „die kostenlosen
  Sender“), jeweils mit:
  - **Neu heute**: Filme und Staffeln, die heute auf den Plattformen der Liste angekommen sind;
  - **Neu in 7 Tagen**: dasselbe über die letzten sieben Tage, heute eingeschlossen;
  - **Neuester Titel**: „From, Staffel 2 · Netflix“.
- **Ein Gerät für die beobachteten Titel**, wenn du welche beobachtest: wie viele auf deinen Plattformen verfügbar
  sind, wie viele beobachtet werden und welcher zuletzt verfügbar wurde.
- **Zwei Szenen-Auslöser**: „neuer Titel auf meinen Plattformen“ und „beobachteter Titel verfügbar“.
- **Eine Szenen-Aktion** „wo ein Titel läuft“, für eine Szene oder eine Sprachfrage.
- **Ein Dashboard-Widget** „Neu bei JustWatch“: die neuesten Titel und wo deine beobachteten Titel sind.

## Voraussetzungen

- Gladys Assistant 5.1 oder neuer (5.2 oder neuer für die Links der Widget-Karten).
- Internetzugang von Gladys aus (die Integration ruft `apis.justwatch.com` auf).
- Kein JustWatch-Konto, kein Schlüssel: nur die Namen deiner Plattformen.

## Konfiguration

### Einstellungen

| Einstellung                    | Beschreibung                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **Land**                       | Der Katalog dieses Landes (standardmäßig Frankreich): Plattformen und Titel unterscheiden sich.                             |
| **Liste 1, 2, 3: Plattformen** | Namen der Plattformen, durch Kommas getrennt. Eine leere Liste wird ignoriert.                                              |
| **Liste 1, 2, 3: Titel**       | Filme und Serien (Standard), nur Filme oder nur Serien.                                                                     |
| **Beobachtete Titel**          | Filme oder Serien, auf die du wartest, durch Semikolons getrennt. Höchstens zwanzig.                                        |
| **Aktualisierungsintervall**   | 1 Stunde, 2 Stunden (Standard) oder 6 Stunden.                                                                              |
| **Sprache der Texte**          | Titel, wie JustWatch sie in dieser Sprache liefert, Namen der Funktionen (bei der Erstellung festgelegt), Sätze der Szenen. |

Speichere, öffne dann den Tab **Entdecken** der Integration und lege die gewünschten Geräte an.

### Namen der Plattformen

Gib die Namen so ein, wie JustWatch sie schreibt, egal ob groß oder klein, mit oder ohne Akzente: `Netflix`,
`Prime Video`, `Disney+`, `Canal+`, `Apple TV`, `Arte`, `Crunchyroll`… Ein Teil des Namens reicht, wenn er eindeutig
ist (`Prime` findet „Amazon Prime Video“). Ein Name, den JustWatch im gewählten Land nicht kennt, wird im Status der
Integration angezeigt und ignoriert; der Rest der Liste funktioniert.

Es zählen nur **Abo-, kostenlose und werbefinanzierte** Angebote. Ein Titel, den man nur leihen oder kaufen kann,
ist nicht „auf deinen Plattformen“, und ein Shop wie „Apple TV Store“ bringt nichts.

### Beobachtete Titel

Trenne die Titel durch Semikolons: `Dune (1984); Severance; Love, Death & Robots`. Die erste Antwort von JustWatch
(der beliebteste Titel) wird genommen; füge das Jahr in Klammern hinzu, um eine andere Fassung zu wählen. Ein Titel,
den JustWatch nicht kennt, wird im Status angezeigt und einmal am Tag erneut gesucht. Die beobachteten Titel werden
auf den Plattformen **aller** deiner Listen gesucht.

## Geräte

Die Geräte werden ohne Abfrage durch Gladys veröffentlicht: Die Integration liest JustWatch selbst im gewählten
Intervall und veröffentlicht nur, was sich geändert hat (dazu eine Erinnerung alle 12 Stunden).

- Der Name eines Listengeräts besteht aus seinen Plattformen („JustWatch Netflix + Amazon Prime Video“); benenne es
  in Gladys nach Belieben um. Das Gerät hängt an der Nummer der Liste, nicht an ihren Plattformen: Wenn du die
  Plattformen von Liste 1 änderst, bleiben das Gerät und sein Verlauf erhalten.
- „Heute“ ist der Kalendertag in der Zeitzone von Gladys. Ein Titel, der auf zwei Plattformen der Liste ankommt,
  zählt einmal.

## Dashboard-Widget

Füge das Widget **Neu bei JustWatch** zu einem Dashboard hinzu. Einstellungen:

- **Liste**: eine Liste, oder leer für alle;
- **Zeitraum**: heute (Standard), 3 Tage oder 7 Tage; jeder Titel trägt ein Etikett „Heute“, „Gestern“ oder „Vor N
  Tagen“;
- **Beobachtete Titel anzeigen**: die beobachteten Titel mit ihren Plattformen, „Nicht auf deinen Plattformen“ oder
  „Nicht gefunden“.

Das Widget zeigt höchstens acht Titel, die beliebtesten zuerst (die Reihenfolge von JustWatch). Tippe auf einen
Titel, um seine Seite bei JustWatch zu öffnen.

## Szenen-Auslöser

**JustWatch: neuer Titel auf meinen Plattformen** löst bei jedem Film oder jeder Staffel aus, die auf einer Liste
ankommt. Filter: die Liste (leer: jede) und die Art (Filme, Serien). Variablen: `title`, `year`, `season` (0 bei
einem Film), `platforms`, `url` und `summary`, ein fertiger Satz: „Neu bei Netflix: From, Staffel 2.“.

Der erste Abruf einer Liste löst nichts aus (was dann gelistet ist, ist nicht neu), ein Neustart auch nicht. Eine
Liste, deren Plattformen sich ändern, beginnt still von vorn. Höchstens zwanzig Ereignisse pro Abruf; der Rest folgt
beim nächsten. Bei einer Liste mit mehreren großen Plattformen kommen an manchen Tagen Dutzende Titel: Nutze die
Filter oder lieber das Widget.

**JustWatch: beobachteter Titel verfügbar** löst aus, wenn ein beobachteter Titel auf einer Plattform deiner Listen
ist, auf der er beim vorherigen Abruf nicht war. Ein Titel, den du hinzufügst, während er schon verfügbar ist, löst
einmal sofort aus. Variablen: `title`, `year`, `platforms`, `url`, `summary` („Severance (2022) ist bei Canal+
verfügbar.“).

## Szenen-Aktion

**JustWatch: wo ein Titel läuft** sucht einen Titel live und liefert `found` (1 oder 0), `title`, `year`,
`available` (1, wenn er auf einer Plattform deiner Listen ist), `platforms` und `url`. Füge das Jahr in Klammern
hinzu, um eine Fassung zu wählen: `Dune (1984)`.

## Szenen-Beispiele

- **Vorschlag am Freitagabend**: Auslöser „neuer Titel auf meinen Plattformen“, Art „Filme“, Liste „Familie“; Aktion
  „Nachricht senden“ mit `summary`.
- **Die erwartete Serie**: Auslöser „beobachteter Titel verfügbar“; Aktion „Nachricht senden“: „{{summary}}
  {{url}}“.
- **Sprachfrage**: eine Szene mit „wo ein Titel läuft“, dann eine Bedingung auf `available` und eine Nachricht mit
  `platforms`.

## Datenquelle, Bedingungen und Kontingente

- Die Daten stammen von **JustWatch**, über die GraphQL-API, die seine Website nutzt (`apis.justwatch.com/graphql`).
  Das ist **keine offizielle öffentliche API**: JustWatch kann sie ohne Vorwarnung ändern oder schließen, und die
  Integration würde dann bis zu einem Update nichts mehr lesen. Bitte nutze sie maßvoll, für deinen Haushalt.
- Die Integration bleibt ein leiser Besucher: eine Anfrage nach der anderen, eine Sekunde Abstand, ein ehrlicher
  User-Agent und ein Cache. Bei jedem Abruf: zwei bis vier Anfragen pro Liste (heute und gestern), eine für alle
  beobachteten Titel; die fünf älteren Tage werden einmal am Tag gelesen, die Plattformen des Landes einmal am Tag,
  jeder beobachtete Titel wird einmal gesucht. Der
  allererste Abruf einer Liste liest ihre sieben Tage (etwa zehn Anfragen, etwa zehn Sekunden).
- Titel, Jahre und Links gehören JustWatch und seinen Quellen. An JustWatch geht nichts außer dem Land, der Sprache,
  den Plattformen und den gesuchten Titeln.

## Fehlerbehebung

- **Kein Gerät in „Entdecken“**: Keine Liste hat eine Plattform, die JustWatch im gewählten Land kennt. Lies den
  Status der Integration: Er nennt die unbekannten Namen.
- **„JustWatch ist nicht erreichbar“**: kein Internetzugang von Gladys aus, oder JustWatch hat seine API geändert.
  Die Werte bleiben wie zuvor; die Integration versucht es bei jedem Abruf erneut. Setze `LOG_LEVEL=debug` am
  Container, um jede Anfrage zu sehen.
- **Ein beobachteter Titel ist der falsche**: Füge das Jahr in Klammern hinzu, `Dune (1984)`.
- **Zu viele neue Titel**: Verteile deine Plattformen auf mehrere Listen, wähle „nur Filme“ oder „nur Serien“, filtere
  den Auslöser.

## Grenzen

- Keine offizielle API: Änderungen ohne Vorwarnung sind möglich.
- Leihen und Kaufen zählen nicht. Ein Zusatzkanal („WOW Amazon Channel“…) zählt nur, wenn du ihn vollständig
  nennst.
- Höchstens fünf Seiten mit 100 Titeln pro Tag; darüber hinaus (eine sehr große Auswahl) wird der Rest des Tages
  ignoriert.
- Die Reihenfolge der Titel eines Tages ist die von JustWatch (Beliebtheit), nicht die Ankunftszeit.
- Vierzehn Länder stehen zur Wahl (Europa und Nordamerika).
