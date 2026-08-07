-- ============================================================
-- CUMBO — Extensión de esquema para Comunidad
-- Ejecutar DESPUÉS de los 5 archivos anteriores.
-- ============================================================

create table if not exists public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  caficultor_id uuid not null references public.usuarios(id) on delete cascade,
  finca_id uuid references public.fincas(id) on delete set null,
  texto text not null,
  fecha_creacion timestamptz not null default now()
);

alter table public.publicaciones enable row level security;

create policy "publicaciones_lectura_publica" on public.publicaciones
  for select using (true);

create policy "publicaciones_crear_propio" on public.publicaciones
  for insert with check (caficultor_id = auth.uid());

-- ------------------------------------------------------------
-- Likes — persistentes de verdad (el prototipo los simulaba solo en
-- memoria del navegador, se perdían al recargar la página).
-- ------------------------------------------------------------
create table if not exists public.publicaciones_likes (
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  fecha timestamptz not null default now(),
  primary key (publicacion_id, usuario_id)
);

alter table public.publicaciones_likes enable row level security;

create policy "likes_lectura_publica" on public.publicaciones_likes
  for select using (true);

create policy "likes_crear_propio" on public.publicaciones_likes
  for insert with check (usuario_id = auth.uid());

create policy "likes_eliminar_propio" on public.publicaciones_likes
  for delete using (usuario_id = auth.uid());

-- ------------------------------------------------------------
-- Seed: los 3 posts de ejemplo del prototipo, ligados a las fincas
-- reales sembradas en cumbo_schema_marketplace.sql (si existen y si
-- ya tienen un caficultor_id real asignado).
-- ------------------------------------------------------------
insert into public.publicaciones (caficultor_id, finca_id, texto)
select f.caficultor_id, f.id, v.texto
from public.fincas f
join (values
  ('Finca La Esperanza', 'Este año la floración vino más pareja que nunca — esperamos un lavado excelente para julio.'),
  ('Finca El Mirador', 'Terminamos de armar las camas africanas para el secado de esta cosecha lavada. ¡Con muchas ganas!'),
  ('Finca La Cumbre', 'Gracias a todos los que probaron el natural de esta finca — sus notas a mora nos llenan de orgullo.')
) as v(nombre_finca, texto) on v.nombre_finca = f.nombre_finca
where f.caficultor_id is not null
  and not exists (select 1 from public.publicaciones p where p.finca_id = f.id);

-- NOTA: las 3 fincas seed se crearon con caficultor_id = null (no había
-- todavía un usuario caficultor real en ese momento), así que este
-- INSERT no siembra nada hasta que esas fincas tengan un caficultor_id
-- asignado, o hasta que se creen publicaciones nuevas desde la app con
-- un caficultor real. Es intencional — mejor no fabricar publicaciones
-- a nombre de alguien que no existe.
