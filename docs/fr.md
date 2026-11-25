# JustWatch

Savoir ce qui vient d'arriver sur vos plateformes de streaming (Netflix, Prime Video, Disney+, Canal+, Max…) grâce à
[JustWatch](https://www.justwatch.com), dans Gladys Assistant : les films et séries ajoutés aujourd'hui et sur la
semaine, la dernière arrivée, un déclencheur de scène à chaque nouveau titre, et une alerte quand un titre que vous
attendez arrive sur l'une de vos plateformes.

Non affiliée à JustWatch. L'intégration lit JustWatch sans compte, par l'API de son site.

## Ce que vous obtenez

- **Un appareil par liste de plateformes** (jusqu'à trois listes, par exemple « les abonnements de la famille » et
  « les chaînes gratuites »), chacun avec :
  - **Nouveautés du jour** : films et saisons arrivés aujourd'hui sur les plateformes de la liste ;
  - **Nouveautés sur 7 jours** : la même chose sur les sept derniers jours, aujourd'hui compris ;
  - **Dernière arrivée** : « From, saison 2 · Netflix ».
- **Un appareil pour les titres surveillés**, si vous en surveillez : combien sont disponibles sur vos plateformes,
  combien sont surveillés, et le dernier devenu disponible.
- **Deux déclencheurs de scène** : « nouveau titre sur mes plateformes » et « titre surveillé disponible ».
- **Une action de scène** « où regarder un titre », pour une scène ou une question vocale.
- **Un widget de tableau de bord** « Nouveautés JustWatch » : les dernières arrivées, et où sont vos titres surveillés.

## Prérequis

- Gladys Assistant 5.1 ou plus récent (5.2 ou plus pour les liens des cartes du widget).
- Un accès à internet depuis Gladys (l'intégration appelle `apis.justwatch.com`).
- Ni compte JustWatch ni clé : seulement les noms de vos plateformes.

## Configuration

### Réglages

| Réglage                         | Description                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Pays**                        | Le catalogue de ce pays (France par défaut) : plateformes et titres changent d'un pays à l'autre.                          |
| **Liste 1, 2, 3 : plateformes** | Noms des plateformes séparés par des virgules. Une liste vide est ignorée.                                                 |
| **Liste 1, 2, 3 : titres**      | Films et séries (par défaut), films seulement ou séries seulement.                                                         |
| **Titres surveillés**           | Films ou séries à guetter, séparés par des points-virgules. Vingt au plus.                                                 |
| **Fréquence de mise à jour**    | 1 heure, 2 heures (par défaut) ou 6 heures.                                                                                |
| **Langue des textes**           | Titres tels que JustWatch les donne dans cette langue, noms des fonctionnalités (figés à la création), phrases des scènes. |

Enregistrez, puis ouvrez l'onglet **Découverte** de l'intégration et créez les appareils voulus.

### Noms des plateformes

Saisissez les noms comme JustWatch les écrit, en majuscules ou non, avec ou sans accents : `Netflix`, `Prime Video`,
`Disney+`, `Canal+`, `Apple TV`, `Arte`, `Crunchyroll`… Une partie du nom suffit quand elle n'est pas ambiguë
(`Prime` trouve « Amazon Prime Video »). Un nom que JustWatch ne connaît pas dans le pays choisi est signalé dans
l'état de l'intégration et ignoré ; le reste de la liste fonctionne.

Seules comptent les offres **par abonnement, gratuites ou avec publicité**. Un titre qu'on peut seulement louer ou
acheter n'est pas « sur vos plateformes », et une boutique comme « Apple TV Store » n'apporte rien.

### Titres surveillés

Séparez les titres par des points-virgules : `Dune (1984) ; Severance ; Love, Death & Robots`. La première réponse
de JustWatch (le titre le plus populaire) est retenue ; ajoutez l'année entre parenthèses pour choisir une autre
version. Un titre inconnu de JustWatch est signalé dans l'état et recherché de nouveau une fois par jour. Les titres
surveillés sont cherchés sur les plateformes de **toutes** vos listes.

## Appareils

Les appareils sont publiés sans interrogation par Gladys : l'intégration lit JustWatch elle-même à la fréquence
choisie, et ne publie que ce qui a changé (plus un rappel toutes les 12 heures).

- Le nom d'un appareil de liste est fait de ses plateformes (« JustWatch Netflix + Amazon Prime Video ») ; renommez-le
  dans Gladys à votre guise. L'appareil est lié au numéro de la liste, pas à ses plateformes : changer les plateformes
  de la liste 1 garde le même appareil et son historique.
- « Aujourd'hui » est le jour du calendrier dans le fuseau horaire de Gladys. Un titre arrivé sur deux plateformes de
  la liste compte une fois.

## Widget de tableau de bord

Ajoutez le widget **Nouveautés JustWatch** à un tableau de bord. Réglages :

- **Liste** : une liste, ou vide pour toutes ;
- **Période** : aujourd'hui (par défaut), 3 jours ou 7 jours ; chaque titre porte une pastille « Aujourd'hui »,
  « Hier » ou « Il y a N jours » ;
- **Afficher les titres surveillés** : les titres surveillés avec leurs plateformes, « Pas sur vos plateformes » ou
  « Introuvable ».

Le widget montre huit titres au plus, les plus populaires d'abord (l'ordre de JustWatch). Touchez un titre pour
ouvrir sa page sur JustWatch.

## Déclencheurs de scène

**JustWatch : nouveau titre sur mes plateformes** se déclenche pour chaque film ou saison arrivé sur une liste.
Filtres : la liste (vide : n'importe laquelle) et le genre (films, séries). Variables : `title`, `year`, `season` (0
pour un film), `platforms`, `url` et `summary`, une phrase toute faite : « Nouveau sur Netflix : From, saison 2. ».

La première lecture d'une liste ne déclenche rien (ce qui est listé alors n'est pas une nouveauté), un redémarrage
non plus. Une liste dont les plateformes changent repart de zéro sans rien déclencher. Vingt événements au plus par
lecture ; la suite part à la lecture suivante. Sur une liste de plusieurs grosses plateformes, certains jours
apportent des dizaines de titres : utilisez les filtres, ou préférez le widget.

**JustWatch : titre surveillé disponible** se déclenche quand un titre surveillé est sur une plateforme de vos listes
où il n'était pas à la lecture précédente. Un titre ajouté alors qu'il est déjà disponible se déclenche une fois,
tout de suite. Variables : `title`, `year`, `platforms`, `url`, `summary` (« Severance (2022) est disponible sur
Canal+. »).

## Action de scène

**JustWatch : où regarder un titre** cherche un titre en direct et renvoie `found` (1 ou 0), `title`, `year`,
`available` (1 s'il est sur une plateforme de vos listes), `platforms` et `url`. Ajoutez l'année entre parenthèses
pour choisir une version : `Dune (1984)`.

## Exemples de scènes

- **Suggestion du vendredi soir** : déclencheur « nouveau titre sur mes plateformes », genre « films », liste
  « famille » ; action « envoyer un message » avec `summary`.
- **La série attendue** : déclencheur « titre surveillé disponible » ; action « envoyer un message » :
  « {{summary}} {{url}} ».
- **Question vocale** : une scène avec « où regarder un titre », puis une condition sur `available` et un message
  avec `platforms`.

## Source des données, conditions et quotas

- Les données viennent de **JustWatch**, par l'API GraphQL qu'utilise son site (`apis.justwatch.com/graphql`). Ce
  n'est **pas une API publique officielle** : JustWatch peut la modifier ou la fermer sans prévenir, et l'intégration
  cesserait alors de lire jusqu'à une mise à jour. Merci d'en faire un usage raisonnable, pour votre foyer.
- L'intégration reste une visiteuse discrète : une requête à la fois, espacées d'une seconde, un User-Agent honnête,
  et un cache. À chaque lecture : deux à quatre requêtes par liste (aujourd'hui et hier), une pour tous les titres
  surveillés ; les cinq jours plus anciens sont lus une fois par jour, les plateformes du pays une fois par jour,
  chaque titre surveillé est cherché une fois. La toute
  première lecture d'une liste lit ses sept jours (une dizaine de requêtes, une dizaine de secondes).
- Titres, années et liens appartiennent à JustWatch et à ses sources. Rien n'est envoyé à JustWatch au-delà du pays,
  de la langue, des plateformes et des titres cherchés.

## Dépannage

- **Aucun appareil dans Découverte** : aucune liste n'a de plateforme connue de JustWatch dans le pays choisi. Lisez
  l'état de l'intégration : il donne les noms inconnus.
- **« JustWatch est injoignable »** : pas d'accès à internet depuis Gladys, ou JustWatch a changé son API. Les valeurs
  restent celles d'avant ; l'intégration réessaie à chaque lecture. Mettez `LOG_LEVEL=debug` sur le conteneur pour
  voir chaque requête.
- **Un titre surveillé n'est pas le bon** : ajoutez l'année entre parenthèses, `Dune (1984)`.
- **Trop de nouveautés** : répartissez vos plateformes en plusieurs listes, choisissez « films seulement » ou
  « séries seulement », filtrez le déclencheur.

## Limites

- Pas une API officielle : elle peut changer sans prévenir.
- La location et l'achat ne comptent pas. Une chaîne en option (« France TV Amazon Channel »…) ne compte que si vous
  la nommez en entier.
- Cinq pages de 100 titres par jour au plus ; au-delà (une très grande sélection), le reste de la journée est ignoré.
- L'ordre des titres d'une journée est celui de JustWatch (popularité), pas l'heure d'arrivée.
- Quatorze pays sont proposés (Europe et Amérique du Nord).
