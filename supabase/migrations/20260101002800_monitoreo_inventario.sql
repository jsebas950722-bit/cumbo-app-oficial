-- ============================================================
-- CUMBO — Agente de monitoreo de inventario
-- Ejecutar DESPUÉS de las 27 migraciones anteriores.
-- ============================================================
-- El cuarto y último de los agentes priorizados. A diferencia de los
-- otros tres (conciliación de pagos, validación de fincas, triage de
-- devoluciones), este no toca dinero ni decide nada sobre confianza —
-- solo detecta y avisa. Por eso tiene más autonomía: inserta alertas
-- directo, sin necesitar aprobación previa. El peor caso de que se
-- equivoque es un aviso de menos valor, no una decisión de negocio
-- incorrecta.

create table public.alertas_inventario (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  tipo text not null check (tipo in ('stock_bajo', 'sin_ventas')),
  detalle text not null,
  resuelta boolean not null default false,
  fecha timestamptz not null default now()
);

alter table public.alertas_inventario enable row level security;

-- El vendedor ve las alertas de sus propios productos — se las
-- muestra la propia app al entrar a CRM Vendedor/Portal Caficultor.
create policy "alertas_inventario_ver_propio" on public.alertas_inventario
  for select using (
    exists (select 1 from public.productos p where p.id = producto_id and p.vendedor_id = auth.uid())
  );

-- El vendedor también puede marcar su propia alerta como resuelta
-- (ej: ya repuso el stock y no quiere seguir viéndola).
create policy "alertas_inventario_resolver_propio" on public.alertas_inventario
  for update using (
    exists (select 1 from public.productos p where p.id = producto_id and p.vendedor_id = auth.uid())
  );

create policy "alertas_inventario_ceo" on public.alertas_inventario
  for all using (public.usuario_es_ceo());

alter publication supabase_realtime add table public.alertas_inventario;

-- Evita duplicar la misma alerta sin resolver una y otra vez cada vez
-- que corre el monitoreo.
create unique index alertas_inventario_activa_unica
  on public.alertas_inventario (producto_id, tipo)
  where resuelta = false;
