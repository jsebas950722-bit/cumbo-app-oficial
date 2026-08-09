-- ============================================================
-- CUMBO ESTUDIO 2.0 — Fase 1: Motor de Voz de Marca
-- (según "Cumbo Estudio 2.0 — Esquema Estratégico y Técnico")
-- Ejecutar DESPUÉS de las 23 migraciones anteriores.
-- ============================================================
-- Implementa la Fase 1 del roadmap del documento — la de mayor valor
-- y menor riesgo según el propio documento, antes que el motor visual
-- (Fase 2) o video (Fase 4, que el documento recomienda validar antes
-- de construir).

-- ------------------------------------------------------------
-- Motor de Voz: ejemplos/fragmentos reales que entrenan el tono.
-- En vez de "prompts sueltos", esto es la fuente de verdad de marca
-- que el documento pide — Sebastián carga acá fragmentos de la
-- Constitución del Ecosistema, la Gobernanza de Conocimiento de Café,
-- o conversaciones del Sommelier que salieron especialmente bien.
-- ------------------------------------------------------------
create table public.voz_de_marca (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('constitucion', 'gobernanza', 'sommelier_destacado', 'ficha_producto', 'otro')),
  contenido text not null,
  activo boolean not null default true,
  creado_por uuid references public.usuarios(id) on delete set null,
  creado_en timestamptz not null default now()
);

alter table public.voz_de_marca enable row level security;

-- Solo el CEO gestiona la voz de marca — es la fuente de verdad única
-- que pide el documento, no algo que cada vendedor deba curar.
create policy "voz_de_marca_ceo" on public.voz_de_marca
  for all using (public.usuario_es_ceo());

-- Cualquier función/usuario autenticado puede LEER los ejemplos
-- activos (los necesita para generar contenido con la voz correcta),
-- pero no editarlos.
create policy "voz_de_marca_lectura_autenticados" on public.voz_de_marca
  for select using (auth.role() = 'authenticated');

alter publication supabase_realtime add table public.voz_de_marca;

-- ------------------------------------------------------------
-- Nota sobre `piezas` (jsonb, sin migración de esquema necesaria):
-- cada pieza ahora incluye `estado_editorial` con los 4 estados que
-- pide el documento: 'generado_ia' → 'revisado' → 'programado' →
-- 'publicado' (antes solo existía 'borrador'). También incluye
-- `perfil_tono` ('tecnico_catador' | 'cercano_consumidor' |
-- 'educativo_academy') y `datos_sin_verificar` (lista de qué datos
-- citados en el guion todavía no están validados por el CEO — el
-- guardrail que exige el documento).
-- ------------------------------------------------------------
