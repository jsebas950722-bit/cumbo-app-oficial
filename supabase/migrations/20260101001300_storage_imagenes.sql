-- ============================================================
-- CUMBO — Almacenamiento real de imágenes (productos y publicaciones)
-- Ejecutar DESPUÉS de las 12 migraciones anteriores.
-- ============================================================
-- Hasta ahora el Marketplace mostraba un ícono genérico de café en
-- vez de una foto real del producto — no había ningún lugar donde
-- subir esa foto. Esto agrega el campo y el bucket de Storage.

alter table public.productos add column if not exists imagen_url text;
alter table public.publicaciones add column if not exists imagen_url text;

-- Bucket público de lectura (las fotos se muestran a cualquiera en el
-- Marketplace/Comunidad), escritura solo del dueño del producto.
insert into storage.buckets (id, name, public)
values ('productos-imagenes', 'productos-imagenes', true)
on conflict (id) do nothing;

create policy "productos_imagenes_lectura_publica"
  on storage.objects for select
  using (bucket_id = 'productos-imagenes');

create policy "productos_imagenes_subida_propia"
  on storage.objects for insert
  with check (
    bucket_id = 'productos-imagenes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "productos_imagenes_borrado_propio"
  on storage.objects for delete
  using (
    bucket_id = 'productos-imagenes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
