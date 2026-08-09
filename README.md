# Cumbo — App real (las 13 pantallas del handoff migradas)

## Qué es esto
Proyecto React + Vite listo para empaquetar con Capacitor (iOS/Android),
conectado a Supabase. Cada pantalla del handoff original fue migrada
del prototipo (`.dc.html`) a un componente React real, conectado a datos
reales — no a los arrays de ejemplo ni al localStorage del prototipo.

Pantallas migradas:
- **Ingreso** (login/registro) — autenticación real de Supabase, ya no
  simulada con localStorage como en el prototipo.
- **Ecosistema** (home) — hub de navegación real con react-router (antes
  eran archivos `.html` sueltos enlazados con `<a href>`). Header con menús
  Cumbo/Afiliados, carrusel de video, tarjetas a cada módulo, FAQ y barra
  inferior. El badge del carrito ya es real (viene de CarritoContext).
- **Marketplace** — catálogo real desde Supabase (café de finca, métodos
  de preparación por marca/calidad, accesorios), carrito compartido con
  el resto de la app, y checkout que crea filas reales en `pedidos` +
  `pedido_items` + un evento en `eventos_log`.
  **Pendiente en Marketplace** (a propósito, sin pago real conectado
  todavía): el cobro efectivo con la pasarela (Wompi/ePayco/PayU — Art. 29
  de la Constitución), el correo de confirmación, y la calculadora de
  molienda por varietal/nota de sabor del prototipo.

- **Sommelier** — quiz de 5 preguntas para descubrir tu perfil de sabor
  entre las 11 regiones cafeteras, calculadora de ratio café/agua por
  método (con ajuste por varietal y nota de sabor), y ficha completa de
  cada región. El perfil calculado se guarda en `usuarios.perfil_sabor`
  en Supabase (antes solo en localStorage), y los "productos
  recomendados" se buscan en el catálogo real del Marketplace filtrando
  por región — si aún no hay café de esa región, se lo dice honestamente
  en vez de mostrar datos inventados.
  **Nota sobre voz:** Cumbito "habla" (texto a voz) funciona en iOS y
  Android. El micrófono para responder hablando solo aparece si el
  navegador/webview lo soporta — en iOS (WKWebView) todavía no existe esa
  API, así que ahí se oculta en vez de mostrar un botón que no funciona.

- **Portal Caficultor** — formulario real de alta de finca: datos
  agronómicos, precio con validación contra referencia de mercado (+3%
  de bono si está dentro de rango), estado del grano, certificación
  (fotos + video, subidos de verdad a Supabase Storage), datos bancarios
  y cédula. Al enviar: crea la finca (`estado: pendiente`, a la espera
  de validación en Panel Cumbo), guarda los datos bancarios/identidad en
  una tabla **separada** con RLS restringida (nunca se exponen en el
  Marketplace), y le asigna el rol `caficultor` al usuario.
  **Pendiente a propósito:** el simulador de tarifas de envío y el
  rastreo de guía del prototipo — quedan para cuando migremos Logística.
- **Panel Cumbo** — validación real de fincas pendientes (aprobar crea
  automáticamente el producto de café en el Marketplace; rechazar la
  descarta), gestión de pedidos con avance real de estado
  (pendiente → confirmado → despachado → entregado), y KPIs contados de
  verdad desde Supabase. Requiere que tu usuario tenga `rol = 'ceo'`
  (ver instrucciones en `cumbo_schema_panel.sql`).
  **Corrección importante:** ese archivo también arregla un bug que
  encontré al construirlo — a `pedido_items` le faltaban las policies de
  RLS, así que el checkout de Marketplace no podía insertar items desde
  el navegador. Ya está corregido ahí.
  **Deliberadamente fuera de esta pasada:** el modelador financiero
  completo del prototipo (competencia de precios, estacionalidad,
  ranking de marcas socias, specs de creativos, facturación DIAN) — es
  una herramienta de inteligencia de negocio grande y separada que no
  bloquea el flujo operativo.
- **Trazabilidad** — muestra las fincas realmente validadas (las mismas
  que ya aparecen en el Marketplace), con una cronología del proceso
  (recolección → beneficio → secado → trilla → tueste). El prototipo
  mostraba fechas exactas por paso como si estuvieran registradas una
  por una; como eso no existe todavía en la base, se lo decimos
  explícitamente y mostramos una **cronología estimada** a partir de la
  fecha de recolección real, en vez de inventar precisión que no
  tenemos. Si más adelante se quiere trazabilidad exacta por paso, el
  candidato natural es extender `eventos_log` con eventos por lote.
- **CRM Vendedor** — publicación real de productos de marca socia
  (métodos de preparación y accesorios) conectada a Supabase, edición de
  stock, eliminación, e historial de ventas real desde `pedido_items`.
  **Corrección importante (otra vez el mismo tipo de bug):** a
  `productos` le faltaban las policies de escritura — sin
  `cumbo_schema_crm_vendedor.sql`, ni el vendedor podía publicar/editar
  sus productos, ni Panel Cumbo podía crear el producto de café al
  validar una finca. Ya está corregido.
  **Deliberadamente fuera de esta pasada** (necesitan una función de
  backend real con la API de Claude — el prototipo la llamaba directo
  desde el navegador con `window.claude.complete`, algo que solo existe
  en el entorno de prototipado): clasificación automática de calidad por
  foto, generación automática de copy de venta, el embudo de contenido
  de Cumbo Estudio (módulo aparte), y el comparador de tarifas de
  transportadoras (Logística). Calidad y descripción se completan a mano
  por ahora.
- **Recetario** — las 12 recetas completas del prototipo (bebidas frías
  y calientes, postres horneados y fríos), con filtro por categoría y
  vista de detalle. Es contenido editorial tuyo, así que se quedó como
  datos estáticos en el frontend — no hacía falta tabla en Supabase para
  esto. Único cambio real: navegación con react-router.
- **Comunidad** — publicaciones reales de caficultores desde Supabase
  (tabla `publicaciones`), con likes persistentes de verdad (tabla
  `publicaciones_likes`) — en el prototipo el like se perdía al
  recargar la página porque solo vivía en memoria. Además, cualquier
  usuario con rol `caficultor` puede publicar una actualización real
  desde la propia pantalla (esto no existía en el prototipo).
- **Directorio de Caficultores** — fincas realmente validadas con su
  caficultor real. La "disponibilidad" ya no es un dato fijo de
  ejemplo: se calcula del stock real del producto en el Marketplace
  (stock > 0 → Disponible, stock = 0 → Agotado, sin producto todavía →
  Próxima cosecha). Solo visible para el equipo Cumbo (`rol: 'ceo'`),
  igual que Panel Cumbo — expone el WhatsApp personal de los
  caficultores, así que no lo dejé abierto a cualquier usuario logueado.
- **Logística** — la última pantalla. Gestión real de despachos: cuando
  un pedido está `confirmado`, se puede elegir transportadora y escribir
  la guía para marcarlo `despachado`, y de ahí a `entregado`. Las
  alertas ya no son 3 ejemplos fijos: se leen de `eventos_log` en
  tiempo real. El rastreo en vivo con la transportadora sigue pendiente
  de definir — el botón de rastreo lleva al sitio oficial de cada una
  (enlaces reales) mientras se decide con quién integrar de verdad.

## Todas las pantallas del handoff están migradas (13/13)

Ingreso, Ecosistema, Marketplace, Sommelier, Portal Caficultor, Panel
Cumbo, Trazabilidad, CRM Vendedor, Recetario, Comunidad, Directorio de
Caficultores y Logística. El ciclo completo funciona de punta a punta:
un caficultor sube su finca → el CEO la valida → aparece en el
Marketplace → un cliente la compra → logística la despacha → el CEO
hace seguimiento del pedido y de la comunidad.

## Bug importante corregido en esta pasada

`eventos_log` — el log de auditoría inmutable — **nunca tuvo permiso de
INSERT** desde que se creó en `cumbo_schema.sql`. El comentario original
decía que se insertaría "desde funciones/backend", pero todas las
pantallas construidas después (Marketplace, Portal Caficultor, Panel
Cumbo, CRM Vendedor, Comunidad, Logística) insertan eventos directo
desde el navegador. Sin la corrección en `cumbo_schema_logistica.sql`,
esos inserts han estado fallando en silencio — tu log de auditoría real
probablemente esté vacío o incompleto hasta que corras ese archivo.

## Pago: se probó contraentrega, se descartó — vuelve pasarela online

Se exploró adoptar pago contraentrega (COD), pero se descartó por el
riesgo real de devoluciones/no-entrega (10-30% según referencias del
sector logístico en Colombia) — Cumbo vuelve a pasarela online
(ePayco/PayU/Mercado Pago, Art. 29 de la Constitución). El checkout de
Marketplace volvió a tener selección de método de pago.

**Lo único que quedó del experimento, porque valía la pena de todas
formas:** el checkout ahora pide **dirección, ciudad y teléfono de
entrega** — ese dato nunca había existido en el esquema, y hacía falta
sin importar el método de pago (ningún pedido, pagado por adelantado o
no, se puede despachar sin dirección).

Si en algún momento corriste `cumbo_schema_contraentrega.sql`, corré
después `cumbo_schema_revertir_contraentrega.sql` para quitar los
campos específicos de contraentrega (`tipo_pago`, `estado_recaudo`,
`monto_recaudado`, `agregador_logistico`) de la base — conserva
dirección/ciudad/teléfono, que siguen siendo válidos. Si nunca corriste
ese archivo, ignoralo, no hay nada que deshacer.

## Rediseño de navegación (inspirado en Rappi/MercadoLibre/Didi)

A pedido, se rediseñó la interfaz completa con el lenguaje visual de las
apps líderes del sector — **sin quitar ninguna función existente**, solo
reorganizando cómo se llega a cada una. Las 13 pantallas ya comparten el
mismo lenguaje visual: header claro con ícono de volver (antes cada
pantalla tenía un header oscuro de ancho completo), color de acción
naranja (`--accion`) en botones y estados activos en vez del café oscuro
para todo, e íconos reales de `lucide-react` en vez de emojis sueltos.

- **`BottomNav.jsx`** (nuevo) — barra de navegación inferior persistente
  con 5 pestañas fijas: Home, Comprar, Sommelier, Pedidos, Perfil. Visible
  en toda la app excepto en Ingreso.
- **`Perfil.jsx`** (nuevo) — reemplaza los menús desplegables "Cumbo ▾" /
  "Afiliados ▾" que tenía Ecosistema. Todo lo que vivía ahí (CRM Vendedor,
  Portal Caficultor, Panel Cumbo, Directorio, Logística) sigue existiendo
  — ahora organizado por rol dentro de Perfil, igual que estas apps
  agrupan cuentas y accesos secundarios.
- **Búsqueda real** — el buscador del Home ya no es decorativo: escribir
  algo y darle enter te lleva al Marketplace con ese texto ya filtrado
  (`/marketplace?q=...`), filtrando café, métodos y accesorios por nombre.
- **Marketplace** además suma tarjetas con ícono/calificación por
  producto y una barra de carrito flotante estilo Rappi.
- Se agregó `lucide-react` como librería de íconos.

## Accesos y contenido editable por el CEO

Confirmando el modelo de accesos, para que quede documentado: son roles
distintos con distintos propósitos —
- **Cliente**: compra y navega (Ecosistema, Marketplace, Sommelier, Mis
  Pedidos, Comunidad, Recetario, Trazabilidad).
- **Caficultor** / **Vendedor**: registran y gestionan lo que venden
  (Portal Caficultor, CRM Vendedor) — cualquier cliente puede convertirse
  en uno de estos al publicar su primera finca/producto.
- **CEO** (y **Logística** para lo operativo): acceso exclusivo de
  seguimiento y control — Panel Cumbo, Directorio de Caficultores,
  Logística. Ya eran los únicos que podían entrar ahí desde antes.

**Nuevo:** el CEO ahora puede editar contenido de texto y audiovisual
sin tocar código — pestaña **"Contenido"** dentro de Panel Cumbo:
- Los **videos del Home** (antes hardcodeados en `Ecosistema.jsx`)
- Las **preguntas rápidas del chat de WhatsApp** (agregar, editar, eliminar)

**Cambio importante en el FAQ (a pedido):** las preguntas frecuentes ya
no viven como una sección visible en el Home — se movieron a un **chat
flotante de WhatsApp** (ícono verde abajo a la derecha, visible en
Ecosistema). Al tocarlo, se abre un panel con esas mismas preguntas
como accesos rápidos; tocar una abre WhatsApp con esa pregunta ya
escrita, lista para mandar. También hay un botón "Escribir directamente"
para cualquier otra consulta. El campo `respuesta` que tenía cada
pregunta ya no se usa en ningún lado (la respuesta ahora la da una
persona real por WhatsApp, no la interfaz) — lo saqué del editor para
no confundir al CEO editando algo que no se ve.

**Pendiente tuyo:** el número de WhatsApp está en
`NUMERO_WHATSAPP_ATENCION` dentro de `Ecosistema.jsx`, con un número de
ejemplo (`573000000000`) — reemplazalo por el número real de atención
al cliente de Cumbo antes de publicar.

Esto se guarda en la tabla `contenido_app` que Ecosistema lee en vivo —
si la tabla está vacía o falla la carga, la app usa el mismo contenido
de respaldo que tenía antes, así que nunca se rompe la pantalla por
falta de contenido.

**Otro bug real que encontré al construir esto:** `eventos_log.entidad_id`
era obligatorio desde el esquema original, pero ni "publicar producto"
en CRM Vendedor ni esta edición de contenido tienen un único id de
entidad — son casos legítimos sin ese dato. Sin la corrección en
`cumbo_schema_contenido.sql`, esos eventos venían fallando en silencio
desde que migramos CRM Vendedor.

## Pago real: Mercado Pago + Wompi (PSE, Efecty, Nequi y tarjetas)

En el checkout, el cliente elige entre **Mercado Pago** o **Wompi** antes
de confirmar. Dato importante que quiero que tengas claro: **PSE y
Efecty no son pasarelas separadas** — vienen incluidos dentro de Wompi
(junto con Nequi y tarjetas) y también dentro de Mercado Pago. No hizo
falta integrar cada uno por separado.

## Mercado Pago (Checkout Pro)

Ya no es un checkout que finge cobrar — el botón "Confirmar y pagar" del
Marketplace crea el pedido real y redirige de verdad al checkout de
Mercado Pago. El cliente paga ahí (tarjeta, PSE, Efecty, lo que Mercado
Pago le ofrezca), y Mercado Pago le avisa a Cumbo por webhook cuando el
pago se aprueba — no antes.

**Por qué esto necesitó dos Edge Functions de Supabase** (no se podía
hacer solo con código de React): la clave privada de Mercado Pago
(`MP_ACCESS_TOKEN`) nunca puede vivir en el navegador — cualquiera podría
verla y usar tu cuenta. Tiene que vivir en un servidor. Como no tenías
backend propio, uso Supabase Edge Functions (Deno), que es exactamente
lo que ya estaba anotado como pendiente en este README.

- **`supabase/functions/crear-preferencia-pago`** — recibe el `pedido_id`
  ya creado, le pide a Mercado Pago el link de checkout (`init_point`) y
  lo devuelve. El precio que se cobra sale de `pedido_items` en la base,
  nunca de un número que mande el navegador.
- **`supabase/functions/webhook-mercadopago`** — Mercado Pago le avisa a
  esta función cada vez que un pago cambia de estado. Solo cuando llega
  `approved` se marca `pedidos.pago_confirmado = true` de verdad. La
  pantalla de "pago exitoso" que ve el cliente al volver es solo una
  señal optimista — la confirmación real siempre viene del webhook, no
  de que el navegador haya vuelto a la app.

### Cómo desplegar esto (pasos que te corresponden a ti)

1. **Crear tu cuenta/aplicación en Mercado Pago Colombia**
   → https://www.mercadopago.com.co/developers/panel
   Ahí sacas tu `Access Token` (usa el de prueba primero, "Sandbox", para
   probar sin mover dinero real).

2. **Instalar el CLI de Supabase** (si no lo tienes):
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref TU_PROJECT_REF
   ```

3. **Configurar los secrets** (nunca van en el código ni en git):
   ```bash
   supabase secrets set MP_ACCESS_TOKEN=TU_ACCESS_TOKEN_DE_MERCADO_PAGO
   supabase secrets set FRONTEND_URL=https://tu-dominio-real.com
   ```

4. **Desplegar las dos funciones:**
   ```bash
   supabase functions deploy crear-preferencia-pago
   supabase functions deploy webhook-mercadopago
   ```

5. **Correr `cumbo_schema_pagos.sql`** en el SQL Editor de Supabase
   (agrega `pago_confirmado`, `mercadopago_preference_id`,
   `mercadopago_payment_id` a `pedidos`).

6. Probar un pedido de punta a punta con el Access Token de **Sandbox**
   de Mercado Pago (te da tarjetas de prueba) antes de pasar a producción.

### Lo que falta para producción real (honesto, no lo voy a esconder)

- Mientras estés en desarrollo local (`localhost:5173`), Mercado Pago no
  puede mandarle el webhook a tu máquina — necesitas la app desplegada en
  una URL pública para que `notification_url` funcione de verdad.
- En la app nativa (Capacitor/iOS/Android), redirigir a una URL externa y
  volver requiere un poco más de trabajo que en la versión web (deep
  link o el plugin `Browser` de Capacitor) — la versión web ya funciona
  tal cual, la nativa es el siguiente paso cuando llegues a empaquetar.

## Wompi (Web Checkout — PSE, Efecty, Nequi y tarjetas)

- **`supabase/functions/crear-pago-wompi`** — calcula la firma de
  integridad real (SHA-256 de referencia+monto+moneda+secreto, como
  exige Wompi) y arma el link de checkout. El secreto de integridad
  nunca toca el navegador — es la misma razón por la que Mercado Pago
  necesitó su propia Edge Function.
- **`supabase/functions/webhook-wompi`** — recibe el evento cuando el
  pago llega a estado final, **valida la firma del evento** (para
  confirmar que de verdad viene de Wompi y no de alguien simulando la
  llamada) y solo entonces marca `pago_confirmado = true`.

### Cómo desplegar esto (además de lo de Mercado Pago)

1. **Crear tu cuenta en Wompi** → https://comercios.wompi.co
   Desde el dashboard sacas 3 datos (usa el modo Sandbox para probar):
   - Llave pública (`pub_...`)
   - Secreto de integridad
   - Secreto de eventos (es distinto del de integridad — Wompi los
     llama así en su dashboard, no los confundas)

2. **Configurar los secrets:**
   ```bash
   supabase secrets set WOMPI_PUBLIC_KEY=pub_...
   supabase secrets set WOMPI_INTEGRITY_SECRET=...
   supabase secrets set WOMPI_EVENTS_SECRET=...
   ```

3. **Desplegar las funciones:**
   ```bash
   supabase functions deploy crear-pago-wompi
   supabase functions deploy webhook-wompi
   ```

4. **Configurar la URL de eventos en el dashboard de Wompi**
   (Desarrolladores → URL de eventos), tanto en Sandbox como en
   producción:
   `https://TU_PROJECT_REF.supabase.co/functions/v1/webhook-wompi`

## Devoluciones (derecho de retracto y garantía)

Flujo real de punta a punta: el cliente solicita desde **Mis Pedidos**
(solo disponible en pedidos ya entregados), el CEO aprueba o rechaza
desde **Panel Cumbo → Devoluciones**, y al aprobar se intenta el
reembolso real contra la pasarela que se usó para pagar.

**Esto NO funciona igual en las dos pasarelas, y la app no lo esconde:**

- **Mercado Pago** tiene una API de reembolso self-service completa
  (`POST /v1/payments/{id}/refunds`), funciona hasta 90 días después
  del pago — se automatiza de punta a punta.
- **Wompi solo permite anular una transacción el mismo día**, antes de
  que se liquide. Pasados ese punto — el caso normal, porque las
  devoluciones se piden días después de la compra — **Wompi no tiene
  una API de reembolso propia**: hay que pedirlo a su soporte
  manualmente (WhatsApp +57 322 2804391 o su formulario), con el ID de
  la transacción. Cuando pasa esto, la solicitud queda marcada como
  "requiere gestión manual" con el ID exacto que necesitás darle a
  soporte — la app no finge que se resolvió sola.

### Secret adicional que esto necesita

```bash
supabase secrets set WOMPI_PRIVATE_KEY=priv_...
```

Es la llave **privada** de Wompi (distinta de la pública que ya
configuraste) — la necesita el endpoint de anulación
(`/transactions/{id}/void`), que a diferencia del checkout exige la
llave privada, no la pública.

### Desplegar la función

```bash
supabase functions deploy procesar-devolucion
```

Y correr `cumbo_schema` hasta la migración de devoluciones (ver
`supabase/migrations/`).

5. **Correr `cumbo_schema_wompi.sql`** (agrega `wompi_transaction_id` y
   `pasarela_pago` a `pedidos`).

## Funciones con IA (Claude)

Cuatro funciones, construidas en orden de menor a mayor complejidad —
resuelven lo que el prototipo original hacía con `window.claude.complete`
(solo existe en el entorno de prototipado, nunca hubiera funcionado en
producción). En las cuatro, la llamada a la API de Claude vive en una
Edge Function — la clave nunca toca el navegador, igual que con los
tokens de pago.

1. **Generar copy de producto** (CRM Vendedor) — botón "Generar con IA"
   junto a la descripción, a partir del nombre/tipo/calidad ya escritos.
2. **Clasificar calidad del café por foto** (Panel Cumbo) — lectura de
   apoyo con visión de Claude sobre la foto del grano, antes de validar
   una finca. Marcado explícitamente como asistencia, no como
   certificación real — la calidad de taza se determina catando
   (protocolo SCA), no con una foto.
3. **Chat conversacional del Sommelier** — alternativa al quiz de 5
   preguntas (que sigue existiendo tal cual). Siempre recibe el
   catálogo real de café en stock y solo puede recomendar de esa
   lista — el id que devuelve se verifica contra la base antes de
   mostrarse, para que nunca aparezca un producto inventado.
4. **Respuesta automática de WhatsApp** — la más grande, porque no es
   solo IA, es una integración real con Twilio (WhatsApp Business API).

### Cómo funciona la de WhatsApp

- **`supabase/functions/whatsapp-webhook`** — recibe cada mensaje
  entrante, valida que sea de verdad de Twilio (firma
  `X-Twilio-Signature`, calculada a mano porque el SDK de Twilio no
  corre nativo en Deno), y responde usando datos reales: el pedido más
  reciente de ese número de teléfono y las preguntas frecuentes que
  vos mismo editás en Panel Cumbo → Contenido.
- **Política de derivación a un humano** (decisión de producto, no
  solo de código): como operás Cumbo vos solo, "derivar a un humano"
  significa marcar la conversación para que la veas en
  **Panel Cumbo → WhatsApp**. La IA deriva cuando el cliente pide
  hablar con una persona, cuando el tema es un reembolso/reclamo/pago,
  o cuando no tiene información real para responder bien.
- **`supabase/functions/responder-whatsapp-manual`** — cuando respondés
  desde esa bandeja, se manda de verdad por WhatsApp.
- **Límite real de WhatsApp que no se puede evitar:** si pasan más de
  24 horas desde el último mensaje del cliente, WhatsApp no permite
  mandar un mensaje libre — exige una plantilla pre-aprobada por Meta.
  La función te avisa exactamente cuándo pasa esto, no falla en
  silencio.

### Secrets que esto necesita

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# Para WhatsApp específicamente (cuenta de Twilio — ver
# twilio-account-setup y twilio-whatsapp-manage-senders):
supabase secrets set TWILIO_ACCOUNT_SID=AC...
supabase secrets set TWILIO_AUTH_TOKEN=...
supabase secrets set TWILIO_WHATSAPP_NUMBER=whatsapp:+1415...
```

```bash
supabase functions deploy generar-copy-producto
supabase functions deploy clasificar-calidad-cafe
supabase functions deploy sommelier-chat
supabase functions deploy whatsapp-webhook
supabase functions deploy responder-whatsapp-manual
```

Y en el Console de Twilio: Phone Numbers → tu sender de WhatsApp →
"A Message Comes In" → apuntá a
`https://TU_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook`.

**Honestidad sobre lo que no pude probar:** igual que con DrEnvío,
nadie mandó un mensaje real de WhatsApp contra esta integración
todavía — necesita tu cuenta de Twilio con WhatsApp habilitado. Además,
el sandbox de Twilio (para probar sin registrar un sender de
producción) tiene sus propias limitaciones (50 mensajes/día, hay que
volver a unirse cada 3 días) — para producción real vas a necesitar
un sender de WhatsApp Business registrado de verdad.

## Envíos: transportadora real conectada (Interrapidísimo, Coordinadora, Servientrega)

**Esto ya no es una tarifa estimada de referencia — se cotiza en vivo
contra la transportadora real,** usando la API de
[DrEnvío](https://docs.drenvio.com), que cubre Interrapidísimo,
Coordinadora y Servientrega bajo un solo token. Se eligió esta opción
porque las APIs propias de cada transportadora exigen tener ya un
convenio comercial firmado con cada una — con DrEnvío no hace falta
negociar contrato por contrato para empezar.

- **Dentro de Bogotá**: sigue la mensajería urbana estática (Yango,
  Didi, mismo día) — DrEnvío no cubre esas dos, así que ese flujo no
  cambió.
- **Fuera de Bogotá**: el checkout pide dirección estructurada (calle,
  número, barrio, departamento, código postal — con link al buscador
  oficial de [4-72](https://www.4-72.com.co/codigo-postal/) para quien
  no sepa el suyo) y cotiza en vivo con
  `supabase/functions/cotizar-envio`. Ya no es una tarifa fija — es lo
  que la transportadora real cobra para esa dirección y ese peso
  exactos.
- **Al despachar**, Logística genera la guía real con
  `supabase/functions/generar-guia-envio` — ya no se escribe un número
  de guía a mano para envío nacional. Queda el link a la etiqueta
  (PDF) lista para imprimir.
- **Peso real del producto** — se agregó a CRM Vendedor porque
  cotizar en serio necesita el peso real, no un estimado. Si un
  producto no tiene peso cargado todavía, se usa 0.5 kg de respaldo
  para no bloquear la cotización (esto está marcado como aproximado,
  no se esconde).

### Secrets nuevos que esto necesita

```bash
supabase secrets set DRENVIO_API_TOKEN=...
# La dirección real desde donde Cumbo despacha:
supabase secrets set ORIGEN_CALLE=...
supabase secrets set ORIGEN_NUMERO=...
supabase secrets set ORIGEN_BARRIO=...
supabase secrets set ORIGEN_CIUDAD=Bogotá
supabase secrets set ORIGEN_DEPARTAMENTO="Bogotá D.C."
supabase secrets set ORIGEN_CODIGO_POSTAL=...
supabase secrets set ORIGEN_TELEFONO=...
```

El token de DrEnvío se pide por chat en su plataforma, con el correo
de tu cuenta (ver `docs.drenvio.com/getting-started`).

```bash
supabase functions deploy cotizar-envio
supabase functions deploy generar-guia-envio
```

**Honestidad sobre lo que no pude verificar:** el entorno de sandbox
de DrEnvío solo simula transportadoras mexicanas (JTExpress, Quiken) —
no hay forma de probar una cotización real de Interrapidísimo/
Coordinadora/Servientrega sin credenciales de producción reales. La
integración está construida siguiendo su documentación al pie de la
letra, pero **la primera cotización real que hagas con tu token es,
en la práctica, la primera prueba de punta a punta** — revisa que
todo salga bien antes de confiar en ella para clientes reales.

- **Mis Pedidos** (`/mis-pedidos`, nueva pantalla, no estaba en el
  handoff original) — el cliente puede ver el estado real de sus
  propios pedidos, la guía cuando ya se asignó, y una línea de tiempo
  de alertas (los mismos eventos que ve Logística, pero solo los suyos).
  Se llega ahí tocando el avatar en el header de Ecosistema.

**Corrección de seguridad importante encontrada al construir esto:** la
policy original de `eventos_log` dejaba que *cualquier* usuario
autenticado leyera *todo* el log — cualquier cliente logueado podía ver
los pedidos de otras personas o las fincas de otros caficultores. Se
detectó justo al construir Mis Pedidos, porque ahí el cliente por fin
necesitaba leer ese log de verdad. Corregido en
`cumbo_schema_mis_pedidos.sql`: ahora cada persona solo ve sus propios
eventos (o los de su propia finca), y el equipo Cumbo/logística sigue
viendo todo como antes.

## Infraestructura de desarrollo

> **Ver también:** [`docs/PROTOCOLOS.md`](./docs/PROTOCOLOS.md) —
> auditoría completa de todo lo que hace falta para que la app funcione
> al 100% (seguridad, pagos, legal Colombia, tiendas de apps, calidad,
> operación), con lo ya corregido y lo que sigue pendiente de tu parte.
>
> **Nuevo:** `npm run test` corre las pruebas automatizadas del
> proyecto (Vitest) — sigue en el CI de GitHub Actions en cada push.

A pedido, se completaron los vacíos reales de infraestructura que hacían
frágil el desarrollo del proyecto:

- **Control de versiones** — el proyecto no tenía git inicializado hasta
  ahora. Ya tiene su primer commit en la rama `main`, con `.gitignore`
  real (node_modules, `.env`, `dist`, carpetas nativas de Capacitor).
- **Migraciones de base de datos ordenadas** — los 16 archivos SQL
  sueltos que se fueron generando turno a turno (`cumbo_schema*.sql`)
  ya están consolidados en `supabase/migrations/`, numerados en el orden
  correcto de ejecución, siguiendo la convención del CLI de Supabase.
  Se dejaron afuera del historial limpio los experimentos ya revertidos
  (contraentrega, PayPal) — el estado final es el mismo sin arrastrar
  pasos de más. **Para configurar una base nueva desde cero, ahora podés
  simplemente correr `supabase db push` en vez de copiar y pegar 16
  archivos a mano** (ver la sección Setup más abajo para el detalle).
- **ESLint + Prettier** (`npm run lint`, `npm run format`) — al
  configurarlos encontraron un error real (`SpeechSynthesisUtterance` no
  estaba declarado como global en Sommelier.jsx), ya corregido. El
  código de las 15 pantallas se formateó de forma consistente.
- **Error Boundary de React** (`src/components/ErrorBoundary.jsx`) —
  antes, cualquier error de JavaScript no controlado en cualquier
  pantalla tumbaba toda la app en una pantalla blanca sin ningún
  mensaje. Ahora se muestra un aviso legible con botón de recargar.
- **CI con GitHub Actions** (`.github/workflows/ci.yml`) — corre lint y
  build automáticamente en cada push/PR a `main`, para detectar errores
  antes de que lleguen a producción.
- **Almacenamiento real de fotos de producto** — el Marketplace mostraba
  un ícono genérico de café en vez de una foto real. Ahora hay un bucket
  de Storage (`productos-imagenes`) y CRM Vendedor permite subir la foto
  al publicar; el Marketplace la muestra en las tres categorías (café,
  métodos, accesorios).
  **Bug encontrado de paso:** las tarjetas de método/accesorio mostraban
  `marca_externa`, que viene vacío para productos publicados por un
  vendedor real (a diferencia de las marcas socias sembradas por SQL) —
  quedaban con el nombre en blanco. Ya corregido: cae de vuelta al
  nombre del producto cuando no hay marca externa.

### Cómo usar las migraciones con el CLI de Supabase (recomendado)

En vez de copiar y pegar cada archivo `.sql` a mano en el SQL Editor:

```bash
npm install -g supabase
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

Esto corre las 13 migraciones de `supabase/migrations/` en orden
automáticamente. Si preferís seguir copiando y pegando a mano en el SQL
Editor del dashboard, los mismos archivos siguen funcionando igual —
solo abrilos en orden desde `supabase/migrations/`.

## Setup

1. **Instalar dependencias**
   ```bash
   npm install
   ```

2. **Crear proyecto en Supabase** (si no lo tienes)
   - Ir a https://supabase.com → New Project
   - Copiar la URL y la `anon key` desde Project Settings → API

3. **Correr las migraciones de base de datos**
   - **Opción recomendada** (automática): con el CLI de Supabase ya
     configurado (ver sección de infraestructura más arriba), corré
     `supabase db push` — aplica las 13 migraciones de
     `supabase/migrations/` en orden.
   - **Opción manual**: en el Dashboard de Supabase → SQL Editor → New
     query, abrí cada archivo de `supabase/migrations/` **en orden por
     nombre** (ya vienen numerados) y ejecutalos uno por uno.

   Si en algún momento llegaste a correr `cumbo_schema_paypal.sql` o
   `cumbo_schema_contraentrega.sql` (experimentos descartados, ya no
   están en `supabase/migrations/`), pedime los archivos de reversión
   correspondientes.

4. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
   ```

5. **Habilitar login con Google** (opcional, ya está el botón conectado)
   - Supabase Dashboard → Authentication → Providers → Google → activar
     y completar Client ID / Secret (se generan en Google Cloud Console)

6. **Correr en desarrollo (navegador)**
   ```bash
   npm run dev
   ```

## Pasar a app nativa (Capacitor)

```bash
npm run build
npx cap add ios       # primera vez
npx cap add android   # primera vez
npm run cap:sync
npm run cap:ios        # abre Xcode
npm run cap:android    # abre Android Studio
```

Requiere Xcode (Mac) para iOS y Android Studio para Android.

## Qué sigue (pendientes reales, no del prototipo)

Todo lo que quedó deliberadamente afuera durante la migración, agrupado
porque varios ítems comparten la misma pieza de infraestructura que
falta:

1. **Cumbo Estudio** — no es una pantalla que faltara migrar, es un
   módulo aparte de tu ecosistema (con sus propios tiers de suscripción)
   que todavía no se ha empezado a construir. Ahora es el siguiente
   bloqueante más importante — pago, transportadora y las funciones de
   IA ya están resueltos.
2. **Modelador financiero de Panel Cumbo** — competencia de precios,
   estacionalidad, ranking de marcas socias, facturación DIAN. Es
   inteligencia de negocio, no bloquea nada operativo.
3. **Correo transaccional** (SendGrid/Resend, ya estaba en tu stack
   recomendado) — confirmación de pedidos, notificaciones de validación
   de finca, etc.
