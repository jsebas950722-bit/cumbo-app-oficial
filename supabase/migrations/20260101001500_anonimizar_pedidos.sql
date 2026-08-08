-- ============================================================
-- CUMBO — Anonimizar pedidos al eliminar cuenta (no borrarlos)
-- Ejecutar DESPUÉS de la migración anterior.
-- ============================================================
-- El esquema original borraba en cascada TODOS los pedidos de un
-- usuario al eliminar su cuenta ("on delete cascade"). Eso es un
-- problema real: la ley exige conservar los registros de venta por
-- fines contables/tributarios (usualmente 5 años), y borrar el pedido
-- por completo pierde esa trazabilidad. Lo correcto es anonimizar
-- (dejar el pedido, pero desvincularlo de la persona), no borrarlo.
--
-- Se detectó al escribir el aviso de eliminación de cuenta en
-- Perfil.jsx — el texto le prometía al usuario que sus pedidos se
-- conservarían de forma anónima, y el esquema real no lo permitía
-- todavía.

alter table public.pedidos drop constraint if exists pedidos_cliente_id_fkey;
alter table public.pedidos alter column cliente_id drop not null;
alter table public.pedidos add constraint pedidos_cliente_id_fkey
  foreign key (cliente_id) references public.usuarios(id) on delete set null;
