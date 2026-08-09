-- ============================================================
-- CUMBO ESTUDIO — corrección de bug + control de planes
-- Ejecutar DESPUÉS de las 21 migraciones anteriores.
-- ============================================================
-- BUG REAL ENCONTRADO: `contenido_marketing` tenía RLS activado desde
-- el primer esquema, pero CERO políticas — el mismo patrón que ya
-- corregimos en `usuarios`. Con RLS activado y sin ninguna policy,
-- Postgres deniega todo por defecto: nadie podía leer ni escribir ahí,
-- ni siquiera el CEO. Estaba así desde el día 1, solo que nadie lo
-- había notado porque Cumbo Estudio nunca se había construido.

create policy "contenido_marketing_propio" on public.contenido_marketing
  for all using (auth.uid() = vendedor_id);

create policy "contenido_marketing_ver_ceo" on public.contenido_marketing
  for select using (public.usuario_es_ceo());

-- ------------------------------------------------------------
-- Planes de Cumbo Estudio (Chispa / Cosecha / Finca Completa —
-- nombres ya definidos en la Constitución del Ecosistema).
-- ------------------------------------------------------------
-- Los límites de acá son un punto de partida razonable, no un número
-- fijo del negocio — Sebastián los puede ajustar cuando quiera desde
-- esta tabla o desde Panel Cumbo, sin tocar código.
create table public.suscripciones_estudio (
  vendedor_id uuid primary key references public.usuarios(id) on delete cascade,
  plan text not null default 'chispa' check (plan in ('chispa', 'cosecha', 'finca_completa')),
  usos_este_mes integer not null default 0,
  periodo_actual text not null default to_char(now(), 'YYYY-MM'), -- para saber cuándo reiniciar el contador
  actualizado_en timestamptz not null default now()
);

alter table public.suscripciones_estudio enable row level security;

create policy "suscripciones_estudio_ver_propia" on public.suscripciones_estudio
  for select using (auth.uid() = vendedor_id);

create policy "suscripciones_estudio_ceo" on public.suscripciones_estudio
  for all using (public.usuario_es_ceo());

-- Nota importante para el README/Panel Cumbo: esto controla el LÍMITE
-- de uso mensual, no el cobro real de la suscripción — cobrar
-- automáticamente cada mes según el plan es una pieza aparte
-- (suscripciones recurrentes con Mercado Pago/Wompi), todavía no
-- construida. Por ahora, el CEO asigna el plan manualmente desde
-- Panel Cumbo después de que el vendedor pague por fuera.
