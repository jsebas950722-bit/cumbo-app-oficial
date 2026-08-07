-- ============================================================
-- CUMBO — Extensión de esquema para CRM Vendedor
-- Ejecutar DESPUÉS de los 4 archivos anteriores.
-- ============================================================

-- ------------------------------------------------------------
-- CORRECCIÓN: a `productos` le faltaban policies de escritura.
-- ------------------------------------------------------------
-- Tenía solo lectura pública desde cumbo_schema.sql. Sin esto, ni el
-- vendedor podía publicar/editar/eliminar sus productos desde CRM
-- Vendedor, ni Panel Cumbo podía crear el producto de café al validar
-- una finca — ambos se habrían visto bloqueados por RLS en silencio,
-- igual que el caso de `pedido_items` que se corrigió en
-- cumbo_schema_panel.sql. Se detectó al construir CRM Vendedor.

create policy "productos_crear_vendedor" on public.productos
  for insert with check (vendedor_id = auth.uid());

create policy "productos_editar_vendedor" on public.productos
  for update using (vendedor_id = auth.uid());

create policy "productos_eliminar_vendedor" on public.productos
  for delete using (vendedor_id = auth.uid());

create policy "productos_crear_ceo" on public.productos
  for insert with check (public.usuario_es_ceo());

create policy "productos_editar_ceo" on public.productos
  for update using (public.usuario_es_ceo());
