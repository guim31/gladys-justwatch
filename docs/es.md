# JustWatch

Sepa en Gladys Assistant lo que acaba de llegar a sus plataformas de streaming (Netflix, Prime Video, Disney+,
Canal+, Max…) gracias a [JustWatch](https://www.justwatch.com): las películas y series añadidas hoy y durante la
semana, la última llegada, un disparador de escena con cada nuevo título y un aviso cuando un título que espera llega
a una de sus plataformas.

Sin afiliación con JustWatch. La integración lee JustWatch sin cuenta, mediante la API de su sitio web.

## Lo que obtiene

- **Un dispositivo por lista de plataformas** (hasta tres listas, por ejemplo «las suscripciones de la familia» y
  «los canales gratuitos»), cada uno con:
  - **Novedades de hoy**: películas y temporadas llegadas hoy a las plataformas de la lista;
  - **Novedades en 7 días**: lo mismo en los últimos siete días, hoy incluido;
  - **Última llegada**: «From, temporada 2 · Netflix».
- **Un dispositivo para los títulos vigilados**, si vigila alguno: cuántos están disponibles en sus plataformas,
  cuántos se vigilan y el último que pasó a estar disponible.
- **Dos disparadores de escena**: «nuevo título en mis plataformas» y «título vigilado disponible».
- **Una acción de escena** «dónde ver un título», para una escena o una pregunta por voz.
- **Un widget de panel** «Novedades JustWatch»: las últimas llegadas y dónde están sus títulos vigilados.

## Requisitos

- Gladys Assistant 5.1 o posterior (5.2 o posterior para los enlaces de las tarjetas del widget).
- Acceso a internet desde Gladys (la integración llama a `apis.justwatch.com`).
- Ni cuenta de JustWatch ni clave: solo los nombres de sus plataformas.

## Configuración

### Ajustes

| Ajuste                         | Descripción                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **País**                       | El catálogo de este país (Francia por defecto): plataformas y títulos cambian de un país a otro.                         |
| **Lista 1, 2, 3: plataformas** | Nombres de las plataformas separados por comas. Una lista vacía se ignora.                                               |
| **Lista 1, 2, 3: títulos**     | Películas y series (por defecto), solo películas o solo series.                                                          |
| **Títulos vigilados**          | Películas o series que esperar, separadas por punto y coma. Veinte como máximo.                                          |
| **Intervalo de actualización** | 1 hora, 2 horas (por defecto) o 6 horas.                                                                                 |
| **Idioma de los textos**       | Títulos tal como JustWatch los da en este idioma, nombres de las funciones (fijados al crearlas), frases de las escenas. |

Guarde, abra la pestaña **Descubrir** de la integración y cree los dispositivos que desee.

### Nombres de las plataformas

Escriba los nombres como los escribe JustWatch, en mayúsculas o no, con o sin acentos: `Netflix`, `Prime Video`,
`Disney+`, `Canal+`, `Apple TV`, `Movistar Plus+`, `Crunchyroll`… Basta una parte del nombre si no es ambigua
(`Prime` encuentra «Amazon Prime Video»). Un nombre que JustWatch no conoce en el país elegido se indica en el estado
de la integración y se ignora; el resto de la lista funciona.

Solo cuentan las ofertas **por suscripción, gratuitas o con anuncios**. Un título que solo se puede alquilar o comprar
no está «en sus plataformas», y una tienda como «Apple TV Store» no aporta nada.

### Títulos vigilados

Separe los títulos con punto y coma: `Dune (1984); Severance; Love, Death & Robots`. Se conserva la primera respuesta
de JustWatch (el título más popular); añada el año entre paréntesis para elegir otra versión. Un título que JustWatch
no conoce se indica en el estado y se vuelve a buscar una vez al día. Los títulos vigilados se buscan en las
plataformas de **todas** sus listas.

## Dispositivos

Los dispositivos se publican sin sondeo por parte de Gladys: la integración lee JustWatch ella misma con el intervalo
elegido y solo publica lo que ha cambiado (más un recordatorio cada 12 horas).

- El nombre de un dispositivo de lista se forma con sus plataformas («JustWatch Netflix + Amazon Prime Video»);
  cámbielo en Gladys a su gusto. El dispositivo está ligado al número de la lista, no a sus plataformas: cambiar las
  plataformas de la lista 1 conserva el mismo dispositivo y su historial.
- «Hoy» es el día del calendario en la zona horaria de Gladys. Un título que llega a dos plataformas de la lista
  cuenta una vez.

## Widget de panel

Añada el widget **Novedades JustWatch** a un panel. Ajustes:

- **Lista**: una lista, o vacío para todas;
- **Periodo**: hoy (por defecto), 3 días o 7 días; cada título lleva una etiqueta «Hoy», «Ayer» o «Hace N días»;
- **Mostrar los títulos vigilados**: los títulos vigilados con sus plataformas, «No está en sus plataformas» o «No
  encontrado».

El widget muestra ocho títulos como máximo, los más populares primero (el orden de JustWatch). Toque un título para
abrir su página en JustWatch.

## Disparadores de escena

**JustWatch: nuevo título en mis plataformas** se dispara con cada película o temporada que llega a una lista.
Filtros: la lista (vacío: cualquiera) y el tipo (películas, series). Variables: `title`, `year`, `season` (0 para
una película), `platforms`, `url` y `summary`, una frase lista para usar: «Nuevo en Netflix: From, temporada 2.».

La primera lectura de una lista no dispara nada (lo que aparece entonces no es novedad), y un reinicio tampoco. Una
lista cuyas plataformas cambian vuelve a empezar sin disparar nada. Veinte eventos como máximo por lectura; el resto
sigue en la siguiente. En una lista de varias plataformas grandes, algunos días llegan decenas de títulos: use los
filtros, o prefiera el widget.

**JustWatch: título vigilado disponible** se dispara cuando un título vigilado está en una plataforma de sus listas
donde no estaba en la lectura anterior. Un título añadido cuando ya está disponible se dispara una vez, enseguida.
Variables: `title`, `year`, `platforms`, `url`, `summary` («Severance (2022) está disponible en Canal+.»).

## Acción de escena

**JustWatch: dónde ver un título** busca un título en directo y devuelve `found` (1 o 0), `title`, `year`,
`available` (1 si está en una plataforma de sus listas), `platforms` y `url`. Añada el año entre paréntesis para
elegir una versión: `Dune (1984)`.

## Ejemplos de escenas

- **Sugerencia del viernes por la noche**: disparador «nuevo título en mis plataformas», tipo «películas», lista
  «familia»; acción «enviar un mensaje» con `summary`.
- **La serie esperada**: disparador «título vigilado disponible»; acción «enviar un mensaje»: «{{summary}} {{url}}».
- **Pregunta por voz**: una escena con «dónde ver un título», luego una condición sobre `available` y un mensaje con
  `platforms`.

## Fuente de los datos, condiciones y cuotas

- Los datos proceden de **JustWatch**, mediante la API GraphQL que usa su sitio web (`apis.justwatch.com/graphql`).
  **No es una API pública oficial**: JustWatch puede cambiarla o cerrarla sin aviso, y la integración dejaría
  entonces de leer hasta una actualización. Úsela con moderación, para su hogar.
- La integración es un visitante discreto: una petición cada vez, separadas por un segundo, un User-Agent honesto y
  una caché. En cada lectura: de dos a cuatro peticiones por lista (hoy y ayer), una para todos los títulos
  vigilados; los cinco días anteriores se leen una vez al día, las plataformas del país una vez al día, y cada título
  vigilado se busca una vez.
- Los títulos, años y enlaces pertenecen a JustWatch y a sus fuentes. No se envía nada a JustWatch aparte del país, el
  idioma, las plataformas y los títulos buscados.

## Solución de problemas

- **Ningún dispositivo en Descubrir**: ninguna lista tiene una plataforma que JustWatch conozca en el país elegido.
  Lea el estado de la integración: indica los nombres desconocidos.
- **«No se puede acceder a JustWatch»**: sin acceso a internet desde Gladys, o JustWatch cambió su API. Los valores se
  mantienen; la integración lo intenta de nuevo en cada lectura. Ponga `LOG_LEVEL=debug` en el contenedor para ver
  cada petición.
- **Un título vigilado no es el correcto**: añada el año entre paréntesis, `Dune (1984)`.
- **Demasiadas novedades**: reparta sus plataformas en varias listas, elija «solo películas» o «solo series», filtre
  el disparador.

## Límites

- No es una API oficial: puede cambiar sin aviso.
- El alquiler y la compra no cuentan, ni los canales adicionales de una plataforma (Prime Video Channels…).
- Cinco páginas de 100 títulos por día como máximo; más allá (una selección muy grande), se ignora el resto del día.
- El orden de los títulos de un día es el de JustWatch (popularidad), no la hora de llegada.
- Se ofrecen catorce países (Europa y Norteamérica).
