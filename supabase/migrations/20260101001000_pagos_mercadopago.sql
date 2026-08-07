-- ============================================================
-- CUMBO — Pago real con Mercado Pago
-- Ejecutar DESPUÉS de los 9 archivos anteriores.
-- ============================================================

alter table public.pedidos add column if not exists pago_confirmado boolean not null default false;
alter table public.pedidos add column if not exists mercadopago_preference_id text;
alter table public.pedidos add column if not exists mercadopago_payment_id text;

-- NOTA: las Edge Functions (crear-preferencia-pago, webhook-mercadopago)
-- usan la service_role key para leer/escribir `pedidos`, así que no
-- necesitan policies de RLS nuevas — se ejecutan del lado del servidor,
-- no como el usuario autenticado.
