-- ============================================================
-- CUMBO — Contabilidad básica (aplicando el curso que compartió Sebastián)
-- Ejecutar DESPUÉS de las 34 migraciones anteriores.
-- ============================================================
-- El Estado de Resultados tiene partes que la app SÍ puede calcular
-- solas con datos reales (ingresos por ventas, costo de compra de
-- pergamino) y partes que NO puede saber (gastos operativos como
-- arriendo/servicios/personal, otros ingresos/egresos) — esas se
-- guardan acá, cargadas a mano por el CEO, una vez por período.

create table public.finanzas_periodo (
  id uuid primary key default gen_random_uuid(),
  periodo text not null unique, -- formato 'YYYY-MM'
  gastos_operativos numeric(14,2) not null default 0,
  otros_ingresos numeric(14,2) not null default 0,
  otros_egresos numeric(14,2) not null default 0,
  notas text,
  actualizado_en timestamptz not null default now()
);

alter table public.finanzas_periodo enable row level security;

create policy "finanzas_periodo_ceo" on public.finanzas_periodo
  for all using (public.usuario_es_ceo());

-- ------------------------------------------------------------
-- Autoevaluación contable (las mismas 10 preguntas del curso) — para
-- que Sebastián pueda repetirla cada tanto y ver si mejora el puntaje.
-- ------------------------------------------------------------
create table public.autoevaluacion_contable (
  id uuid primary key default gen_random_uuid(),
  respuestas jsonb not null, -- array de 10 booleanos
  puntaje integer not null,
  fecha timestamptz not null default now()
);

alter table public.autoevaluacion_contable enable row level security;

create policy "autoevaluacion_contable_ceo" on public.autoevaluacion_contable
  for all using (public.usuario_es_ceo());
