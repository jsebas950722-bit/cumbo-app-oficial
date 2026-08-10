-- ============================================================
-- CUMBO — Extensión de esquema + datos seed para Marketplace
-- Ejecutar DESPUÉS de cumbo_schema.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columnas nuevas en productos
-- ------------------------------------------------------------
-- marca_externa: para equipos/accesorios vendidos por marcas socias
-- via dropshipping (Hario, Melitta, Nespresso, etc.) — NO son
-- "vendedor_id" porque esas marcas no tienen cuenta de usuario Cumbo.
-- subtipo: sub-categoría (método de preparación: 'V60','Chemex'...
-- o tipo de accesorio: 'Molinos','Básculas'...)
alter table public.productos add column if not exists marca_externa text;
alter table public.productos add column if not exists subtipo text;
alter table public.productos add column if not exists caracteristicas text;
alter table public.productos add column if not exists calificacion numeric(2,1);
alter table public.productos add column if not exists num_resenas integer not null default 0;

-- La constraint original solo permitía finca_id o vendedor_id.
-- Los productos de marca externa no tienen ninguno de los dos.
alter table public.productos drop constraint if exists chk_producto_origen;
alter table public.productos add constraint chk_producto_origen check (
  finca_id is not null or vendedor_id is not null or marca_externa is not null
);

-- ------------------------------------------------------------
-- 2. Seed: 3 fincas de ejemplo
-- ------------------------------------------------------------
-- NOTA: certificacion_* son placeholders — reemplazar por las URLs
-- reales de Supabase Storage cuando cada caficultor suba sus archivos.
-- Estas 3 fincas son de referencia/demostración para el Marketplace,
-- no pertenecen a ningún caficultor real todavía — por eso
-- caficultor_id queda en null (columna hecha nullable más abajo).

alter table public.fincas alter column caficultor_id drop not null;

insert into public.fincas (id, caficultor_id, nombre_finca, region, vereda, altitud_msnm, especie, proceso, precio_kilo_propuesto, certificacion_foto_cultivo, certificacion_foto_grano, certificacion_video, cedula_documento, estado)
select
  gen_random_uuid(), null, v.nombre_finca, v.region::region_finca, v.vereda, v.altitud, v.especie::especie_cafe, v.proceso::proceso_cafe, v.precio_kilo,
  'pendiente-upload/foto-cultivo.jpg', 'pendiente-upload/foto-grano.jpg', 'pendiente-upload/video.mp4', 'pendiente-upload/cedula.pdf', 'validada'
from (values
  ('Finca La Esperanza', 'Huila', 'El Rosario', 1780, 'Castillo', 'Lavado', 70000),
  ('Finca El Mirador', 'Nariño', 'La Cocha', 1950, 'Caturra', 'Honey', 62000),
  ('Finca La Cumbre', 'Cauca', 'Piendamó', 2020, 'Pink Bourbon', 'Natural', 77000)
) as v(nombre_finca, region, vereda, altitud, especie, proceso, precio_kilo)
where not exists (select 1 from public.fincas where nombre_finca = v.nombre_finca);

-- ------------------------------------------------------------
-- 3. Seed: productos de café, uno por finca (precio base = "Libra")
-- ------------------------------------------------------------
insert into public.productos (id, tipo, finca_id, nombre, formato, calidad, precio, stock, calificacion, num_resenas)
select gen_random_uuid(), 'cafe_finca', f.id, f.nombre_finca, 'Libra', 'alta',
  case f.nombre_finca
    when 'Finca La Esperanza' then 32000
    when 'Finca El Mirador' then 28000
    when 'Finca La Cumbre' then 35000
  end,
  50,
  case f.nombre_finca when 'Finca La Esperanza' then 4.8 when 'Finca El Mirador' then 4.6 else 4.9 end,
  case f.nombre_finca when 'Finca La Esperanza' then 63 when 'Finca El Mirador' then 41 else 28 end
from public.fincas f
where f.nombre_finca in ('Finca La Esperanza', 'Finca El Mirador', 'Finca La Cumbre')
  and not exists (select 1 from public.productos p where p.finca_id = f.id and p.tipo = 'cafe_finca');

-- ------------------------------------------------------------
-- 4. Seed: equipos de preparación (marcas socias / dropshipping)
-- ------------------------------------------------------------
insert into public.productos (id, tipo, nombre, marca_externa, subtipo, calidad, precio, caracteristicas, stock)
select gen_random_uuid(), 'metodo_preparacion', v.nombre, v.marca, v.metodo, v.calidad::calidad_producto, v.precio, v.caracteristicas, 20
from (values
  ('V60 Melitta', 'Melitta', 'V60', 'basica', 45000, 'Plástico resistente al calor, ranura simple, ligero.'),
  ('V60 Kono', 'Kono', 'V60', 'basica', 52000, 'Resina resistente, cono clásico japonés de un solo orificio.'),
  ('V60 Hario', 'Hario', 'V60', 'media', 85000, 'Cerámica esmaltada, ranuras en espiral para flujo uniforme.'),
  ('V60 Origami', 'Origami', 'V60', 'media', 98000, 'Cerámica con pliegues externos, compatible con filtro plano o cónico.'),
  ('V60 Kalita', 'Kalita', 'V60', 'alta', 150000, 'Cobre premium acabado artesanal, base plana de triple orificio.'),
  ('V60 Fellow Stagg', 'Fellow Stagg', 'V60', 'alta', 175000, 'Acero inoxidable doble pared, diseño de flujo patentado.'),
  ('Chemex Bodum', 'Bodum', 'Chemex', 'basica', 140000, 'Vidrio estándar 3 tazas, cuello sin amarre.'),
  ('Chemex Original', 'Chemex', 'Chemex', 'media', 210000, 'Vidrio borosilicato 6 tazas, cuello de madera con amarre de cuero.'),
  ('Prensa IKEA Upphetta', 'IKEA', 'Prensa francesa', 'basica', 70000, 'Vidrio simple, malla de acero, estructura plástica.'),
  ('Prensa Bodum Chambord', 'Bodum', 'Prensa francesa', 'media', 130000, 'Vidrio de borosilicato, malla de acero inoxidable.'),
  ('Prensa Espro', 'Espro', 'Prensa francesa', 'alta', 210000, 'Doble pared de acero inoxidable, filtro de doble malla.'),
  ('Moka IMUSA', 'IMUSA', 'Moka', 'basica', 95000, 'Aluminio estándar, base apta para estufa a gas.'),
  ('Moka Bialetti Express', 'Bialetti', 'Moka', 'media', 165000, 'Aluminio grado alimenticio, válvula de seguridad.'),
  ('Cafetera Oster', 'Oster', 'Cafetera', 'basica', 210000, 'Jarra de vidrio, calentador de placa, control simple.'),
  ('Cafetera Cuisinart', 'Cuisinart', 'Cafetera', 'media', 480000, 'Control de temperatura de precisión, jarra térmica.'),
  ('Nespresso Essenza', 'Nespresso', 'Cápsulas', 'media', 320000, 'Bomba de 19 bares, depósito de agua extraíble.'),
  ('Nespresso Vertuo', 'Nespresso', 'Cápsulas', 'alta', 520000, 'Tecnología de código de barras, espumador integrado.')
) as v(nombre, marca, metodo, calidad, precio, caracteristicas)
where not exists (select 1 from public.productos p where p.nombre = v.nombre and p.tipo = 'metodo_preparacion');

-- ------------------------------------------------------------
-- 5. Seed: accesorios
-- ------------------------------------------------------------
insert into public.productos (id, tipo, nombre, marca_externa, subtipo, precio, caracteristicas, stock)
select gen_random_uuid(), 'accesorio', v.nombre, v.marca, v.subtipo, v.precio, v.caracteristicas, 30
from (values
  ('Pocillo de cerámica 150ml', 'Hario', 'Pocillos y jarras', 22000, 'Cerámica esmaltada, boca ancha para resaltar aroma.'),
  ('Jarra medidora de vidrio 600ml', 'Bodum', 'Pocillos y jarras', 45000, 'Vidrio resistente al calor, escala de medición grabada.'),
  ('Molino manual de acero', 'Hario Skerton', 'Molinos', 120000, 'Cuchillas cerámicas, 8 niveles de molienda, portátil.'),
  ('Molino eléctrico de cuchillas', 'Baratza Encore', 'Molinos', 480000, 'Motor DC silencioso, 40 niveles de molienda.'),
  ('Báscula de precisión con temporizador', 'Timemore', 'Básculas', 145000, 'Precisión de 0.1g, temporizador integrado.'),
  ('Filtros de papel V60 (100 uds)', 'Hario', 'Filtros y empaques', 18000, 'Papel sin blanquear, sabor neutro, caja de 100 unidades.'),
  ('Filtro de agua para cafetera', 'Brita', 'Filtros y empaques', 38000, 'Reduce cloro y sedimentos, mejora el sabor del agua.'),
  ('Tetera cuello de ganso 600ml', 'Fellow', 'Otros', 165000, 'Vertido de precisión, base de acero inoxidable.')
) as v(nombre, marca, subtipo, precio, caracteristicas)
where not exists (select 1 from public.productos p where p.nombre = v.nombre and p.tipo = 'accesorio');
