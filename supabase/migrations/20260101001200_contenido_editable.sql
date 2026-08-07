-- ============================================================
-- CUMBO — Contenido editable (texto y audiovisual) para el CEO
-- Ejecutar DESPUÉS de los 12 archivos anteriores.
-- ============================================================

-- ------------------------------------------------------------
-- CORRECCIÓN: eventos_log.entidad_id era NOT NULL desde el esquema
-- original, pero no todos los eventos tienen un único id de entidad
-- (publicar un producto no siempre generaba uno a mano en el momento
-- del insert, y este mismo caso de "editar contenido" tampoco tiene
-- un id natural — es un cambio a varias claves a la vez). Sin esto,
-- esos inserts en eventos_log fallaban en silencio.
-- ------------------------------------------------------------
alter table public.eventos_log alter column entidad_id drop not null;

-- Hasta ahora las preguntas frecuentes y los videos del home estaban
-- escritos directo en el código (Ecosistema.jsx) — cualquier cambio de
-- texto necesitaba que un programador tocara el código y volviera a
-- desplegar la app. Esta tabla permite que el CEO edite ese contenido
-- desde Panel Cumbo, sin tocar código.

create table if not exists public.contenido_app (
  clave text primary key,       -- 'home_faq', 'home_videos', etc.
  tipo text not null,           -- 'faq' | 'videos' — para saber cómo interpretar `valor`
  valor jsonb not null,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references public.usuarios(id)
);

alter table public.contenido_app enable row level security;

-- Cualquiera puede leer (es contenido público de cara al cliente).
create policy "contenido_app_lectura_publica" on public.contenido_app
  for select using (true);

-- Solo el CEO puede crear/editar contenido.
create policy "contenido_app_editar_ceo" on public.contenido_app
  for all using (public.usuario_es_ceo());

-- ------------------------------------------------------------
-- Seed: el mismo contenido que ya estaba hardcodeado, para que no
-- cambie nada visualmente hasta que el CEO decida editarlo.
-- ------------------------------------------------------------
insert into public.contenido_app (clave, tipo, valor) values
  ('home_faq', 'faq', '[
    {"pregunta": "¿Cuánto tarda mi pedido en llegar?", "respuesta": "Depende de la transportadora y tu ciudad — normalmente entre 1 y 4 días hábiles. Puedes rastrear tu guía en el correo de confirmación que te enviamos."},
    {"pregunta": "¿Qué métodos de pago aceptan?", "respuesta": "Aceptamos Mercado Pago y Wompi — ambos incluyen tarjeta, PSE, Efecty y más."},
    {"pregunta": "¿De dónde viene el café que compro?", "respuesta": "Cada café Cumbo indica la finca, la región y el proceso exactos — puedes ver la trazabilidad completa en la ficha del producto."},
    {"pregunta": "¿Cómo saben que el café es real?", "respuesta": "Cada finca certifica su cultivo con foto, foto del grano y un video — validado por el equipo Cumbo antes de publicarse."},
    {"pregunta": "¿Puedo devolver un producto?", "respuesta": "Sí, si llega dañado o no corresponde a lo pedido. Escríbenos por WhatsApp con tu número de pedido y lo resolvemos."},
    {"pregunta": "¿Cómo funciona el Agente Sommelier?", "respuesta": "Cumbito te hace unas preguntas sobre tus gustos (o puedes hablarle por voz) y te recomienda el café de nuestro stock que mejor se ajusta a tu paladar."}
  ]'::jsonb)
on conflict (clave) do nothing;

insert into public.contenido_app (clave, tipo, valor) values
  ('home_videos', 'videos', '["/videos/ecosistema-1.mp4", "/videos/ecosistema-2.mp4"]'::jsonb)
on conflict (clave) do nothing;
