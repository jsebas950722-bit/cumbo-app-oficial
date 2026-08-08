-- ============================================================
-- CUMBO — Proceso real de devoluciones
-- Ejecutar DESPUÉS de las 15 migraciones anteriores.
-- ============================================================
-- Cubre el derecho de retracto (Ley 1480/2011, ya documentado en
-- Términos y Condiciones) y las devoluciones por garantía (producto
-- dañado/incorrecto). El cliente solicita, el CEO aprueba o rechaza,
-- y si aprueba, se intenta el reembolso real por la pasarela que se
-- usó para pagar.

create table public.solicitudes_devolucion (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  cliente_id uuid references public.usuarios(id) on delete set null,
  tipo text not null check (tipo in ('retracto', 'garantia')),
  motivo text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'rechazada', 'reembolsada', 'reembolso_manual_pendiente')),
  notas_ceo text,
  fecha_solicitud timestamptz not null default now(),
  fecha_resolucion timestamptz
);

alter table public.solicitudes_devolucion enable row level security;

create policy "devoluciones_ver_propia" on public.solicitudes_devolucion
  for select using (auth.uid() = cliente_id);

create policy "devoluciones_crear_propia" on public.solicitudes_devolucion
  for insert with check (
    auth.uid() = cliente_id
    and exists (select 1 from public.pedidos p where p.id = pedido_id and p.cliente_id = auth.uid())
  );

create policy "devoluciones_ver_ceo" on public.solicitudes_devolucion
  for select using (public.usuario_es_ceo());

create policy "devoluciones_editar_ceo" on public.solicitudes_devolucion
  for update using (public.usuario_es_ceo());

-- Solo un pedido puede tener una solicitud activa (evita duplicados
-- por doble clic o reintento).
create unique index solicitudes_devolucion_pedido_activa
  on public.solicitudes_devolucion (pedido_id)
  where estado in ('pendiente', 'aprobada');
