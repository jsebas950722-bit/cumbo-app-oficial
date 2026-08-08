-- ============================================================
-- CUMBO — CORRECCIÓN CRÍTICA: eliminar cuenta fallaría para
-- prácticamente cualquier usuario real
-- ============================================================
-- `eventos_log.usuario_id` y `contenido_app.actualizado_por` referencian
-- a `usuarios(id)` SIN ninguna regla de borrado — el comportamiento por
-- defecto de Postgres en ese caso es RESTRICT: bloquea el DELETE si
-- existe algo que lo referencia.
--
-- En la práctica, esto significa que la Edge Function `eliminar-cuenta`
-- (construida porque Apple exige poder borrar la cuenta desde la app)
-- fallaría con un error de restricción de llave foránea para CUALQUIER
-- usuario que alguna vez haya creado un pedido, publicado un producto,
-- o disparado cualquier evento — es decir, prácticamente cualquier
-- cuenta real y activa. Se detectó auditando de punta a punta el
-- flujo de eliminación de cuenta antes de darlo por terminado.
--
-- La corrección: igual que se hizo con `pedidos.cliente_id`, estas
-- referencias pasan a "on delete set null" — el registro histórico se
-- conserva (útil para auditoría), pero deja de apuntar a un usuario
-- que ya no existe.

alter table public.eventos_log drop constraint if exists eventos_log_usuario_id_fkey;
alter table public.eventos_log add constraint eventos_log_usuario_id_fkey
  foreign key (usuario_id) references public.usuarios(id) on delete set null;

alter table public.contenido_app drop constraint if exists contenido_app_actualizado_por_fkey;
alter table public.contenido_app add constraint contenido_app_actualizado_por_fkey
  foreign key (actualizado_por) references public.usuarios(id) on delete set null;
