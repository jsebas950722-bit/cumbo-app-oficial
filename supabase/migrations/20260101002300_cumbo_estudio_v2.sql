-- ============================================================
-- CUMBO ESTUDIO 2.0 — tiempo real, embudos, imágenes con Gemini
-- Ejecutar DESPUÉS de las 22 migraciones anteriores.
-- ============================================================

-- Habilita actualizaciones en vivo (Supabase Realtime) sobre estas
-- tablas — sin esto, el dashboard solo se actualiza si recargás la
-- página a mano.
alter publication supabase_realtime add table public.contenido_marketing;
alter publication supabase_realtime add table public.suscripciones_estudio;

-- Bucket para las imágenes que genera Gemini por cada pieza de
-- contenido — separado de productos-imagenes porque son imágenes de
-- marketing generadas, no fotos reales subidas por el vendedor.
insert into storage.buckets (id, name, public)
values ('estudio-imagenes', 'estudio-imagenes', true)
on conflict (id) do nothing;

create policy "estudio_imagenes_lectura_publica"
  on storage.objects for select
  using (bucket_id = 'estudio-imagenes');

create policy "estudio_imagenes_escritura_propia"
  on storage.objects for insert
  with check (
    bucket_id = 'estudio-imagenes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Qué modelo de texto generó ese contenido (el vendedor elige entre
-- Claude o Gemini) — es informativo, no cambia el comportamiento.
alter table public.contenido_marketing add column if not exists modelo_usado text default 'claude';

-- Nota: no hace falta cambiar la forma de `piezas` (sigue siendo
-- jsonb) — ahora cada pieza puede incluir además `etapa_embudo`
-- ('atraccion' | 'consideracion' | 'conversion'), `cta`, y
-- `imagen_url`, sin necesidad de una migración de esquema — jsonb ya
-- es flexible para esto.
