-- ============================================================
-- CUMBO — Corrección de privacidad en eventos_log + soporte para
-- "Mis Pedidos" (seguimiento real del cliente sobre su propio pedido)
-- ============================================================

-- ------------------------------------------------------------
-- CORRECCIÓN DE SEGURIDAD: la policy original de eventos_log
-- permitía a CUALQUIER usuario autenticado leer TODO el log — es
-- decir, cualquier cliente logueado podía ver los cambios de estado
-- de pedidos de otras personas, o las fincas de otros caficultores.
-- Se detectó al construir "Mis Pedidos" (pantalla donde el cliente
-- por fin necesita leer eventos_log de verdad, y ahí quedó expuesto
-- que la policy anterior era demasiado permisiva).
-- ------------------------------------------------------------
drop policy if exists "eventos_log_lectura_autenticados" on public.eventos_log;

-- Cada persona solo ve los eventos de SUS PROPIOS pedidos...
create policy "eventos_log_ver_propio_pedido" on public.eventos_log
  for select using (
    entidad = 'pedido'
    and exists (select 1 from public.pedidos p where p.id = eventos_log.entidad_id and p.cliente_id = auth.uid())
  );

-- ...o de SUS PROPIAS fincas (si es caficultor)...
create policy "eventos_log_ver_propia_finca" on public.eventos_log
  for select using (
    entidad = 'finca'
    and exists (select 1 from public.fincas f where f.id = eventos_log.entidad_id and f.caficultor_id = auth.uid())
  );

-- ...o de sus propias acciones registradas (usuario_id = quien hizo la acción).
create policy "eventos_log_ver_propia_accion" on public.eventos_log
  for select using (usuario_id = auth.uid());

-- El equipo Cumbo y logística sí pueden ver todo (ya usaban esto en
-- Panel Cumbo / Logística antes de esta corrección — se reafirma acá).
create policy "eventos_log_ver_ceo" on public.eventos_log
  for select using (public.usuario_es_ceo());

create policy "eventos_log_ver_logistica" on public.eventos_log
  for select using (public.usuario_tiene_rol('logistica'));
