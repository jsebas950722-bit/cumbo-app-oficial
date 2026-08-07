-- ============================================================
-- CUMBO — Extensión de esquema para Panel Cumbo (rol CEO)
-- Ejecutar DESPUÉS de los 3 archivos anteriores.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Función helper: ¿el usuario autenticado es CEO?
-- ------------------------------------------------------------
-- SECURITY DEFINER: corre con permisos del dueño de la función, así
-- evita el problema de "una policy de `usuarios` que necesita consultar
-- `usuarios`" (recursión). Es el patrón estándar de Supabase para esto.
create or replace function public.usuario_es_ceo()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from public.usuarios where id = auth.uid() and rol = 'ceo');
$$;

-- ------------------------------------------------------------
-- 2. Permisos de lectura/escritura para el CEO
-- ------------------------------------------------------------
create policy "usuarios_ver_ceo" on public.usuarios
  for select using (public.usuario_es_ceo());

create policy "fincas_editar_ceo" on public.fincas
  for update using (public.usuario_es_ceo());

create policy "datos_pago_ver_ceo" on public.fincas_datos_pago
  for select using (public.usuario_es_ceo());

create policy "pedidos_ver_ceo" on public.pedidos
  for select using (public.usuario_es_ceo());

create policy "pedidos_editar_ceo" on public.pedidos
  for update using (public.usuario_es_ceo());

create policy "items_ver_ceo" on public.pedido_items
  for select using (public.usuario_es_ceo());

-- ------------------------------------------------------------
-- 3. CORRECCIÓN a cumbo_schema.sql: faltaban policies en pedido_items
-- ------------------------------------------------------------
-- Sin esto, el checkout de Marketplace no podía insertar items de
-- pedido desde el navegador (RLS estaba activo sin ninguna policy =
-- bloqueaba todo). Se detectó al construir Panel Cumbo.
create policy "items_crear_propio" on public.pedido_items
  for insert with check (
    exists (select 1 from public.pedidos p where p.id = pedido_id and p.cliente_id = auth.uid())
  );

create policy "items_ver_propio" on public.pedido_items
  for select using (
    exists (select 1 from public.pedidos p where p.id = pedido_id and p.cliente_id = auth.uid())
  );

-- ------------------------------------------------------------
-- 4. Cómo convertirte en CEO para probar el panel
-- ------------------------------------------------------------
-- Corre esto manualmente (reemplaza el correo), UNA vez, con tu propio
-- usuario ya registrado en la app:
--
--   update public.usuarios set rol = 'ceo' where correo = 'tu@correo.com';
--
-- Todavía no existe un flujo de invitación de administradores — es
-- release manual mientras el equipo Cumbo es solo Sebastián.
