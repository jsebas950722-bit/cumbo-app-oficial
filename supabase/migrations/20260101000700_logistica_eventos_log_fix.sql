-- ============================================================
-- CUMBO — Extensión de esquema para Logística
-- Ejecutar DESPUÉS de los 6 archivos anteriores.
-- ============================================================

-- ------------------------------------------------------------
-- CORRECCIÓN IMPORTANTE: a `eventos_log` le faltaba la policy de
-- INSERT desde el día 1.
-- ------------------------------------------------------------
-- El comentario original en cumbo_schema.sql decía "nadie inserta
-- directo desde el cliente, se inserta desde funciones/backend con
-- service_role" — pero todas las pantallas que construimos después
-- (Marketplace, Portal Caficultor, Panel Cumbo, CRM Vendedor,
-- Comunidad, Logística) SÍ insertan eventos directamente desde el
-- navegador. Sin esta policy, cada uno de esos INSERT ha estado
-- fallando en silencio todo este tiempo — el log de auditoría
-- probablemente está vacío o incompleto en tu base actual.
--
-- La corrección: permitir INSERT a cualquier usuario autenticado.
-- eventos_log sigue siendo inmutable (los triggers de UPDATE/DELETE
-- de cumbo_schema.sql se mantienen intactos) — esto solo habilita
-- agregar filas nuevas.
create policy "eventos_log_crear_autenticados" on public.eventos_log
  for insert with check (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- Función helper genérica (para no repetir usuario_es_ceo() por
-- cada rol nuevo que necesite su propia policy).
-- ------------------------------------------------------------
create or replace function public.usuario_tiene_rol(rol_buscado rol_usuario)
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from public.usuarios where id = auth.uid() and rol = rol_buscado);
$$;

-- ------------------------------------------------------------
-- Permisos para el rol `logistica`
-- ------------------------------------------------------------
create policy "pedidos_ver_logistica" on public.pedidos
  for select using (public.usuario_tiene_rol('logistica'));

create policy "pedidos_editar_logistica" on public.pedidos
  for update using (public.usuario_tiene_rol('logistica'));

create policy "usuarios_ver_logistica" on public.usuarios
  for select using (public.usuario_tiene_rol('logistica'));

-- ------------------------------------------------------------
-- Cómo asignar el rol logística (todavía manual, igual que CEO)
-- ------------------------------------------------------------
--   update public.usuarios set rol = 'logistica' where correo = 'correo@ejemplo.com';
