-- ============================================================
-- CUMBO — Extensión de esquema para Portal Caficultor
-- Ejecutar DESPUÉS de cumbo_schema.sql y cumbo_schema_marketplace.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columnas agronómicas adicionales en fincas
-- ------------------------------------------------------------
alter table public.fincas add column if not exists notas_sabor text;
alter table public.fincas add column if not exists fecha_recoleccion date;
alter table public.fincas add column if not exists estado_grano text;      -- 'Pergamino', 'Trillado', etc.
alter table public.fincas add column if not exists humedad_grano numeric(4,1);
alter table public.fincas add column if not exists malla_grano text;       -- 'Supremo (malla 17+)', etc.
alter table public.fincas add column if not exists certificacion_foto_humedad text;

-- ------------------------------------------------------------
-- 2. Datos bancarios + identidad — tabla SEPARADA, no pública
-- ------------------------------------------------------------
-- Esto NO va en `fincas` porque esa tabla tiene lectura pública
-- (para el Marketplace). Cuenta bancaria y cédula son datos sensibles:
-- solo el propio caficultor (y más adelante el CEO, para validar) deben
-- poder leerlos.
create table if not exists public.fincas_datos_pago (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null unique references public.fincas(id) on delete cascade,
  banco text not null,
  tipo_cuenta text not null default 'Ahorros',
  numero_cuenta text not null,
  titular_cuenta text not null,
  cedula_numero text not null,
  cedula_documento_url text not null,
  fecha_creacion timestamptz not null default now()
);

alter table public.fincas_datos_pago enable row level security;

create policy "datos_pago_ver_propio" on public.fincas_datos_pago
  for select using (
    exists (select 1 from public.fincas f where f.id = finca_id and f.caficultor_id = auth.uid())
  );

create policy "datos_pago_crear_propio" on public.fincas_datos_pago
  for insert with check (
    exists (select 1 from public.fincas f where f.id = finca_id and f.caficultor_id = auth.uid())
  );

-- NOTA: falta la policy para que el CEO (rol 'ceo') también pueda leer
-- estos datos al validar una finca — se agrega cuando conectemos Panel Cumbo.

-- ------------------------------------------------------------
-- 3. Storage: bucket para certificaciones de finca
-- ------------------------------------------------------------
-- Público de LECTURA (para mostrar fotos en Trazabilidad/Marketplace),
-- pero solo el propio caficultor puede subir a su propia carpeta
-- (fincas-certificaciones/{user_id}/...).
insert into storage.buckets (id, name, public)
values ('fincas-certificaciones', 'fincas-certificaciones', true)
on conflict (id) do nothing;

create policy "certificaciones_lectura_publica"
  on storage.objects for select
  using (bucket_id = 'fincas-certificaciones');

create policy "certificaciones_subida_propia"
  on storage.objects for insert
  with check (
    bucket_id = 'fincas-certificaciones'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- NOTA: estas policies de storage son una primera pasada funcional.
-- Falta afinar según cómo termine viéndose Panel Cumbo (¿el CEO necesita
-- borrar o reemplazar certificaciones rechazadas?).
