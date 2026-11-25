# Plano

**Los cimientos de un proyecto, escritos para que la IA los respete.**

Plano es un marco para construir software con agentes de IA sin leer el código. Resuelve el problema que tienen tanto el *vibe coding* como el *spec-driven development*: la especificación deja de gobernar apenas el agente empieza a generar. En Plano, los cimientos del proyecto viven en archivos chicos y enumerados (`plano/*.json`) que se hacen cumplir mecánicamente: un agente no *se olvida* de respetarlos, *no puede* violarlos.

Tres ideas:

1. **Mundo cerrado.** El Plano no describe la aplicación: la enumera. Entidades, pantallas, acciones, integraciones, innegociables. Lo que no está en la lista no existe, y el código solo puede usar lo que está nombrado.
2. **Dureza ganada.** Cada ítem tiene un nivel: `duro` (cimiento; cambiarlo es caro), `blando` (puede cambiar), `supuesto` (lo asumió el agente; hay que confirmarlo) o `propuesto` (el agente lo pide; la persona lo aprueba). Un ítem se vuelve duro cuando hay cosas construidas encima. El agente nunca toca lo duro; la persona sí, con conocimiento de lo que se rompe.
3. **La pantalla es la unidad.** La persona no revisa código: revisa pantallas, supuestos y tajadas verticales terminadas. Quince minutos por día.

## Estado: tajada 1 de 6

| # | Tajada | Estado |
|---|---|---|
| 1 | **Entrevista fundacional** — conversás con Claude y el Plano se va llenando a la vista, tarjeta por tarjeta | ✅ |
| 2 | **El Plano legible** — diagrama de entidades dibujado desde el JSON y el **roadmap**: las versiones en que se construye el proyecto, derivadas de lo que cada cosa necesita, con verificador | ✅ |
| 3 | **Prototipo** — por versión, pantalla por pantalla: la IA la genera con los ids del Plano, vos la ves en un marco de celular o escritorio, la aprobás o la devolvés con un comentario; aprobar congela la pantalla y sus elementos en el Plano | ✅ |
| 4 | Extracción → Tablero — historias derivadas de las pantallas aprobadas | — |
| 5 | Revisión — supuestos, tajadas por aceptar, hooks de Claude Code enchufados | — |
| 6 | Auditor de huérfanos y tester ciego | — |

Las herramientas de la tajada 5 (generador de esquema Convex, verificador y hooks) ya existen en `herramientas/`, probadas en un repo aparte; falta enchufarlas a la interfaz.

## Correr la entrevista

Requisitos: Node 22 o más nuevo, y una API key de Anthropic.

```
npm install
copy .env.example .env      (en Mac/Linux: cp .env.example .env)
```

Abrí `.env` y pegá tu `ANTHROPIC_API_KEY`. Después:

```
npm run dev
```

Entrá a http://localhost:4747. Creás un proyecto dándole un nombre y una carpeta que ya exista (la carpeta del repo del proyecto), y la entrevista arranca con la única pregunta que importa: ¿qué querés construir?

A medida que hablás, a la derecha aparecen las tarjetas. **Si algo que dijiste no aparece, no quedó registrado.** Lo que el agente asume solo aparece marcado como *supuesto* para que lo confirmes o lo corrijas.

Todo se guarda en `<tu-proyecto>/plano/`:

```
plano/
  identidad.json       qué es, para quién, por qué, tipo, objetivo, stack
  decisiones.json      elecciones de producto o técnicas
  entidades.json       los sustantivos (con sus campos)
  pantallas.json       lo que se ve (con sus elementos)
  acciones.json        los verbos: qué hace alguien, en qué pantalla, sobre qué entidad
  integraciones.json   servicios externos
  innegociables.json   idioma, colores, tipografía, tono
  preguntas.json       lo que todavía no sabés y el agente no debe decidir solo
  roadmap.json         las versiones, en orden: qué pantallas, entidades, acciones e integraciones entran en cada una
  prototipo.json       el estado de cada pantalla del prototipo (pendiente, para revisar, devuelta, aprobada)

prototipo/
  <pantalla>.html      cada pantalla generada: HTML, CSS y JS en un archivo, con data-plano en cada elemento del Plano
  .entrevista.json     la conversación, para retomarla
```

Son JSON chicos con `id`, `titulo`, `descripcion` y `nivel`. Van en el repo del proyecto, versionados con git. Cualquier agente que entre al proyecto los lee primero.

### Probar sin gastar tokens

```
PLANO_MOCK=1 npm run dev      (en PowerShell: $env:PLANO_MOCK=1; npm run dev)
```

Un simulador responde en lugar de Claude. Sirve para ver la interfaz y el flujo de tarjetas.

## Estructura

```
server/   Hono. Sirve la interfaz, guarda el Plano en archivos, corre el agente de la entrevista.
client/   HTML, CSS y JS sin build. Chat a la izquierda, el Plano a la derecha.
herramientas/   plano.mjs (generate / verify / aprobar / firmar / instalar) y plano-hook.mjs (hooks de Claude Code).
data/     registro local de proyectos. No se versiona.
```

## Licencia

MIT. Hecho en Montevideo.
