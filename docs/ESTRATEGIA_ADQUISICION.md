# Cumbo — Estrategia de Campañas de Adquisición

Punto E del roadmap de marketing. Construido sobre lo ya definido en
`PROPUESTA_VALOR_BUYER_PERSONA.md` — no es una estrategia genérica,
cada mensaje está pensado para el perfil real que ya identificamos.

---

## 1. Los dos canales reales (según lo que contó Sebastián)

El buyer persona señaló específicamente **redes sociales** y **voz a
voz** — no publicidad paga tradicional. La estrategia se construye
alrededor de eso, no de un canal que no está en el radar real.

### Redes sociales — el rol de Cumbo Estudio

Esto ya tiene una herramienta construida: **Cumbo Estudio** genera
embudos de contenido reales (atracción → consideración → conversión),
con voz de marca entrenada en documentos reales, y guardrail de datos
verificados. La estrategia de campañas no es "hay que hacer contenido
nuevo" — es **usar Cumbo Estudio con la intención correcta**, dado el
perfil real:

> Como el cliente **ya sabe de café** (no hay que explicarle qué es
> un proceso lavado desde cero), las intenciones que se le cargan a
> Cumbo Estudio deberían apuntar a contenido específico y nuevo — un
> lote puntual, una finca puntual, un dato que todavía no conocía —
> no contenido genérico de "qué es el café de especialidad".

**Perfil de tono recomendado**: `educativo_academy` más que
`cercano_consumidor` — ya está disponible como opción en Cumbo
Estudio, se trata de usarlo con este público en mente.

### Voz a voz — un hueco real, no solo un canal pasivo

"Voz a voz" no es algo que ocurra solo — normalmente se necesita un
motivo concreto para que alguien recomiende. Hoy la app **no tiene
ningún mecanismo de referidos** (compartir, invitar, descuento por
traer a alguien). Esto es honesto: es una oportunidad real, no
construida todavía — corresponde al punto J del roadmap ("Escala:
Programas de Referidos"), más adelante en el plan.

---

## 2. Mensajes por etapa (mismo framework que ya usa Cumbo Estudio)

No se inventó un framework nuevo — se usa el mismo que el embudo de
Cumbo Estudio ya genera, adaptado a lo que sabemos del cliente real.

### Atracción — resolver "desconocimiento"

El buyer persona señaló el desconocimiento (de Cumbo, o de cómo
elegir bien) como una barrera real. El mensaje de atracción debería
responder eso directamente: quién es Cumbo, por qué la trazabilidad
es verificable y no solo una promesa.

- Ángulo: "esto es lo que hace diferente a Cumbo" — trazabilidad real,
  no marketing genérico de café.

### Consideración — resolver "demasiada variedad que confunde"

Acá el **Sommelier** hace el trabajo pesado — es la herramienta que
resuelve exactamente esta barrera, ayudando a alguien que ya sabe de
café mucho de variedad. El contenido de esta etapa debería
literalmente **invitar a usar el Sommelier**, no reemplazarlo con
más texto.

- Ángulo: "no tenés que adivinar cuál es tu café — te lo decimos en
  4 preguntas" (método, fuerza, notas, molienda — el quiz rediseñado).

### Conversión — resolver "precio"

El precio es la única barrera que el buyer persona señaló que **no
se resuelve con contenido** — es una conversación de pricing real,
no de marketing. El mensaje de conversión debería apoyarse en lo que
sí convence (precio justo al caficultor, calidad verificable) sin
prometer que Cumbo es "barato", porque probablemente no lo es y
prometer eso rompería la confianza que la trazabilidad ya construyó.

- Ángulo: "pagás por café real, trazable, y un precio justo llega al
  caficultor" — justificar el precio con la propuesta de valor, no
  esconderlo.

---

## 3. Cómo medir si esto funciona (ya instrumentado, no hay que construir nada nuevo)

Los eventos de analytics que ya se instrumentaron hoy mismo miden
exactamente este embudo:

| Etapa | Evento que ya existe |
|---|---|
| Atracción → llega a la app | `cuenta_creada`, `sesion_iniciada` |
| Consideración → usa el Sommelier | `uso_sommelier` |
| Conversión → compra | `producto_agregado_carrito` → `checkout_iniciado` → `compra_completada` |

Panel Cumbo → Analytics ya muestra este embudo completo. Cuando se
lancen campañas reales, ahí se va a poder ver si de verdad están
moviendo la aguja — sin necesitar ninguna herramienta externa nueva.

---

## 4. Lo que esto NO resuelve (siendo honesto sobre el alcance)

- No se construyó ningún sistema de referidos todavía (punto J del
  roadmap, más adelante).
- No hay presupuesto ni calendario de campañas concreto acá — esto es
  la estrategia de *mensaje y canal*, no un plan de medios.
- El precio como barrera queda como una decisión de negocio pendiente,
  no una que el marketing pueda resolver por sí solo.
