-- ============================================================
-- CUMBO — CORRECCIÓN: borrar un producto ya vendido rompía el pedido
-- ============================================================
-- `pedido_items.producto_id` no tenía ninguna regla de borrado
-- (RESTRICT por defecto). CRMVendedor.jsx permite borrar un producto
-- en cualquier momento — si ese producto ya había sido comprado al
-- menos una vez, el DELETE fallaba en la base... pero CRMVendedor.jsx
-- actualizaba la lista visible ANTES de confirmar que el borrado
-- funcionó, y nunca revisaba si hubo error. Resultado real: el
-- vendedor veía el producto desaparecer de su panel, pero seguía
-- existiendo y comprable en el Marketplace — un estado confuso e
-- inconsistente que se detectó auditando de punta a punta el flujo
-- de borrado.
--
-- La corrección de fondo no es solo arreglar la referencia — es que
-- un producto con historial de ventas NUNCA debería borrarse de
-- verdad (se perdería el nombre real en el historial de pedidos de
-- los clientes que ya lo compraron). Se agrega una bandera `activo`:
-- el vendedor "elimina" desactivando, el Marketplace deja de
-- mostrarlo, pero el historial de compras de los clientes queda
-- intacto para siempre.

alter table public.productos add column if not exists activo boolean not null default true;

-- Defensa adicional: si alguna vez se borra un producto directo desde
-- la base (no desde la app, que ahora solo desactiva), que no bloquee
-- ni corrompa el historial de pedidos que ya lo referencian.
alter table public.pedido_items alter column producto_id drop not null;
alter table public.pedido_items drop constraint if exists pedido_items_producto_id_fkey;
alter table public.pedido_items add constraint pedido_items_producto_id_fkey
  foreign key (producto_id) references public.productos(id) on delete set null;
