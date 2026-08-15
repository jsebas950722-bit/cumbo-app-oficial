# Protocolo de programación — Sesión de hoy

7 commits, de la corrección del despliegue en producción al rediseño
completo del flujo de compra de café a los caficultores.

---

## 1. Corrección del despliegue en producción

**Problema real, encontrado por Sebastián al correr las migraciones:**
`fincas.caficultor_id` era `NOT NULL`, pero el seed de las 3 fincas de
ejemplo insertaba `null` ahí — el propio comentario del código decía
"voy a crear un usuario sistema para esto" y nunca se implementó.

**Corrección:** `fincas.caficultor_id` pasó a ser nullable. Se
verificó que ningún otro lugar del código asumiera que siempre existe
(Directorio de Caficultores ya usaba `?.` con respaldo "Caficultor").

**Segundo problema, encontrado en producción real:** `VITE_SUPABASE_ANON_KEY`
con el formato nuevo de Supabase (`sb_publishable_...`) causaba
`Uncaught Error: Invalid supabaseUrl`. Se resolvió usando la clave
**Legacy** (`anon public`, formato `eyJhbGci...`), compatible con la
versión de `@supabase/supabase-js` que usa el proyecto.

**Protocolo para el futuro:** si el error `Invalid supabaseUrl` vuelve
a aparecer, verificar primero que `VITE_SUPABASE_URL` no tenga
espacios ni caracteres de más (se solucionó reescribiéndolo a mano en
vez de copiar y pegar) y que `VITE_SUPABASE_ANON_KEY` use el formato
Legacy, no el nuevo `sb_publishable_`.

---

## 2. Chemex agregado a la calculadora de ratios

Chemex ya existía en CRM Vendedor, Marketplace y como recomendación
del Sommelier, pero faltaba en `METODOS` (la calculadora café/agua de
`Sommelier.jsx`) — inconsistencia real: el quiz podía recomendar
Chemex, pero la calculadora no sabía qué ratio usar. Agregado con
ratio 1:17 (más diluido que V60, consistente con guías reales de
Chemex por su filtro de papel más grueso).

---

## 3. El rediseño completo: café pergamino

Esta fue la corrección más grande de la sesión — sobre un supuesto
mío que no coincidía con el negocio real de Sebastián. Documentado acá
en detalle porque es la arquitectura que va a persistir.

### 3.1 El modelo de negocio real (aclarado por Sebastián, en sus palabras)

> "Yo compro el café en bultos de pergamino a los caficultores. El
> stock del café es de exclusivo control de Cumbo."
>
> "Yo uso el directorio de fincas para comprar el café para mi marca
> Cumbo y yo como CEO vendo el café en bolsas y procesado."
>
> "La función del panel de los caficultores es exclusivo para los
> despachos que se hagan a Cumbo, no más."
>
> "La conexión es los pedidos a los caficultores es de café pergamino
> a Cumbo. Y el único seguimiento es que el caficultor verifique el
> pedido a Cumbo."

**Traducido a protocolo de negocio:**
1. El caficultor cultiva y cosecha café — lo vende a Cumbo en
   pergamino (sin procesar), por bultos.
2. Sebastián (CEO) usa el **Directorio de Caficultores** para decidir
   a quién comprarle.
3. Sebastián registra el **pedido** de pergamino a esa finca —
   cantidad de bultos, precio por kilo.
4. El caficultor solo puede **verificar** ese pedido (confirmar que
   los datos son correctos) — no edita cantidad, precio, ni nada más.
5. Sebastián procesa el pergamino por fuera de la app (tueste,
   empaque) y controla **exclusivamente él** el stock del producto
   terminado que aparece en el Marketplace.

### 3.2 Lo que se corrigió en cada iteración (en orden real)

**Iteración 1 — bug encontrado (no relacionado al pedido de café):**
al validar una finca, el producto de café se creaba con `vendedor_id`
vacío — ningún caficultor podía nunca ajustar el stock de su propio
producto, desde el primer día. Se corrigió vinculándolo al
caficultor... **pero esto resultó ser el diseño equivocado.**

**Iteración 2 — corrección del modelo real:** Sebastián aclaró que el
stock del producto terminado es exclusivo de Cumbo. Se revirtió el
permiso de edición:
```sql
create policy "productos_editar_vendedor" on public.productos
  for update using (vendedor_id = auth.uid() and tipo <> 'cafe_finca');
```
`vendedor_id` se mantiene apuntando al caficultor solo para que
*vea* su producto — nunca para editarlo. Se creó `compras_pergamino`
(cantidad de bultos, peso por bulto — 70kg estándar colombiano,
precio/kg, total calculado automáticamente, estado de pago).

**Iteración 3 — conexión de flujo real:** el Directorio de
Caficultores (donde Sebastián decide a quién comprarle) no tenía
ninguna conexión con Compras Pergamino (donde se registra la compra).
Se agregó un botón "Comprar pergamino" en cada finca del Directorio,
que lleva directo a Panel Cumbo con esa finca ya preseleccionada
(`/panel?tab=pergamino&finca=ID`).

**Iteración 4 — acotar el alcance:** el panel del caficultor todavía
mostraba información del producto terminado (aunque de solo lectura)
y una pestaña de "Ventas" que no le correspondía. Se lo redujo a
**una sola cosa**: la lista de sus despachos a Cumbo, sin pestañas,
sin nada más.

**Iteración 5 — el seguimiento real:** se agregó `verificado` +
`fecha_verificacion` a `compras_pergamino`, con un botón único
("Verificar que este pedido es correcto") como la única acción
posible del caficultor sobre su propio despacho.

### 3.3 Arquitectura final de datos

```
fincas
  └─ caficultor_id (nullable — las 3 fincas de ejemplo no tienen dueño)

productos (tipo = 'cafe_finca')
  └─ vendedor_id = caficultor_id de su finca (solo para que LEA, nunca para editar)
  └─ stock, precio → editables SOLO por el CEO (usuario_es_ceo())

compras_pergamino
  ├─ finca_id, caficultor_id
  ├─ cantidad_bultos, peso_por_bulto_kg (default 70), precio_por_kilo
  ├─ total_pagado (columna generada: cantidad × peso × precio)
  ├─ estado_pago ('pendiente' | 'pagado') — solo lo cambia el CEO
  └─ verificado, fecha_verificacion — solo lo cambia el caficultor
```

### 3.4 Políticas RLS de `compras_pergamino`

| Quién | Puede | Cómo |
|---|---|---|
| Caficultor | Ver sus propios despachos | `caficultor_id = auth.uid()` |
| Caficultor | Verificar (actualizar) sus propios despachos | `caficultor_id = auth.uid()` — la interfaz solo expone el campo `verificado` |
| CEO | Todo (crear, ver, editar, marcar pagado) | `usuario_es_ceo()` |

### 3.5 Pantallas afectadas

| Pantalla | Rol | Qué ve/hace |
|---|---|---|
| `DirectorioCaficultores.jsx` | CEO | Botón "Comprar pergamino" por finca → deep-link a Panel Cumbo |
| `PanelCumbo.jsx` → Compras Pergamino | CEO | Registra pedidos, marca pagado, ve si el caficultor ya verificó |
| `CRMVendedor.jsx` (como "Mi Inventario y Ventas") | Caficultor | Solo ve y verifica sus propios despachos — nada más |
| `CRMVendedor.jsx` (como "CRM Vendedor") | Vendedor | Sin cambios — sigue gestionando sus propios productos normalmente |

---

## Migraciones agregadas hoy (en orden)

1. `20260101002900_control_inventario_caficultores.sql` — vínculo
   caficultor↔producto (luego revertido en permisos, no en estructura)
2. `20260101003000_cafe_pergamino.sql` — corrección de permisos +
   tabla `compras_pergamino`
3. `20260101003100_verificacion_pedido_pergamino.sql` — campos y
   policy de verificación

## Verificación técnica de hoy

Cada cambio se compiló (`vite build`), se pasó por ESLint (0 errores
en todos los commits), y se corrieron las 14 pruebas automatizadas de
`tarifas.test.js` — todas en verde en cada entrega.
