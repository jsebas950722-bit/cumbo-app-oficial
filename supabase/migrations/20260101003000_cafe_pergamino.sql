-- ============================================================
-- CUMBO — Corrección de modelo de negocio: café pergamino
-- Ejecutar DESPUÉS de las 29 migraciones anteriores.
-- ============================================================
-- CORRECCIÓN IMPORTANTE: la migración anterior (control_inventario_
-- caficultores) le dio al caficultor permiso de editar el stock de su
-- propio producto de café — pero el modelo real de negocio es otro:
-- Cumbo COMPRA el café en pergamino (sin procesar) a los caficultores
-- por bultos, y es Cumbo quien controla el stock del producto
-- terminado que se vende en el Marketplace. El caficultor no gestiona
-- ese inventario — vende su cosecha en pergamino, eso es todo.
--
-- Se corrige la policy para que el stock de café SOLO lo pueda editar
-- el CEO, sin importar a quién apunte vendedor_id (que se mantiene
-- para que el caficultor pueda VER su producto, no para editarlo).

drop policy if exists "productos_editar_vendedor" on public.productos;
create policy "productos_editar_vendedor" on public.productos
  for update using (vendedor_id = auth.uid() and tipo <> 'cafe_finca');

-- ------------------------------------------------------------
-- Compras de café pergamino — el registro real de qué le compra
-- Cumbo a cada caficultor, por bulto.
-- ------------------------------------------------------------
create table public.compras_pergamino (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas(id) on delete cascade,
  caficultor_id uuid references public.usuarios(id) on delete set null,
  cantidad_bultos integer not null check (cantidad_bultos > 0),
  peso_por_bulto_kg numeric(6,2) not null default 70, -- 70kg es el estándar de un bulto de café pergamino en Colombia
  precio_por_kilo numeric(12,2) not null,
  total_pagado numeric(14,2) generated always as (cantidad_bultos * peso_por_bulto_kg * precio_por_kilo) stored,
  estado_pago text not null default 'pendiente' check (estado_pago in ('pendiente', 'pagado')),
  notas text,
  fecha_compra timestamptz not null default now()
);

alter table public.compras_pergamino enable row level security;

-- El caficultor ve sus propias ventas a Cumbo — de solo lectura, no
-- puede crear ni editar registros de compra, eso lo hace el CEO.
create policy "compras_pergamino_ver_propia" on public.compras_pergamino
  for select using (auth.uid() = caficultor_id);

create policy "compras_pergamino_ceo" on public.compras_pergamino
  for all using (public.usuario_es_ceo());

alter publication supabase_realtime add table public.compras_pergamino;
