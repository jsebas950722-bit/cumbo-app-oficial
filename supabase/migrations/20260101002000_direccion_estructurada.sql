-- ============================================================
-- CUMBO — Dirección estructurada + peso de producto
-- (necesarios para cotizar envío en vivo con DrEnvío)
-- Ejecutar DESPUÉS de las 16 migraciones anteriores.
-- ============================================================
-- Hasta ahora `direccion_entrega` y `ciudad_entrega` eran texto libre.
-- Para cotizar con una API de envíos real (DrEnvío, que cubre
-- Interrapidísimo/Coordinadora/Servientrega bajo un solo token) hace
-- falta una dirección estructurada: calle, número, barrio,
-- departamento y código postal. Se guarda en un jsonb aparte para no
-- romper todo lo que ya lee `direccion_entrega`/`ciudad_entrega` como
-- texto — esos dos siguen existiendo, ahora se arman automáticamente
-- a partir de la dirección estructurada al momento del pedido.

alter table public.pedidos add column if not exists direccion_estructurada jsonb;
-- Forma esperada: { "calle": "...", "numero": "...", "barrio": "...",
--                    "departamento": "...", "codigo_postal": "..." }

-- Guarda la cotización elegida (la que devolvió DrEnvío) para poder
-- generar la guía real después, sin tener que volver a cotizar.
alter table public.pedidos add column if not exists cotizacion_envio jsonb;

-- Peso real de cada producto — necesario para cotizar (DrEnvío exige
-- peso y dimensiones del paquete). Por ahora nullable: si no está
-- cargado, cotizar-envio usa un peso de referencia aproximado y lo
-- deja bien marcado como estimado, en vez de bloquear la cotización.
alter table public.productos add column if not exists peso_kg numeric(6,3);

-- URL de la etiqueta (PDF) que devuelve DrEnvío al generar la guía —
-- para que Logística la pueda imprimir.
alter table public.pedidos add column if not exists etiqueta_envio_url text;
