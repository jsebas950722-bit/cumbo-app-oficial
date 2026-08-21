-- ============================================================
-- CUMBO — Eventos de analytics de producto
-- Ejecutar DESPUÉS de las 33 migraciones anteriores.
-- ============================================================
-- Distinta de `eventos_log` (que es auditoría de negocio: cambios de
-- estado de pedidos, ediciones, etc.) — esta tabla es específicamente
-- para medir el EMBUDO de uso real de la app: cuánta gente llega a
-- cada paso, dónde se cae, qué tan seguido vuelve.
--
-- Definida en conjunto con Sebastián — ver docs/PROPUESTA_VALOR_BUYER_PERSONA.md
-- para la buyer persona que motiva qué se mide y por qué.

create table public.eventos_analytics (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  propiedades jsonb default '{}'::jsonb,
  usuario_id uuid references public.usuarios(id) on delete set null,
  sesion_anonima_id text, -- para gente sin cuenta todavía (antes de registrarse)
  fecha timestamptz not null default now()
);

alter table public.eventos_analytics enable row level security;

-- Cualquiera puede insertar un evento — con o sin sesión, porque
-- queremos medir también a quien todavía no se registró. No hay nada
-- sensible en esto (nombre del evento + propiedades genéricas), así
-- que insertar es público a propósito.
create policy "eventos_analytics_insertar_publico" on public.eventos_analytics
  for insert with check (true);

-- Solo el CEO puede leer/analizar los eventos.
create policy "eventos_analytics_ver_ceo" on public.eventos_analytics
  for select using (public.usuario_es_ceo());

-- Índices para las consultas de embudo (agrupar por nombre y fecha es
-- lo más común).
create index eventos_analytics_nombre_fecha on public.eventos_analytics (nombre, fecha desc);
create index eventos_analytics_usuario on public.eventos_analytics (usuario_id) where usuario_id is not null;
