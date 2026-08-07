-- ============================================================
-- CUMBO — Agregar Wompi (PSE, Efecty, Nequi y tarjetas incluidos)
-- Ejecutar DESPUÉS de los 10 archivos anteriores.
-- ============================================================

alter table public.pedidos add column if not exists wompi_transaction_id text;

-- Para saber con cuál de las dos pasarelas se pagó cada pedido
-- (Mercado Pago o Wompi) — útil para reportes y para no confundir
-- mercadopago_payment_id con wompi_transaction_id.
alter table public.pedidos add column if not exists pasarela_pago text;
