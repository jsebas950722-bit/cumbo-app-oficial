-- ============================================================
-- CUMBO — Agente de conciliación de pagos
-- Ejecutar DESPUÉS de las 25 migraciones anteriores.
-- ============================================================
-- Este era un hueco real marcado desde la primera auditoría de
-- protocolos: nadie comparaba lo que dicen Mercado Pago/Wompi contra
-- lo que dice `pedidos.pago_confirmado` — si un webhook fallaba en
-- silencio, nadie se enteraba.

create table public.discrepancias_pago (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  pasarela text not null,
  estado_local text not null,
  estado_pasarela text not null,
  severidad text not null check (severidad in ('info', 'atencion', 'urgente')),
  detalle text,
  resuelto boolean not null default false,
  corregido_automaticamente boolean not null default false,
  fecha timestamptz not null default now()
);

alter table public.discrepancias_pago enable row level security;

create policy "discrepancias_pago_ceo" on public.discrepancias_pago
  for all using (public.usuario_es_ceo());

alter publication supabase_realtime add table public.discrepancias_pago;

-- ------------------------------------------------------------
-- Programar la conciliación automática (opcional — requiere que la
-- extensión pg_cron esté habilitada en tu proyecto: Dashboard →
-- Database → Extensions → pg_cron). Si no la habilitás, el botón
-- "Conciliar ahora" en Panel Cumbo sigue funcionando igual, solo que
-- manual en vez de programado.
-- ------------------------------------------------------------
-- Descomentá esto después de habilitar pg_cron y reemplazar
-- TU_PROJECT_REF y TU_ANON_KEY:
--
-- select cron.schedule(
--   'conciliar-pagos-cada-6-horas',
--   '0 */6 * * *',
--   $$
--   select net.http_post(
--     url := 'https://TU_PROJECT_REF.supabase.co/functions/v1/conciliar-pagos',
--     headers := '{"Authorization": "Bearer TU_ANON_KEY", "Content-Type": "application/json"}'::jsonb
--   );
--   $$
-- );
