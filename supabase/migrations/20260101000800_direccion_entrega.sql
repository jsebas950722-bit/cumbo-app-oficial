-- ============================================================
-- CUMBO — Dirección y teléfono de entrega en pedidos
-- ============================================================
-- Hacía falta sin importar el método de pago: ningún pedido físico se
-- puede despachar sin saber a dónde ni a quién contactar. Es seguro
-- correr esto aunque ya hayas corrido antes cumbo_schema_contraentrega.sql
-- (usa "if not exists").
-- ============================================================

alter table public.pedidos add column if not exists direccion_entrega text;
alter table public.pedidos add column if not exists ciudad_entrega text;
alter table public.pedidos add column if not exists telefono_contacto text;
